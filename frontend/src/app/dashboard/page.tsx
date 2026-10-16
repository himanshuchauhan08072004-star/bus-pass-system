"use client";

import { Bell, CalendarClock, Compass, IdCard, Receipt, Ticket } from "lucide-react";
import Link from "next/link";
import { BookingRow } from "@/components/features/BookingRow";
import { PassCard } from "@/components/features/PassCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Alert, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/States";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import type { Dashboard } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch<Dashboard>("/dashboard");

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-48" />
      </div>
    );
  if (!data) return null;

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.full_name.split(" ")[0] ?? "traveller"}`}
        description="Your passes, upcoming journeys and recent activity."
        action={<ButtonLink href="/routes"><Compass className="h-4 w-4" aria-hidden /> Book a journey</ButtonLink>}
      />

      {data.reminders.length > 0 && (
        <div className="mb-6 space-y-2">
          {data.reminders.map((r) => (
            <Alert key={r} tone="warning"><span className="flex items-center gap-2"><Bell className="h-4 w-4 shrink-0" aria-hidden />{r}</span></Alert>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Confirmed trips" value={data.stats.confirmed_trips} icon={<Ticket className="h-5 w-5" />} />
        <StatCard label="Upcoming journeys" value={data.stats.upcoming_trips} icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard label="Pending applications" value={data.stats.pending_applications} icon={<IdCard className="h-5 w-5" />} />
        <StatCard label="Net spent" value={formatMoney(data.stats.net_spent)} icon={<Receipt className="h-5 w-5" />} hint="After refunds" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section aria-labelledby="pass-h">
          <h2 id="pass-h" className="mb-3 text-lg font-semibold">Active bus pass</h2>
          {data.active_pass ? (
            <PassCard pass={data.active_pass} compactQr />
          ) : (
            <EmptyState
              icon={<IdCard className="h-6 w-6" />}
              title="No active pass"
              message="Save on regular travel with a monthly, quarterly or annual pass."
              action={<ButtonLink href="/dashboard/passes" size="sm">Apply for a pass</ButtonLink>}
            />
          )}
        </section>
        <section aria-labelledby="quick-h">
          <h2 id="quick-h" className="mb-3 text-lg font-semibold">Quick actions</h2>
          <Card className="grid gap-2 p-4">
            {[
              { href: "/routes", label: "Search routes and book a ticket" },
              { href: "/dashboard/passes", label: "Apply for or renew a pass" },
              { href: "/dashboard/bookings", label: "View all bookings" },
              { href: "/verify", label: "Verify a ticket code" },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-surface2">{a.label} →</Link>
            ))}
          </Card>
        </section>
      </div>

      <section className="mt-8" aria-labelledby="up-h">
        <h2 id="up-h" className="mb-3 text-lg font-semibold">Upcoming journeys</h2>
        {data.upcoming_journeys.length ? (
          <div className="grid gap-2">{data.upcoming_journeys.map((b) => <BookingRow key={b.id} b={b} />)}</div>
        ) : (
          <EmptyState title="No upcoming journeys" message="Confirmed bookings for today or later will appear here." action={<ButtonLink href="/routes" size="sm" variant="secondary">Find a route</ButtonLink>} />
        )}
      </section>

      <section className="mt-8" aria-labelledby="rec-h">
        <Card>
          <CardHeader title={<span id="rec-h">Recent bookings</span>} action={<Link href="/dashboard/bookings" className="text-sm font-semibold text-brand">View all</Link>} />
          <div className="grid gap-2 p-4">
            {data.recent_bookings.length ? data.recent_bookings.map((b) => <BookingRow key={b.id} b={b} />) : <p className="py-6 text-center text-sm text-muted">No bookings yet.</p>}
          </div>
        </Card>
      </section>
    </>
  );
}
