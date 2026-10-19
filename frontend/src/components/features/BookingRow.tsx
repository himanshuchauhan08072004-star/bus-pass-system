import { ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { StatusBadge } from "../ui/Badge";

export function BookingRow({ b }: { b: Booking }) {
  return (
    <Link
      href={`/dashboard/bookings/${b.id}`}
      className="group flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line/70 bg-surface/90 px-5 py-4 transition-all duration-200 hover:-translate-y-px hover:border-brand/40 hover:shadow-card"
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-display text-base font-semibold">
          <span className="truncate">{b.from_stop_name}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
          <span className="truncate">{b.to_stop_name}</span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted">
          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{formatDate(b.travel_date)} · {formatTime(b.departure_time)}</span>
          <span className="font-mono">{b.reference}</span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold">{formatMoney(b.total_fare)}</span>
        <StatusBadge status={b.status} />
      </div>
    </Link>
  );
}
