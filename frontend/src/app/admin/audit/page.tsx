"use client";

import { useState } from "react";
import { DataTable, Pagination } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Field";
import { ErrorState, PageHeader } from "@/components/ui/States";
import { formatDateTime } from "@/lib/format";
import type { AuditLog } from "@/lib/types";
import { usePaged } from "@/lib/usePaged";

export default function AdminAuditPage() {
  const [action, setAction] = useState("");
  const list = usePaged<AuditLog>("/admin/audit-logs", { action });
  return (
    <>
      <PageHeader title="Audit log" description="Important actions by passengers and administrators. Entries are append-only." />
      <div className="mb-3 max-w-[260px]">
        <Select label="Category" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Everything</option>
          <option value="admin.">Administrator actions</option>
          <option value="auth.">Authentication</option>
          <option value="booking.">Bookings</option>
          <option value="payment.">Payments</option>
          <option value="pass.">Pass requests</option>
        </Select>
      </div>
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : (
        <>
          <DataTable rows={list.items} loading={list.loading} rowKey={(a) => a.id} empty="No log entries" columns={[
            { header: "When", cell: (a) => <span className="whitespace-nowrap text-xs">{formatDateTime(a.created_at)}</span> },
            { header: "Actor", cell: (a) => a.actor_email ?? <span className="text-muted">system</span> },
            { header: "Action", cell: (a) => <span className="font-mono text-xs font-semibold">{a.action}</span> },
            { header: "Entity", cell: (a) => `${a.entity_type}${a.entity_id ? ` #${a.entity_id}` : ""}` },
            { header: "Details", cell: (a) => <span className="font-mono text-xs text-muted">{a.details ? JSON.stringify(a.details) : "—"}</span> },
            { header: "IP", cell: (a) => <span className="font-mono text-xs text-muted">{a.ip ?? "—"}</span> },
          ]} />
          <Pagination total={list.total} limit={list.limit} offset={list.offset} onChange={list.setOffset} />
        </>
      )}
    </>
  );
}
