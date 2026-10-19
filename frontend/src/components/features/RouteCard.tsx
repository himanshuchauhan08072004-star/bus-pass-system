import { ArrowRight, Clock, Route as RouteIcon } from "lucide-react";
import Link from "next/link";
import { formatMoney, formatTime } from "@/lib/format";
import type { Route } from "@/lib/types";
import { Badge } from "../ui/Badge";
import { ButtonLink } from "../ui/Button";
import { Card } from "../ui/Card";

export function RouteCard({ route }: { route: Route }) {
  const seg = route.segment;
  const qs = seg ? `?from=${seg.from_stop_id}&to=${seg.to_stop_id}` : "";
  const first = seg?.from_stop_name ?? route.stops[0]?.stop_name;
  const last = seg?.to_stop_name ?? route.stops[route.stops.length - 1]?.stop_name;
  return (
    <Card className="p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{route.code}</Badge>
            <h3 className="font-display text-lg font-semibold">
              <Link href={`/routes/${route.id}${qs}`} className="hover:text-brand">{route.name}</Link>
            </h3>
          </div>
          {/* origin ---- destination timeline */}
          <div className="mt-4 flex items-center gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{first}</span>
            <span className="flex min-w-6 flex-1 items-center" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full border-2 border-brand bg-surface" />
              <span className="h-px flex-1 border-t border-dashed border-brand/50" />
              <ArrowRight className="h-3.5 w-3.5 text-brand" />
            </span>
            <span className="min-w-0 truncate font-medium">{last}</span>
          </div>
        </div>
        <div className="text-right">
          {seg ? (
            <>
              <p className="text-xs text-muted">Fare per person</p>
              <p className="font-display text-2xl font-semibold">{formatMoney(seg.unit_fare)}</p>
            </>
          ) : route.fare ? (
            <>
              <p className="text-xs text-muted">Fares from</p>
              <p className="font-display text-2xl font-semibold">{formatMoney(route.fare.min_fare)}</p>
            </>
          ) : null}
        </div>
      </div>
      <dl className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line/60 pt-4 text-sm text-muted">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" aria-hidden />
          <dt className="sr-only">Operating hours</dt>
          <dd>{formatTime(route.operating_start)} – {formatTime(route.operating_end)}</dd>
        </div>
        <div><dt className="inline">Every </dt><dd className="inline font-medium text-fg">{route.frequency_minutes} min</dd></div>
        <div className="flex items-center gap-1.5">
          <RouteIcon className="h-4 w-4" aria-hidden />
          <dd>{route.stops.length} stops · {Number(seg?.distance_km ?? route.total_distance_km).toFixed(1)} km</dd>
        </div>
        <div className="ml-auto">
          <ButtonLink href={`/routes/${route.id}${qs}`} size="sm">View &amp; book</ButtonLink>
        </div>
      </dl>
    </Card>
  );
}
