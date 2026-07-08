/**
 * TLS/SSL provisioning for custom domains, via the Vercel Domains API.
 *
 * Vercel issues and renews certificates automatically for any domain
 * attached to a project once DNS correctly points at Vercel — this module
 * just drives that: attach the domain, then poll until Vercel reports it as
 * verified and correctly configured.
 *
 * Requires VERCEL_TOKEN + VERCEL_PROJECT_ID (and VERCEL_TEAM_ID if the
 * project lives under a team) to be set in the environment. When they
 * aren't, `getSslProvider()` returns null — callers must treat that as "SSL
 * provisioning isn't configured yet" and hold the domain in a distinct
 * failure state, never silently mark it active.
 */

const VERCEL_API = "https://api.vercel.com";

export interface DomainProviderStatus {
  /** Vercel's own ownership/DNS-target verification (separate from our TXT ownership check). */
  verified: boolean;
  /** True if Vercel can see the domain but DNS isn't correctly pointed at it yet. */
  misconfigured: boolean;
  providerId: string;
}

export interface DomainSslProvider {
  attach(domain: string): Promise<{ providerId: string }>;
  getStatus(domain: string): Promise<DomainProviderStatus>;
  detach(domain: string): Promise<void>;
}

class VercelDomainProvider implements DomainSslProvider {
  constructor(
    private readonly token: string,
    private readonly projectId: string,
    private readonly teamId?: string
  ) {}

  private url(path: string): string {
    const url = new URL(`${VERCEL_API}${path}`);
    if (this.teamId) url.searchParams.set("teamId", this.teamId);
    return url.toString();
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" };
  }

  async attach(domain: string): Promise<{ providerId: string }> {
    const res = await fetch(this.url(`/v10/projects/${this.projectId}/domains`), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ name: domain }),
    });
    if (res.ok) return { providerId: domain };

    const body = await res.json().catch(() => ({}));
    // Already attached to this same project — not an error, treat as success.
    if (res.status === 409 && body?.error?.code === "domain_already_in_use") {
      return { providerId: domain };
    }
    throw new Error(body?.error?.message || `Vercel domain attach failed (${res.status})`);
  }

  async getStatus(domain: string): Promise<DomainProviderStatus> {
    const res = await fetch(this.url(`/v9/projects/${this.projectId}/domains/${domain}`), {
      headers: this.headers(),
    });
    if (res.status === 404) {
      return { verified: false, misconfigured: true, providerId: domain };
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Vercel domain status check failed (${res.status})`);
    }
    const data = await res.json();

    const configRes = await fetch(this.url(`/v6/domains/${domain}/config`), { headers: this.headers() });
    const config = configRes.ok ? await configRes.json() : { misconfigured: true };

    return {
      verified: !!data.verified,
      misconfigured: !!config.misconfigured,
      providerId: domain,
    };
  }

  async detach(domain: string): Promise<void> {
    const res = await fetch(this.url(`/v9/projects/${this.projectId}/domains/${domain}`), {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok && res.status !== 404) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Vercel domain detach failed (${res.status})`);
    }
  }
}

let cached: DomainSslProvider | null | undefined;

/** Returns null when VERCEL_TOKEN/VERCEL_PROJECT_ID aren't configured — never fakes a provider. */
export function getSslProvider(): DomainSslProvider | null {
  if (cached !== undefined) return cached;
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  cached = token && projectId ? new VercelDomainProvider(token, projectId, process.env.VERCEL_TEAM_ID) : null;
  return cached;
}
