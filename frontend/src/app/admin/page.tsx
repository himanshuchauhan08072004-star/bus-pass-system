"use client";

import { Activity, Bus, CreditCard, IdCard, Map, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Alert, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/States";
import { formatDateTime, formatMoney, statusLabel } from "@/lib/format";
import type { AdminStats } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-success",
  pending_payment: "bg-warning",
  cancelled: "bg-muted",
  expired: "bg-line",
};

export default function AdminOverview() {
  const { data, error, loading, reload } = useFetch<AdminStats>("/admin/stats");
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (!data) return null;

  const total = Object.values(data.bookings_by_status).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title="Operations overview" description="Live figures from the production database." />
      {data.pending_applications > 0 && (
        <div className="mb-6">
          <Alert tone="warning">
            {data.pending_applications} pass application{data.pending_applications > 1 ? "s" : ""} awaiting review. <Link href="/admin/passes" className="font-semibold text-brand">Review now →</Link>
          </Alert>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total passengers" value={data.total_passengers} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Active passes" value={data.active_passes} icon={<IdCard className="h-5 w-5" />} />
        <StatCard label="Net revenue" value={formatMoney(data.net_revenue)} icon={<CreditCard className="h-5 w-5" />} hint="Paid minus refunds" />
        <StatCard label="Bookings (7 days)" value={data.bookings_last_7_days} icon={<Ticket className="h-5 w-5" />} />
        <StatCard label="Pending applications" value={data.pending_applications} icon={<Activity className="h-5 w-5" />} />
        <StatCard label="Routes" value={data.routes} icon={<Map className="h-5 w-5" />} />
        <StatCard label="Buses" value={data.buses} icon={<Bus className="h-5 w-5" />} />
        <StatCard label="All bookings" value={total} icon={<Ticket className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Bookings by status" />
          <div className="space-y-3 p-5">
            {total === 0 ? <p className="text-sm text-muted">No bookings yet.</p> : (Object.entries(data.bookings_by_status) as [string, number][]).map(([s, n]) => (
              <div key={s}>
                <div className="mb-1 flex justify-between text-sm"><span>{statusLabel(s)}</span><span className="font-semibold">{n}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-surface2" role="presentation">
                  <div className={`h-full rounded-full ${STATUS_COLORS[s] ?? "bg-brand"}`} style={{ width: `${(n / total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Top routes" subtitle="By confirmed bookings" />
          <div className="p-5">
            {data.top_routes.length === 0 ? <p className="text-sm text-muted">No confirmed bookings yet.</p> : (
              <ol className="space-y-3">
                {data.top_routes.map((r, i) => (
                  <li key={r.code} className="flex items-center justify-between gap-3 text-sm">
                    <span><span className="mr-2 font-mono text-muted">{i + 1}.</span>{r.code} · {r.name}</span>
                    <span className="font-semibold">{r.bookings}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent activity" action={<Link href="/admin/audit" className="text-sm font-semibold text-brand">Full audit log</Link>} />
        {data.recent_activity.length === 0 ? <EmptyState title="No activity yet" /> : (
          <ul className="divide-y divide-line">
            {data.recent_activity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span><span className="font-mono text-xs">{a.action}</span> <span className="text-muted">· {a.entity_type} {a.entity_id}</span></span>
                <span className="text-xs text-muted">{a.actor_email ?? "system"} · {formatDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
