import { CalendarCheck } from "lucide-react";
import { cn, formatDate } from "@/lib/format";
import type { BusPass } from "@/lib/types";
import { LogoMark } from "../layout/Logo";
import { StatusBadge } from "../ui/Badge";
import { QrBox } from "./Qr";

/** Card surface per real pass status. Only a genuinely active pass gets the full-colour treatment. */
const SURFACE: Record<BusPass["status"], string> = {
  active: "from-sage/70 via-surface to-peach/50 border-brand/25",
  upcoming: "from-peach/50 via-surface to-sage/40 border-line",
  expired: "from-surface2 via-surface to-surface2 border-line opacity-90 saturate-50",
  revoked: "from-danger/10 via-surface to-surface2 border-danger/30 saturate-50",
};

export function PassCard({ pass, actions, compactQr, holder }: { pass: BusPass; actions?: React.ReactNode; compactQr?: boolean; holder?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[2rem] border bg-gradient-to-br p-6 shadow-card", SURFACE[pass.status])}>
      {/* transport motif: a faint route line with stops */}
      <svg className="pointer-events-none absolute -bottom-6 -left-4 w-[22rem] text-brand opacity-[0.09]" viewBox="0 0 360 90" aria-hidden>
        <path d="M0 70 C 60 70, 70 20, 130 20 S 220 62, 270 40 S 340 14, 360 14" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        {[[130, 20], [270, 40]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="8" fill="currentColor" />)}
      </svg>
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">TransitFlow pass</span>
            <StatusBadge status={pass.status} />
          </div>
          <h3 className="font-display text-2xl font-semibold tracking-tight">{pass.pass_type_name}</h3>
          {holder && <p className="text-sm font-medium">{holder}</p>}
          <p className="font-mono text-sm tracking-wider text-muted">{pass.pass_code}</p>
          <p className="flex items-center gap-2 text-sm">
            <CalendarCheck className="h-4 w-4 text-brand" aria-hidden />
            {formatDate(pass.valid_from)} – {formatDate(pass.valid_to)}
          </p>
          {pass.status === "active" && (
            <p className={`text-sm font-semibold ${pass.days_left <= 7 ? "text-warning" : "text-success"}`}>
              {pass.days_left === 0 ? "Expires today" : `${pass.days_left} day${pass.days_left === 1 ? "" : "s"} left`}
            </p>
          )}
          {pass.status === "upcoming" && <p className="text-sm font-semibold text-muted">Starts {formatDate(pass.valid_from)}</p>}
          {pass.status === "expired" && <p className="text-sm font-semibold text-muted">Expired {formatDate(pass.valid_to)}</p>}
          {actions}
        </div>
        {pass.qr_token ? (
          <QrBox value={pass.qr_token} size={compactQr ? 112 : 148} label={`QR code for pass ${pass.pass_code}`} />
        ) : (
          <p className="max-w-[10rem] rounded-2xl bg-surface2/70 p-3 text-xs text-muted">QR code is shown only for active or upcoming passes.</p>
        )}
      </div>
    </div>
  );
}
