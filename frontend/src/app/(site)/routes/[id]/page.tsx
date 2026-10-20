"use client";

import { Info, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { PaymentModal } from "@/components/features/PaymentModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Alert, ErrorState, Skeleton } from "@/components/ui/States";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addDays, formatMoney, formatTime, toDateInput } from "@/lib/format";
import type { Booking, FareQuote, Route } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";

function BookingPanel({ route }: { route: Route }) {
  const { user } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const stops = route.stops;
  const [from, setFrom] = useState<number>(Number(sp.get("from")) || stops[0].stop_id);
  const [to, setTo] = useState<number>(Number(sp.get("to")) || stops[stops.length - 1].stop_id);
  const today = useMemo(() => new Date(), []);
  const [date, setDate] = useState(toDateInput(addDays(today, 1)));
  const [time, setTime] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);

  const fromSeq = stops.find((s) => s.stop_id === from)?.sequence ?? 0;
  const toSeq = stops.find((s) => s.stop_id === to)?.sequence ?? 0;
  const validStops = fromSeq > 0 && toSeq > fromSeq;

  const quote = useFetch<FareQuote>(validStops ? "/fare-quote" : null, { route_id: route.id, from_stop_id: from, to_stop_id: to, passengers });
  const departures = useFetch<{ times: string[] }>(date ? `/routes/${route.id}/departures` : null, { date });

  useEffect(() => {
    const times = departures.data?.times ?? [];
    if (times.length === 0) setTime("");
    else if (!times.includes(time)) setTime(times[0]);
  }, [departures.data, time]);

  async function book() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/routes/${route.id}?from=${from}&to=${to}`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const b = await api<Booking>("/bookings", {
        method: "POST",
        body: { route_id: route.id, from_stop_id: from, to_stop_id: to, travel_date: date, departure_time: time.slice(0, 5), passengers },
      });
      setBooking(b);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const goToBooking = () => booking && router.push(`/dashboard/bookings/${booking.id}`);

  return (
    <Card>
      <CardHeader title="Book this route" subtitle="The fare is calculated by our server." />
      <div className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="From" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
            {stops.map((s) => <option key={s.stop_id} value={s.stop_id}>{s.stop_name}</option>)}
          </Select>
          <Select label="To" value={to} onChange={(e) => setTo(Number(e.target.value))} error={!validStops ? "Destination must come after the origin" : undefined}>
            {stops.map((s) => <option key={s.stop_id} value={s.stop_id}>{s.stop_name}</option>)}
          </Select>
          <Input label="Travel date" type="date" min={toDateInput(today)} max={toDateInput(addDays(today, 30))} value={date} onChange={(e) => setDate(e.target.value)} />
          <Select label="Departure" value={time} onChange={(e) => setTime(e.target.value)} disabled={!departures.data?.times.length}>
            {(departures.data?.times ?? []).map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
            {departures.data && departures.data.times.length === 0 && <option value="">No departures left</option>}
          </Select>
          <Select label="Passengers" value={passengers} onChange={(e) => setPassengers(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>

        <div className="rounded-xl bg-surface2 p-4" aria-live="polite">
          {quote.loading ? (
            <Skeleton className="h-12" />
          ) : quote.error ? (
            <p className="text-sm text-danger">{quote.error}</p>
          ) : quote.data ? (
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted">{Number(quote.data.distance_km).toFixed(1)} km · {formatMoney(quote.data.unit_fare)} per person</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><Users className="h-4 w-4" aria-hidden /> {passengers} passenger{passengers > 1 ? "s" : ""}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">Total fare</p>
                <p className="text-3xl font-extrabold tracking-tight">{formatMoney(quote.data.total_fare)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Choose valid stops to see the fare.</p>
          )}
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
        <Button size="lg" className="w-full" loading={busy} disabled={!validStops || !time || !quote.data} onClick={book}>
          {user ? "Confirm booking" : "Sign in to book"}
        </Button>
        <p className="flex items-start gap-2 text-xs text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Your seat is held for 15 minutes while you pay. Cancel 24+ hours before departure for a full refund, 2–24 hours for 50%.
        </p>
      </div>
      <PaymentModal
        open={!!booking}
        onClose={goToBooking}
        payment={booking?.payment ?? null}
        title={booking ? `${route.code} · ${booking.from_stop_name} to ${booking.to_stop_name}` : ""}
        onPaid={goToBooking}
      />
    </Card>
  );
}

function RouteDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: route, error, loading, reload } = useFetch<Route>(`/routes/${id}`);

  if (loading && !route) return <div className="mx-auto max-w-6xl px-4 py-10"><Skeleton className="h-96" /></div>;
  if (error || !route) return <div className="mx-auto max-w-xl px-4 py-16"><ErrorState message={error ?? "Route not found"} onRetry={reload} /></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link href="/routes" className="hover:text-fg">Routes</Link> <span aria-hidden>/</span> <span className="text-fg">{route.code}</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge tone="info">{route.code}</Badge>
        <h1 className="text-2xl font-bold tracking-tight">{route.name}</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Operating information" />
            <dl className="grid gap-4 p-5 sm:grid-cols-3">
              <div><dt className="text-xs text-muted">Hours</dt><dd className="font-semibold">{formatTime(route.operating_start)} – {formatTime(route.operating_end)}</dd></div>
              <div><dt className="text-xs text-muted">Frequency</dt><dd className="font-semibold">Every {route.frequency_minutes} minutes</dd></div>
              <div><dt className="text-xs text-muted">Length</dt><dd className="font-semibold">{Number(route.total_distance_km).toFixed(1)} km · {route.stops.length} stops</dd></div>
            </dl>
          </Card>
          {route.fare && (
            <Card>
              <CardHeader title="Fare structure" subtitle="Fare = base + rate × distance, never less than the minimum." />
              <dl className="grid gap-4 p-5 sm:grid-cols-3">
                <div><dt className="text-xs text-muted">Base fare</dt><dd className="font-semibold">{formatMoney(route.fare.base_fare)}</dd></div>
                <div><dt className="text-xs text-muted">Per kilometre</dt><dd className="font-semibold">{formatMoney(route.fare.per_km_rate)}</dd></div>
                <div><dt className="text-xs text-muted">Minimum fare</dt><dd className="font-semibold">{formatMoney(route.fare.min_fare)}</dd></div>
              </dl>
            </Card>
          )}
          <Card>
            <CardHeader title="Stops" />
            <ol className="p-5">
              {route.stops.map((s, i) => (
                <li key={s.stop_id} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < route.stops.length - 1 && <span className="absolute left-[7px] top-4 h-full w-0.5 bg-line" aria-hidden />}
                  <span className="relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-4 border-brand bg-surface" aria-hidden />
                  <div className="flex flex-1 items-baseline justify-between gap-3">
                    <div>
                      <p className="font-medium">{s.stop_name}</p>
                      <p className="text-xs text-muted">{s.city}</p>
                    </div>
                    <p className="text-sm text-muted">{Number(s.distance_km).toFixed(1)} km</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <BookingPanel route={route} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function RouteDetailPage() {
  return <RouteDetail />;
}
