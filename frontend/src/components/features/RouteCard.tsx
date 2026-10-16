import { ArrowRight, Clock, MapPin, Route as RouteIcon } from "lucide-react";
import Link from "next/link";
import { formatMoney, formatTime } from "@/lib/format";
import type { Route } from "@/lib/types";
import { ButtonLink } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

export function RouteCard({ route }: { route: Route }) {
  const seg = route.segment;
  const qs = seg ? `?from=${seg.from_stop_id}&to=${seg.to_stop_id}` : "";
  const first = route.stops[0]?.stop_name;
  const last = route.stops[route.stops.length - 1]?.stop_name;
  return (
    <Card className="p-5 transition-shadow hover:shadow-glow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="info">{route.code}</Badge>
            <h3 className="font-semibold">
              <Link href={`/routes/${route.id}${qs}`} className="hover:text-brand">{route.name}</Link>
            </h3>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="h-4 w-4" aria-hidden />
            {seg ? (
              <span>
                {seg.from_stop_name} <ArrowRight className="mx-1 inline h-3.5 w-3.5" aria-hidden /> {seg.to_stop_name}
              </span>
            ) : (
              <span>
                {first} <ArrowRight className="mx-1 inline h-3.5 w-3.5" aria-hidden /> {last}
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          {seg ? (
            <>
              <p className="text-xs text-muted">Fare per person</p>
              <p className="text-xl font-bold">{formatMoney(seg.unit_fare)}</p>
            </>
          ) : route.fare ? (
            <>
              <p className="text-xs text-muted">Fares from</p>
              <p className="text-xl font-bold">{formatMoney(route.fare.min_fare)}</p>
            </>
          ) : null}
        </div>
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
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
      </dl>
      <div className="mt-4 flex justify-end">
        <ButtonLink href={`/routes/${route.id}${qs}`} size="sm">View &amp; book</ButtonLink>
      </div>
    </Card>
  );
}
