import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/format";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn("rounded-3xl border border-line/70 bg-surface/90 shadow-card", className)} />;
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/60 px-6 py-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{label}</span>
        {icon && <span className="text-brand" aria-hidden>{icon}</span>}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

/** One calm panel of figures separated by hairlines, instead of a wall of big cards. */
export function StatStrip({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }[] }) {
  return (
    <Card className="grid grid-cols-2 divide-line/60 lg:grid-cols-4 lg:divide-x">
      {items.map((i, idx) => (
        <div key={i.label} className={`px-5 py-4 ${idx >= 2 ? "border-t border-line/60 lg:border-t-0" : ""}`}>
          <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wider text-muted">
            <span>{i.label}</span>
            {i.icon && <span className="text-brand" aria-hidden>{i.icon}</span>}
          </div>
          <div className="mt-1.5 font-display text-2xl font-semibold tracking-tight">{i.value}</div>
          {i.hint && <div className="text-xs text-muted">{i.hint}</div>}
        </div>
      ))}
    </Card>
  );
}
