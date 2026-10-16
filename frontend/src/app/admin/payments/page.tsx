"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { DataTable, Pagination } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Field";
import { ErrorState, PageHeader } from "@/components/ui/States";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Payment } from "@/lib/types";
import { usePaged } from "@/lib/usePaged";

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState("");
  const list = usePaged<Payment>("/admin/payments", { status });
  return (
    <>
      <PageHeader title="Payments" description="Payment records and transaction references. Card details are never stored." />
      <div className="mb-3 max-w-[220px]">
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="succeeded">Succeeded</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
          <option value="partially_refunded">Partially refunded</option>
          <option value="refunded">Refunded</option>
        </Select>
      </div>
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : (
        <>
          <DataTable rows={list.items} loading={list.loading} rowKey={(p) => p.id} empty="No payments match" columns={[
            { header: "Reference", cell: (p) => <span className="font-mono text-xs font-semibold">{p.reference}</span> },
            { header: "Passenger", cell: (p) => p.passenger_email },
            { header: "For", cell: (p) => (p.target === "booking" ? "Ticket" : "Pass") },
            { header: "Amount", cell: (p) => formatMoney(p.amount, p.currency) },
            { header: "Refunded", cell: (p) => (Number(p.refunded_amount) > 0 ? formatMoney(p.refunded_amount, p.currency) : "—") },
            { header: "Transaction", cell: (p) => <span className="font-mono text-xs text-muted">{p.transaction_ref ?? "—"}</span> },
            { header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
            { header: "Created", cell: (p) => formatDateTime(p.created_at) },
          ]} />
          <Pagination total={list.total} limit={list.limit} offset={list.offset} onChange={list.setOffset} />
        </>
      )}
    </>
  );
}
