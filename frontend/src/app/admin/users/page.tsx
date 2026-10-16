"use client";

import { useState } from "react";
import { ConfirmModal } from "@/components/admin/Confirm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, Pagination } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { ErrorState, PageHeader } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { User } from "@/lib/types";
import { usePaged } from "@/lib/usePaged";

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState("");
  const list = usePaged<User>("/admin/users", { q });
  const [pending, setPending] = useState<{ user: User; change: { is_active?: boolean; role?: "admin" | "passenger" }; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!pending) return;
    setBusy(true);
    try {
      await api(`/admin/users/${pending.user.id}`, { method: "PATCH", body: pending.change });
      toast.success("User updated.");
      void list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <>
      <PageHeader title="Passengers & users" description="Search accounts, deactivate access, or change roles. Every change is written to the audit log." />
      <div className="mb-3 max-w-xs"><Input label="Search" placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : (
        <>
          <DataTable rows={list.items} loading={list.loading} rowKey={(u) => u.id} empty="No users match" columns={[
            { header: "Name", cell: (u) => <div><p className="font-medium">{u.full_name}</p><p className="text-xs text-muted">{u.email}</p></div> },
            { header: "Phone", cell: (u) => u.phone ?? "—" },
            { header: "Role", cell: (u) => <Badge tone={u.role === "admin" ? "info" : "neutral"}>{u.role}</Badge> },
            { header: "Status", cell: (u) => <Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "Active" : "Deactivated"}</Badge> },
            { header: "Joined", cell: (u) => formatDate(u.created_at.slice(0, 10)) },
            {
              header: "Actions",
              cell: (u) =>
                u.id === me?.id ? <span className="text-xs text-muted">You</span> : (
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setPending({ user: u, change: { is_active: !u.is_active }, text: u.is_active ? `Deactivate ${u.email}? They will be signed out immediately.` : `Reactivate ${u.email}?` })}>{u.is_active ? "Deactivate" : "Reactivate"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPending({ user: u, change: { role: u.role === "admin" ? "passenger" : "admin" }, text: u.role === "admin" ? `Remove administrator rights from ${u.email}?` : `Give ${u.email} full administrator access?` })}>{u.role === "admin" ? "Make passenger" : "Make admin"}</Button>
                  </div>
                ),
            },
          ]} />
          <Pagination total={list.total} limit={list.limit} offset={list.offset} onChange={list.setOffset} />
        </>
      )}
      <ConfirmModal open={!!pending} busy={busy} danger={pending?.change.role === "admin" || pending?.change.is_active === false} title="Confirm change" message={pending?.text ?? ""} confirmLabel="Confirm" onConfirm={apply} onClose={() => setPending(null)} />
    </>
  );
}
