import { CalendarCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { BusPass } from "@/lib/types";
import { StatusBadge } from "../ui/Badge";
import { QrBox } from "./Qr";

export function PassCard({ pass, actions, compactQr }: { pass: BusPass; actions?: React.ReactNode; compactQr?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/15 via-surface to-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={pass.status} />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">TransitFlow pass</span>
          </div>
          <h3 className="text-xl font-bold tracking-tight">{pass.pass_type_name}</h3>
          <p className="font-mono text-sm text-muted">{pass.pass_code}</p>
          <p className="flex items-center gap-2 text-sm">
            <CalendarCheck className="h-4 w-4 text-brand" aria-hidden />
            {formatDate(pass.valid_from)} – {formatDate(pass.valid_to)}
          </p>
          {pass.status === "active" && (
            <p className={`text-sm font-semibold ${pass.days_left <= 7 ? "text-warning" : "text-success"}`}>
              {pass.days_left === 0 ? "Expires today" : `${pass.days_left} day${pass.days_left === 1 ? "" : "s"} left`}
            </p>
          )}
          {actions}
        </div>
        {pass.qr_token ? (
          <QrBox value={pass.qr_token} size={compactQr ? 112 : 148} label={`QR code for pass ${pass.pass_code}`} />
        ) : (
          <p className="max-w-[10rem] rounded-xl bg-surface2 p-3 text-xs text-muted">QR code is shown only for active or upcoming passes.</p>
        )}
      </div>
    </div>
  );
}
