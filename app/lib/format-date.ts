// Reads the user's saved timezone from localStorage, falling back to the
// system's detected timezone.
export function getUserTimezone(): string {
  if (typeof window === "undefined") return "UTC";
  return (
    localStorage.getItem("albiz-tz") ??
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
}

// "Jan 15, 2026" in the user's timezone
export function formatDate(date: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

// "Jan 15, 2026, 3:42 PM" in the user's timezone
export function formatDatetime(date: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// "3:42 PM" in the user's timezone
export function formatTime(date: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}