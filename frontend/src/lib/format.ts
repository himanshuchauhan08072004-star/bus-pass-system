export function formatMoney(value: string | number | null | undefined, currency = "INR"): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );
}

export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Parses a YYYY-MM-DD string as a local calendar date (no timezone shift). */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(s: string): string {
  return parseDate(s).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<string, Tone> = {
  confirmed: "success",
  succeeded: "success",
  active: "success",
  approved: "success",
  pending: "warning",
  pending_payment: "warning",
  upcoming: "info",
  partially_refunded: "info",
  refunded: "info",
  cancelled: "neutral",
  expired: "neutral",
  revoked: "danger",
  rejected: "danger",
  failed: "danger",
};

export function statusTone(status: string): Tone {
  return TONES[status] ?? "neutral";
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
