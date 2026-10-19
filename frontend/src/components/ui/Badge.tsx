import { cn, statusLabel, statusTone, type Tone } from "@/lib/format";

const tones: Record<Tone, string> = {
  neutral: "bg-surface2/70 text-muted border-line",
  info: "bg-sage/50 text-brand border-brand/20",
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-peach/50 text-warning border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/30",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}
