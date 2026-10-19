"use client";

import { ArrowUpRight, Bell, CalendarClock, Compass, IdCard, Receipt, RefreshCw, Ticket, UserCircle } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { BookingRow } from "@/components/features/BookingRow";
import { BusIllustration } from "@/components/features/BusIllustration";
import { PassCard } from "@/components/features/PassCard";
import { Reveal } from "@/components/features/Reveal";
import { SearchForm } from "@/components/features/SearchForm";
import { StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, StatStrip } from "@/components/ui/Card";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useAuth } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import type { Application, Dashboard } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";
import { useRouter } from "next/navigation";

const QUICK = [
  { href: "/dashboard/passes", label: "Apply for a pass", icon: IdCard },
  { href: "/dashboard/passes", label: "Renew a pass", icon: RefreshCw },
  { href: "/routes", label: "Book a ticket", icon: Ticket },
  { href: "/dashboard/bookings", label: "View bookings", icon: CalendarClock },
  { href: "/dashboard/profile", label: "Manage profile", icon: UserCircle },
];

interface Activity {
  key: string;
  at: string;
  title: string;
  detail: string;
  status: string;
  href: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, error, loading, reload } = useFetch<Dashboard>("/dashboard");
  const apps = useFetch<Application[]>("/passes/applications");

  // Real bookings and pass applications only, newest first.
  const activity = useMemo<Activity[]>(() => {
    const items: Activity[] = [];
    for (const b of data?.recent_bookings ?? []) {
      items.push({ key: `b${b.id}`, at: b.created_at, title: `${b.from_stop_name} to ${b.to_stop_name}`, detail: `Booking ${b.reference}`, status: b.status, href: `/dashboard/bookings/${b.id}` });
    }
    for (const a of apps.data ?? []) {
      items.push({ key: `a${a.id}`, at: a.created_at, title: `${a.pass_type_name} ${a.is_renewal ? "renewal" : "application"}`, detail: `${formatMoney(a.price)} · ${formatDate(a.created_at.slice(0, 10))}`, status: a.status, href: "/dashboard/passes" });
    }
    return items.sort((x, y) => y.at.localeCompare(x.at)).slice(0, 6);
  }, [data, apps.data]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data)
    return (
      <div className="space-y-5">
        <Skeleton className="h-64 rounded-[2rem]" />
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  if (!data) return null;

  const first = user?.full_name.split(" ")[0] ?? "traveller";
  const pass = data.active_pass;

  return (
    <div className="space-y-8">
      <Reveal>
        <section className="relative overflow-hidden rounded-[2rem] border border-line/60 bg-gradient-to-br from-sage/60 via-surface to-peach/50 p-6 sm:p-9">
          <div className="hero-grid absolute inset-0" aria-hidden />
          <div className="relative grid items-center gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Passenger home</p>
              <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Hello, <span className="italic text-brand">{first}</span>
              </h1>
              <p className="mt-2 max-w-md text-sm text-muted">Where to next? Search a route and book in a few taps.</p>
              <div className="mt-6 rounded-3xl border border-line/60 bg-surface/90 p-4 shadow-card sm:p-5">
                <SearchForm onSearch={(o, d) => {
                  const p = new URLSearchParams();
                  if (o) p.set("origin", o);
                  if (d) p.set("destination", d);
                  router.push(`/routes${p.toString() ? `?${p}` : ""}`);
                }} />
              </div>
            </div>
            <BusIllustration className="mx-auto hidden max-w-sm sm:block lg:max-w-none" />
          </div>
        </section>
      </Reveal>

      {data.reminders.length > 0 && (
        <div className="space-y-2">
          {data.reminders.map((r) => (
            <Alert key={r} tone="warning"><span className="flex items-center gap-2"><Bell className="h-4 w-4 shrink-0" aria-hidden />{r}</span></Alert>
          ))}
        </div>
      )}

      <Reveal>
        <StatStrip
          items={[
            { label: "Confirmed trips", value: data.stats.confirmed_trips, icon: <Ticket className="h-4 w-4" /> },
            { label: "Upcoming", value: data.stats.upcoming_trips, icon: <CalendarClock className="h-4 w-4" /> },
            { label: "Pending applications", value: data.stats.pending_applications, icon: <IdCard className="h-4 w-4" /> },
            { label: "Net spent", value: formatMoney(data.stats.net_spent), hint: "After refunds", icon: <Receipt className="h-4 w-4" /> },
          ]}
        />
      </Reveal>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <Reveal>
          <section aria-labelledby="pass-h">
            <h2 id="pass-h" className="mb-3 font-display text-2xl font-semibold tracking-tight">My active pass</h2>
            {pass ? (
              <PassCard
                pass={pass}
                compactQr
                holder={user?.full_name}
                actions={
                  <div className="flex flex-wrap gap-2 pt-1 no-print">
                    <ButtonLink href="/dashboard/passes" size="sm" variant="secondary">View pass</ButtonLink>
                    {pass.can_renew && <ButtonLink href="/dashboard/passes" size="sm"><RefreshCw className="h-4 w-4" aria-hidden /> Renew pass</ButtonLink>}
                  </div>
                }
              />
            ) : (
              <EmptyState
                icon={<IdCard className="h-6 w-6" />}
                title="No active pass"
                message="Save on regular travel with a monthly, quarterly or annual pass."
                action={<ButtonLink href="/dashboard/passes" size="sm">Apply for a pass</ButtonLink>}
              />
            )}
          </section>
        </Reveal>
        <Reveal delay={0.08}>
          <section aria-labelledby="quick-h">
            <h2 id="quick-h" className="mb-3 font-display text-2xl font-semibold tracking-tight">Quick actions</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {QUICK.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="group flex items-center justify-between gap-3 rounded-3xl border border-line/70 bg-surface/90 px-4 py-4 text-sm font-semibold transition-all duration-200 hover:-translate-y-px hover:border-brand/40 hover:shadow-card"
                >
                  <span className="flex items-center gap-3">
                    <span className="rounded-2xl bg-sage/60 p-2.5 text-brand" aria-hidden><a.icon className="h-4 w-4" /></span>
                    {a.label}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                </Link>
              ))}
              <Link href="/routes" className="flex items-center gap-3 rounded-3xl bg-brand px-4 py-4 text-sm font-semibold text-brand-fg shadow-glow transition-all hover:opacity-90">
                <Compass className="h-4 w-4" aria-hidden /> Explore routes
              </Link>
            </div>
          </section>
        </Reveal>
      </div>

      <Reveal>
        <section aria-labelledby="up-h">
          <h2 id="up-h" className="mb-3 font-display text-2xl font-semibold tracking-tight">Upcoming journeys</h2>
          {data.upcoming_journeys.length ? (
            <div className="grid gap-3">{data.upcoming_journeys.map((b) => <BookingRow key={b.id} b={b} />)}</div>
          ) : (
            <EmptyState icon={<Ticket className="h-6 w-6" />} title="No upcoming journeys" message="Confirmed bookings for today or later will appear here." action={<ButtonLink href="/routes" size="sm" variant="secondary">Find a route</ButtonLink>} />
          )}
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="rec-h">
          <Card>
            <CardHeader title={<span id="rec-h">Recent activity</span>} subtitle="Bookings and pass applications" action={<Link href="/dashboard/bookings" className="text-sm font-semibold text-brand">All bookings</Link>} />
            {activity.length ? (
              <ul className="divide-y divide-line/60">
                {activity.map((a) => (
                  <li key={a.key}>
                    <Link href={a.href} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3.5 transition-colors hover:bg-sage/20">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{a.title}</span>
                        <span className="block font-mono text-xs text-muted">{a.detail}</span>
                      </span>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-10 text-center text-sm text-muted">No activity yet. Book a journey or apply for a pass to get started.</p>
            )}
          </Card>
        </section>
      </Reveal>
    </div>
  );
}
