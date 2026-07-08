import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  ContainerClient,
} from "@azure/storage-blob";
import { randomUUID } from "crypto";
import path from "path";

// ---------------------------------------------------------------------------
// Configuration from environment
// ---------------------------------------------------------------------------

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "";
const containerName = process.env.AZURE_STORAGE_CONTAINER || "media";

const UPLOAD_ATTEMPTS = parseInt(process.env.AZURE_UPLOAD_ATTEMPTS || "3", 10);
const UPLOAD_BACKOFF_SECONDS = parseInt(process.env.AZURE_UPLOAD_BACKOFF_SECONDS || "2", 10);
const SAS_EXPIRY_HOURS = parseInt(process.env.AZURE_SAS_EXPIRY_HOURS || "720", 10);
const SAS_CACHE_HOURS = parseInt(process.env.AZURE_SAS_CACHE_HOURS || "24", 10);
const MAX_FILE_SIZE = parseInt(process.env.AZURE_MAX_FILE_SIZE || String(10 * 1024 * 1024), 10); // 10 MB
const MAX_VIDEO_FILE_SIZE = parseInt(process.env.AZURE_MAX_VIDEO_FILE_SIZE || String(100 * 1024 * 1024), 10); // 100 MB

// ---------------------------------------------------------------------------
// In-memory SAS cache (per-process)
// ---------------------------------------------------------------------------

interface CachedSas {
  url: string;
  expiresAt: number; // Date.now() millis
}

const sasCache = new Map<string, CachedSas>();

function getCachedSas(key: string): string | null {
  const entry = sasCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    sasCache.delete(key);
    return null;
  }
  return entry.url;
}

function setCachedSas(key: string, url: string, ttlMs: number) {
  sasCache.set(key, { url, expiresAt: Date.now() + ttlMs });
}

// ---------------------------------------------------------------------------
// Parse connection string
// ---------------------------------------------------------------------------

