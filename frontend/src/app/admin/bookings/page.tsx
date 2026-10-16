"use client";

import { useState } from "react";
import { ConfirmModal } from "@/components/admin/Confirm";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, Pagination } from "@/components/ui/DataTable";
import { Input, Select } from "@/components/ui/Field";
import { ErrorState, PageHeader } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { usePaged } from "@/lib/usePaged";

export default function AdminBookingsPage() {
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const list = usePaged<Booking>("/admin/bookings", { status, q });
  const [target, setTarget] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!target) return;
    setBusy(true);
    try {
      await api(`/admin/bookings/${target.id}/cancel`, { method: "POST", body: { reason: "Cancelled by administrator" } });
      toast.success("Booking cancelled. Paid amounts are refunded in full.");
      void list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setTarget(null);
    }
  }

  return (
    <>
      <PageHeader title="Bookings" description="All passenger bookings. Administrator cancellations refund in full." />
      <div className="mb-3 grid max-w-xl gap-3 sm:grid-cols-2">
        <Input label="Reference" placeholder="TFB-…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={40} />
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending_payment">Pending payment</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </Select>
      </div>
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : (
        <>
          <DataTable rows={list.items} loading={list.loading} rowKey={(b) => b.id} empty="No bookings match" columns={[
            { header: "Reference", cell: (b) => <span className="font-mono text-xs font-semibold">{b.reference}</span> },
            { header: "Passenger", cell: (b) => <div><p className="font-medium">{b.passenger_name}</p><p className="text-xs text-muted">{b.passenger_email}</p></div> },
            { header: "Journey", cell: (b) => <div><p>{b.from_stop_name} → {b.to_stop_name}</p><p className="text-xs text-muted">{b.route_code} · {formatDate(b.travel_date)} {formatTime(b.departure_time)}</p></div> },
            { header: "Fare", cell: (b) => formatMoney(b.total_fare) },
            { header: "Status", cell: (b) => <StatusBadge status={b.status} /> },
            { header: "Actions", cell: (b) => (b.status === "confirmed" || b.status === "pending_payment" ? <Button size="sm" variant="secondary" onClick={() => setTarget(b)}>Cancel</Button> : <span className="text-xs text-muted">—</span>) },
          ]} />
          <Pagination total={list.total} limit={list.limit} offset={list.offset} onChange={list.setOffset} />
        </>
      )}
      <ConfirmModal open={!!target} danger busy={busy} title="Cancel this booking?" message={`Cancel ${target?.reference} for ${target?.passenger_name}? ${target?.status === "confirmed" ? `${formatMoney(target?.total_fare)} will be refunded.` : ""}`} confirmLabel="Cancel booking" onConfirm={cancel} onClose={() => setTarget(null)} />
    </>
  );
}
