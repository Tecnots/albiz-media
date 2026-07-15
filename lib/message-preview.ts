// Shared conversation-list preview text derivation, used by the send route and
// the edit/delete preview refresh so attachments (including voice messages)
// always show a readable label instead of a raw filename or empty string.

export function attachmentPreviewLabel(
  attachmentType?: string | null,
  attachmentName?: string | null
): string {
  switch (attachmentType) {
    case "image":
      return "Photo";
    case "video":
      return "Video";
    case "document":
      return "Document";
    case "audio":
      return attachmentName && attachmentName.startsWith("voice-message") ? "Voice message" : "Audio";
    default:
      return "Attachment";
  }
}

export function messagePreview(opts: {
  text?: string | null;
  encrypted?: boolean;
  attachmentType?: string | null;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
}): string {
  // Ciphertext must never surface in a preview.
  if (opts.encrypted) return "";

  const text = (opts.text ?? "").trim();
  if (text.startsWith("{")) {
    try {
      const p = JSON.parse(text);
      if (p?.type === "story_reply") return p.text || "Story reply";
    } catch {}
  }
  if (text) return text;

  if (opts.attachmentUrl || opts.attachmentType) {
    return attachmentPreviewLabel(opts.attachmentType, opts.attachmentName);
  }
  return "";
}