function parseConnectionString(cs: string) {
  const parts: Record<string, string> = {};
  cs.split(";").forEach((segment) => {
    const idx = segment.indexOf("=");
    if (idx > 0) parts[segment.slice(0, idx).trim()] = segment.slice(idx + 1).trim();
  });
  return { accountName: parts.AccountName || "", accountKey: parts.AccountKey || "" };
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class AzureBlobStorageService {
  private client: BlobServiceClient | null = null;
  private containerClient: ContainerClient | null = null;
  private accountName = "";
  private accountKey = "";
  readonly containerName: string;

  constructor() {
    this.containerName = containerName;

    if (!connectionString) {
      console.warn("[BlobStorage] AZURE_STORAGE_CONNECTION_STRING is empty — Azure uploads disabled, local fallback only.");
      return;
    }

    try {
      const sanitized = connectionString.replace(/[\r\n]/g, "").trim();
      const { accountName, accountKey } = parseConnectionString(sanitized);
      this.accountName = accountName;
      this.accountKey = accountKey;

      this.client = BlobServiceClient.fromConnectionString(sanitized);
      this.containerClient = this.client.getContainerClient(this.containerName);
    } catch (err) {
      console.error("[BlobStorage] Failed to initialize Azure client:", err);
      this.client = null;
      this.containerClient = null;
    }
  }

  /** Whether Azure is configured and ready */
  get isAvailable(): boolean {
    return this.client !== null && this.containerClient !== null;
  }

  // -----------------------------------------------------------------------
  // Blob name generation
  // -----------------------------------------------------------------------

  /**
   * Generate a unique blob name from the original filename.
   * Returns `{uuid}.{ext}` — caller prepends the folder prefix.
   */
  generateBlobName(originalFilename: string): string {
    const ext = path.extname(originalFilename).toLowerCase() || ".bin";
    return `${randomUUID()}${ext}`;
  }

  // -----------------------------------------------------------------------
  // Upload
  // -----------------------------------------------------------------------

  /**
   * Upload a file buffer to Azure Blob Storage with retry logic.
   * Returns `{ blobName, blobUrl, size }` on success.
   */
  async uploadFile(
    buffer: Buffer,
    blobName: string,
    contentType: string,
  ): Promise<{ blobName: string; blobUrl: string; size: number }> {
    if (!this.containerClient) throw new Error("Azure Blob Storage is not available");

    // Ensure container exists (idempotent)
    await this.containerClient.createIfNotExists();

    const blockBlob = this.containerClient.getBlockBlobClient(blobName);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
      try {
        await blockBlob.uploadData(buffer, {
          blobHTTPHeaders: { blobContentType: contentType },
        });

        return {
          blobName,
          blobUrl: blockBlob.url,
          size: buffer.length,
        };
      } catch (err: any) {
        lastError = err;
        if (attempt < UPLOAD_ATTEMPTS) {
          const backoff = UPLOAD_BACKOFF_SECONDS * attempt * 1000;
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }

    throw new Error(`Failed to upload after ${UPLOAD_ATTEMPTS} attempts: ${lastError?.message}`);
  }

  // -----------------------------------------------------------------------
  // SAS URL
  // -----------------------------------------------------------------------

  /**
   * Generate a read-only SAS URL for a blob.
   * Results are cached in-memory for up to SAS_CACHE_HOURS.
   */
  getFileUrl(
    blobName: string,
    expiryHours: number = SAS_EXPIRY_HOURS,
    downloadFilename?: string,
  ): string {
    if (!this.accountName || !this.accountKey) {
      throw new Error("Azure Blob Storage is not available");
    }

    // Cache key
    const cacheKey = `sas:${blobName}:${downloadFilename || ""}`;
    const cached = getCachedSas(cacheKey);
    if (cached) return cached;

    // Generate SAS token
    const expiresOn = new Date();
    expiresOn.setTime(expiresOn.getTime() + expiryHours * 60 * 60 * 1000);

    const credential = new StorageSharedKeyCredential(this.accountName, this.accountKey);

    const sasParams: any = {
      containerName: this.containerName,
      blobName,
      permissions: BlobSASPermissions.parse("r"),
      expiresOn,
    };

    if (downloadFilename) {
      sasParams.contentDisposition = `attachment; filename="${downloadFilename}"`;
    }

    const sasToken = generateBlobSASQueryParameters(sasParams, credential).toString();
    const signedUrl = `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${blobName}?${sasToken}`;

    // Cache for min(expiryHours, SAS_CACHE_HOURS) in milliseconds
    const cacheTtlMs = Math.min(expiryHours, SAS_CACHE_HOURS) * 60 * 60 * 1000;
    setCachedSas(cacheKey, signedUrl, cacheTtlMs);

    return signedUrl;
  }

  // -----------------------------------------------------------------------
  // Download
  // -----------------------------------------------------------------------

  /** Download the raw bytes of a blob as a Buffer. */
  async downloadFile(blobName: string): Promise<Buffer> {
    if (!this.containerClient) throw new Error("Azure Blob Storage is not available");

    const blockBlob = this.containerClient.getBlockBlobClient(blobName);
    const response = await blockBlob.download(0);

    if (!response.readableStreamBody) {
      throw new Error("No readable stream returned from Azure");
    }

    // Collect chunks into a Buffer
    const chunks: Buffer[] = [];
    for await (const chunk of response.readableStreamBody as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  /** Permanently delete a blob from Azure. */
  async deleteFile(blobName: string): Promise<boolean> {
    if (!this.containerClient) throw new Error("Azure Blob Storage is not available");

    const blockBlob = this.containerClient.getBlockBlobClient(blobName);
    await blockBlob.delete();

    // Invalidate cache
    for (const key of sasCache.keys()) {
      if (key.startsWith(`sas:${blobName}:`)) sasCache.delete(key);
    }

    return true;
  }

  // -----------------------------------------------------------------------
  // Exists / Properties
  // -----------------------------------------------------------------------

  /** Check if a blob exists in the container. */
  async fileExists(blobName: string): Promise<boolean> {
    if (!this.containerClient) return false;

    const blockBlob = this.containerClient.getBlockBlobClient(blobName);
    return blockBlob.exists();
  }

  /** Get blob metadata (size, content type, created date). */
  async getBlobProperties(blobName: string): Promise<{
    size: number;
    contentType: string;
    createdAt: Date | undefined;
    lastModified: Date | undefined;
  }> {
    if (!this.containerClient) throw new Error("Azure Blob Storage is not available");

    const blockBlob = this.containerClient.getBlockBlobClient(blobName);
    const props = await blockBlob.getProperties();

    return {
      size: props.contentLength || 0,
      contentType: props.contentType || "application/octet-stream",
      createdAt: props.createdOn,
      lastModified: props.lastModified,
    };
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

  /**
   * Resolve any stored media value to a fresh, displayable URL.
   *
   * Handles all four storage formats in the wild:
   *   1. Bare blob name  (e.g. "users/1/avatar/uuid.png")       → generates fresh SAS URL
   *   2. Azure SAS URL   (https://...blob.core.windows.net/…?sv=…) → extracts blob name, regenerates
   *   3. External URL    (Google OAuth avatar, picsum, etc.)        → returned as-is
   *   4. Local dev path  (/uploads/…)                              → returned as-is
   *   5. null / empty    → returns null
   */
  resolveMediaUrl(value: string | null | undefined): string | null {
    if (!value) return null;

    // Local /uploads/ path — development fallback
    if (value.startsWith("/")) return value;

    // Azure SAS URL — extract blob name and regenerate a fresh token
    if (value.includes(".blob.core.windows.net")) {
      const blobName = this.extractBlobName(value);
      if (blobName && this.isAvailable) {
        try {
          return this.getFileUrl(blobName);
        } catch {
          return value; // keep stale URL rather than breaking
        }
      }
      return value;
    }

    // External URL (Google, Gravatar, picsum, etc.) — return as-is
    if (value.startsWith("http")) return value;

    // Bare blob name (no protocol prefix) — generate fresh SAS URL
    if (this.isAvailable) {
      try {
        return this.getFileUrl(value);
      } catch {
        console.error("[BlobStorage] resolveMediaUrl failed for blob name:", value);
        return null;
      }
    }

    return value;
  }

  extractBlobName(sasUrl: string): string | null {
    try {
      const url = new URL(sasUrl);
      if (this.accountName && !url.hostname.includes(this.accountName + '.blob.core.windows.net')) {
        return null;
      }
      // pathname = /container/blob/path
      const pathParts = url.pathname.split("/").filter(Boolean);
      if (pathParts.length < 2) return null;
      // Remove container name (first segment)
      return pathParts.slice(1).join("/");
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton — import this everywhere
// ---------------------------------------------------------------------------

export const blobStorageService = new AzureBlobStorageService();

// Re-export the max file size for validation in routes
export const MAX_UPLOAD_SIZE = MAX_FILE_SIZE;
export const MAX_VIDEO_UPLOAD_SIZE = MAX_VIDEO_FILE_SIZE;
