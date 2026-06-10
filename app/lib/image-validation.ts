export interface ImageValidationResult {
  valid: boolean;
  message?: string;
  width?: number;
  height?: number;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MIN_DIM = 320;
const MAX_DIM = 8192;

export async function validateImage(file: File): Promise<ImageValidationResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, message: "Only JPEG, PNG and WebP are supported." };
  }
  if (file.size > MAX_SIZE) {
    return { valid: false, message: "Image must be under 10 MB." };
  }
  try {
    const { width, height } = await readDimensions(file);
    if (width < MIN_DIM || height < MIN_DIM) {
      return { valid: false, message: `Image must be at least ${MIN_DIM}×${MIN_DIM} px.` };
    }
    if (width > MAX_DIM || height > MAX_DIM) {
      return { valid: false, message: "Image exceeds maximum allowed dimensions." };
    }
    return { valid: true, width, height };
  } catch {
    return { valid: false, message: "Could not read image file." };
  }
}

function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject();
    };
    img.src = url;
  });
}
