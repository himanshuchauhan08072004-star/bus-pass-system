"use client";

import { Ticket } from "lucide-react";
import { useState } from "react";
import { BookingRow } from "@/components/features/BookingRow";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/States";
import { cn, statusLabel } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";

const FILTERS = ["", "confirmed", "pending_payment", "cancelled", "expired"];

export default function BookingsPage() {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useFetch<Booking[]>("/bookings", { status });

  return (
    <>
      <PageHeader title="My bookings" description="Your booking history and digital tickets." action={<ButtonLink href="/routes" size="sm">New booking</ButtonLink>} />
      <div role="group" aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f || "all"}
            onClick={() => setStatus(f)}
            aria-pressed={status === f}
            className={cn("rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200", status === f ? "border-brand bg-brand text-brand-fg shadow-glow" : "border-line bg-surface/80 text-muted hover:text-fg")}
          >
            {f ? statusLabel(f) : "All"}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : data && data.length === 0 ? (
        <EmptyState icon={<Ticket className="h-6 w-6" />} title="No bookings found" message={status ? "Try a different filter." : "Book your first journey to see it here."} action={<ButtonLink href="/routes" size="sm">Find a route</ButtonLink>} />
      ) : (
        <div className="grid gap-3">{data?.map((b) => <BookingRow key={b.id} b={b} />)}</div>
      )}
    </>
  );
}
