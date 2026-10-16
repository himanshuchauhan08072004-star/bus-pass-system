"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { ConfirmModal } from "@/components/admin/Confirm";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, Pagination } from "@/components/ui/DataTable";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Alert, ErrorState, PageHeader } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { cn, formatDate, formatMoney } from "@/lib/format";
import type { Application, PassType, Paged } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";
import { usePaged } from "@/lib/usePaged";

function Applications() {
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const list = usePaged<Application>("/admin/pass-applications", { status });
  const [target, setTarget] = useState<{ app: Application; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/pass-applications/${target.app.id}/${target.action}`, { method: "POST", body: { note: note.trim() || null } });
      toast.success(target.action === "approve" ? "Application approved. The pass is now active." : "Application rejected and payment refunded.");
      setTarget(null);
      setNote("");
      void list.reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 max-w-[200px]">
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </Select>
      </div>
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : (
        <>
          <DataTable rows={list.items} loading={list.loading} rowKey={(a) => a.id} empty="No applications in this view" columns={[
            { header: "Passenger", cell: (a) => <div><p className="font-medium">{a.passenger_name}</p><p className="text-xs text-muted">{a.passenger_email}</p></div> },
            { header: "Pass", cell: (a) => <div>{a.pass_type_name} {a.is_renewal && <Badge tone="info">Renewal</Badge>}{a.declaration && <p className="mt-1 max-w-xs text-xs text-muted">“{a.declaration}”</p>}</div> },
            { header: "Price", cell: (a) => formatMoney(a.price) },
            { header: "Payment", cell: (a) => (a.payment ? <StatusBadge status={a.payment.status} /> : "—") },
            { header: "Status", cell: (a) => <StatusBadge status={a.raw_status} /> },
            { header: "Applied", cell: (a) => formatDate(a.created_at.slice(0, 10)) },
            {
              header: "Actions",
              cell: (a) =>
                a.raw_status === "pending" ? (
                  <div className="flex gap-1">
                    <Button size="sm" disabled={a.payment?.status !== "succeeded"} title={a.payment?.status !== "succeeded" ? "Payment not yet verified" : undefined} onClick={() => { setTarget({ app: a, action: "approve" }); setErr(null); }}>Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setTarget({ app: a, action: "reject" }); setErr(null); }}>Reject</Button>
                  </div>
                ) : <span className="text-xs text-muted">{a.review_note ?? "Reviewed"}</span>,
            },
          ]} />
          <Pagination total={list.total} limit={list.limit} offset={list.offset} onChange={list.setOffset} />
        </>
      )}
      <Modal open={!!target} onClose={() => setTarget(null)} title={target ? `${target.action === "approve" ? "Approve" : "Reject"} application` : ""}>
        {target && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{target.app.passenger_name} · {target.app.pass_type_name} · {formatMoney(target.app.price)}</p>
            {target.action === "reject" && <Alert tone="warning">The passenger&apos;s payment will be refunded in full.</Alert>}
            {err && <Alert tone="danger">{err}</Alert>}
            <Textarea label="Note to passenger (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            <Button className="w-full" variant={target.action === "reject" ? "danger" : "primary"} loading={busy} onClick={submit}>
              {target.action === "approve" ? "Approve and issue pass" : "Reject and refund"}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PassTypes() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch<Paged<PassType>>("/admin/pass-types");
  const [edit, setEdit] = useState<PassType | "new" | null>(null);
  const [f, setF] = useState({ name: "", description: "", duration_days: 30, price: "", eligibility: "general", is_active: true });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<PassType | null>(null);

  function open(p: PassType | "new") {
    setEdit(p);
    setErr(null);
    setF(p === "new" ? { name: "", description: "", duration_days: 30, price: "", eligibility: "general", is_active: true } : { name: p.name, description: p.description, duration_days: p.duration_days, price: String(Number(p.price)), eligibility: p.eligibility, is_active: p.is_active });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api(edit === "new" ? "/admin/pass-types" : `/admin/pass-types/${(edit as PassType).id}`, { method: edit === "new" ? "POST" : "PUT", body: { ...f, duration_days: Number(f.duration_days) } });
      toast.success("Pass type saved.");
      setEdit(null);
      void reload();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!del) return;
    setBusy(true);
    try {
      await api(`/admin/pass-types/${del.id}`, { method: "DELETE" });
      toast.success("Pass type deleted.");
      void reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setDel(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Price changes apply to new applications only.</p>
        <Button size="sm" onClick={() => open("new")}><Plus className="h-4 w-4" aria-hidden /> New pass type</Button>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <DataTable rows={data?.items} loading={loading} rowKey={(p) => p.id} empty="No pass types" columns={[
          { header: "Name", cell: (p) => <span className="font-medium">{p.name}</span> },
          { header: "Duration", cell: (p) => `${p.duration_days} days` },
          { header: "Price", cell: (p) => formatMoney(p.price) },
          { header: "Eligibility", cell: (p) => <Badge tone={p.eligibility === "general" ? "neutral" : "info"}>{p.eligibility}</Badge> },
          { header: "Status", cell: (p) => <StatusBadge status={p.is_active ? "active" : "expired"} /> },
          { header: "Actions", cell: (p) => <div className="flex gap-1"><Button size="sm" variant="secondary" onClick={() => open(p)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => setDel(p)}>Delete</Button></div> },
        ]} />
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "New pass type" : "Edit pass type"}>
        <form onSubmit={save} className="space-y-4">
          {err && <Alert tone="danger">{err}</Alert>}
          <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          <Textarea label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={500} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Validity (days)" type="number" min={1} value={f.duration_days} onChange={(e) => setF({ ...f, duration_days: Number(e.target.value) })} required />
            <Input label="Price (₹)" type="number" step="0.01" min="0" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required />
            <Select label="Eligibility" value={f.eligibility} onChange={(e) => setF({ ...f, eligibility: e.target.value })}>
              <option value="general">General</option>
              <option value="student">Student</option>
              <option value="senior">Senior citizen</option>
            </Select>
            <Select label="Status" value={f.is_active ? "1" : "0"} onChange={(e) => setF({ ...f, is_active: e.target.value === "1" })}>
              <option value="1">Offered</option>
              <option value="0">Hidden</option>
            </Select>
          </div>
          <Button type="submit" className="w-full" loading={busy}>Save pass type</Button>
        </form>
      </Modal>
      <ConfirmModal open={!!del} danger busy={busy} title="Delete pass type?" message={`Delete "${del?.name}"? Types already used by passes cannot be deleted; hide them instead.`} confirmLabel="Delete" onConfirm={remove} onClose={() => setDel(null)} />
    </div>
  );
}

export default function AdminPassesPage() {
  const [tab, setTab] = useState<"applications" | "types">("applications");
  return (
    <>
      <PageHeader title="Passes" description="Review applications and manage pass types and prices." />
      <div role="tablist" aria-label="Pass sections" className="mb-6 inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
        {([["applications", "Applications"], ["types", "Pass types & prices"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("rounded-lg px-4 py-2 text-sm font-semibold transition-colors", tab === id ? "bg-brand text-brand-fg" : "text-muted hover:text-fg")}>{label}</button>
        ))}
      </div>
      <div role="tabpanel">{tab === "applications" ? <Applications /> : <PassTypes />}</div>
    </>
  );
}
