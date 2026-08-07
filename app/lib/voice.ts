// Voice-recording capability detection, microphone permission handling, and
// audio-format selection. Kept framework-agnostic so it can be unit-checked and
// reused. All browser APIs are guarded so importing this never throws on the
// server or on unsupported platforms.

import { isNative } from "./capacitor";

export type MicPermissionState = "granted" | "denied" | "prompt" | "unsupported";

export type MicErrorKind =
  | "denied" // prompt dismissed this time
  | "blocked" // permanently blocked (must be re-enabled in settings)
  | "no-device" // no microphone hardware
  | "busy" // device held by another app
  | "insecure" // page isn't a secure context
  | "unsupported" // recording API unavailable
  | "unknown";

// User-facing guidance per state — shown instead of a generic error.
export const MIC_GUIDANCE: Record<MicErrorKind, string> = {
  denied: "Microphone access was dismissed. Tap the mic and choose Allow to record.",
  blocked: "Microphone access is blocked. Enable it for this app in your settings, then try again.",
  "no-device": "No microphone was found. Connect one and try again.",
  busy: "Your microphone is in use by another app. Close it and try again.",
  insecure: "Voice recording needs a secure (HTTPS) connection.",
  unsupported: "Voice recording isn't supported on this browser.",
  unknown: "Couldn't start recording. Please try again.",
};

// Ordered by preference; the first the platform's MediaRecorder supports wins.
// Covers webm/opus (Chrome, Firefox, Android WebView) and mp4/aac (Safari,
// iOS WKWebView). Every extension here is accepted by the upload route.
const AUDIO_MIME_CANDIDATES: { mimeType: string; ext: string }[] = [
  { mimeType: "audio/webm;codecs=opus", ext: "webm" },
  { mimeType: "audio/webm", ext: "webm" },
  { mimeType: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" },
  { mimeType: "audio/mp4", ext: "m4a" },
  { mimeType: "audio/aac", ext: "aac" },
  { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
  { mimeType: "audio/ogg", ext: "ogg" },
];

export function isSecureForMedia(): boolean {
  if (typeof window === "undefined") return false;
  // Native WebViews mediate permission through the OS, not the web origin.
  if (isNative) return true;
  return window.isSecureContext === true;
}

export function isVoiceRecordingSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const hasGetUserMedia = !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function");
  const hasRecorder = typeof window.MediaRecorder !== "undefined";
  return hasGetUserMedia && hasRecorder && isSecureForMedia();
}

// Why recording is unavailable, for choosing the right guidance up front.
export function unavailableReason(): MicErrorKind | null {
  if (isVoiceRecordingSupported()) return null;
  if (typeof window !== "undefined" && !isSecureForMedia()) return "insecure";
  return "unsupported";
}

export function pickAudioMime(): { mimeType: string; ext: string } {
  if (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    typeof MediaRecorder.isTypeSupported === "function"
  ) {
    for (const candidate of AUDIO_MIME_CANDIDATES) {
      if (MediaRecorder.isTypeSupported(candidate.mimeType)) return candidate;
    }
  }
  // Let the browser pick its own default container (pass "" to MediaRecorder).
  return { mimeType: "", ext: "webm" };
}

// Best-effort permission read. The Permissions API lacks "microphone" on some
// browsers (notably Safari), where we return "prompt" and rely on the request.
export async function queryMicPermission(): Promise<MicPermissionState> {
  if (!isVoiceRecordingSupported()) return "unsupported";
  try {
    const perms = (navigator as unknown as { permissions?: { query?: (d: { name: PermissionName }) => Promise<PermissionStatus> } }).permissions;
    if (perms?.query) {
      const status = await perms.query({ name: "microphone" as PermissionName });
      if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
        return status.state;
      }
    }
  } catch {
    // Permission name unsupported — fall through to "prompt".
  }
  return "prompt";
}

// Classify a getUserMedia rejection. When the error is a permission error,
// post-checks the Permissions API and native platform state to distinguish a
// one-time dismissal ("denied") from a permanent OS-level block ("blocked").
export async function classifyMicError(err: unknown): Promise<MicErrorKind> {
  if (typeof window !== "undefined" && !isSecureForMedia()) return "insecure";
  if (!isVoiceRecordingSupported()) return "unsupported";
  const name = (err as { name?: string })?.name;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDismissedError": {
      // On native (Capacitor WebView), navigator.permissions.query is
      // unreliable — it may report "denied" even before the OS has shown
      // the permission dialog. We can't distinguish "not yet asked" from
      // "permanently blocked" without a native plugin, so always treat it
      // as re-promptable. The OS will either re-show the prompt or silently
      // deny; in both cases, saying "tap mic again" is the correct guidance.
      if (isNative) return "denied";

      // On web, the Permissions API is authoritative. "denied" means the
      // user clicked "Block" in the browser UI — they must change it in
      // site settings. "prompt" means they dismissed the dialog without
      // choosing, so the browser will re-prompt on the next attempt.
      const perm = await queryMicPermission();
      return perm === "denied" ? "blocked" : "denied";
    }
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "no-device";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "busy";
    case "TypeError":
      return "unsupported";
    default:
      return "unknown";
  }
}

export async function acquireMicStream(): Promise<MediaStream> {
  if (!isVoiceRecordingSupported()) {
    const err = new Error("unsupported");
    err.name = isSecureForMedia() ? "TypeError" : "SecurityError";
    throw err;
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
}
