"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { DataTable, Pagination } from "../ui/DataTable";
import { Input, Select } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { Alert, ErrorState } from "../ui/States";
import { useToast } from "../ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Bus, Paged, Route, Stop } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";
import { usePaged } from "@/lib/usePaged";
import { ConfirmModal } from "./Confirm";

/* ------------------------------ Stops ------------------------------ */
export function StopsTab() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const list = usePaged<Stop>("/admin/stops", { q });
  const [edit, setEdit] = useState<Stop | "new" | null>(null);
  const [form, setForm] = useState({ name: "", city: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<Stop | null>(null);

  function open(s: Stop | "new") {
    setEdit(s);
    setErr(null);
    setForm(s === "new" ? { name: "", city: "" } : { name: s.name, city: s.city });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api(edit === "new" ? "/admin/stops" : `/admin/stops/${(edit as Stop).id}`, { method: edit === "new" ? "POST" : "PUT", body: form });
      toast.success("Stop saved.");
      setEdit(null);
      void list.reload();
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
      await api(`/admin/stops/${del.id}`, { method: "DELETE" });
      toast.success("Stop deleted.");
      void list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setDel(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-xs"><Input label="Search stops" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name…" /></div>
        <Button size="sm" onClick={() => open("new")}><Plus className="h-4 w-4" aria-hidden /> New stop</Button>
      </div>
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : (
        <>
          <DataTable rows={list.items} loading={list.loading} rowKey={(s) => s.id} empty="No stops found" columns={[
            { header: "Name", cell: (s) => <span className="font-medium">{s.name}</span> },
            { header: "City", cell: (s) => s.city || "—" },
            { header: "Actions", cell: (s) => <div className="flex gap-1"><Button size="sm" variant="secondary" onClick={() => open(s)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => setDel(s)}>Delete</Button></div> },
          ]} />
          <Pagination total={list.total} limit={list.limit} offset={list.offset} onChange={list.setOffset} />
        </>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "New stop" : "Edit stop"}>
        <form onSubmit={save} className="space-y-4">
          {err && <Alert tone="danger">{err}</Alert>}
          <Input label="Stop name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
          <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Button type="submit" className="w-full" loading={busy}>Save stop</Button>
        </form>
      </Modal>
      <ConfirmModal open={!!del} danger busy={busy} title="Delete stop?" message={`Delete "${del?.name}"? Stops used by a route cannot be deleted.`} confirmLabel="Delete" onConfirm={remove} onClose={() => setDel(null)} />
    </div>
  );
}

/* ------------------------------ Buses ------------------------------ */
export function BusesTab() {
  const toast = useToast();
  const list = usePaged<Bus>("/admin/buses");
  const routes = useFetch<Paged<Route>>("/admin/routes", { limit: 200 });
  const [edit, setEdit] = useState<Bus | "new" | null>(null);
  const [form, setForm] = useState({ registration_number: "", capacity: 45, status: "active", route_id: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<Bus | null>(null);
  const routeCode = (id: number | null) => routes.data?.items.find((r) => r.id === id)?.code ?? "—";

  function open(b: Bus | "new") {
    setEdit(b);
    setErr(null);
    setForm(b === "new" ? { registration_number: "", capacity: 45, status: "active", route_id: "" } : { registration_number: b.registration_number, capacity: b.capacity, status: b.status, route_id: b.route_id ? String(b.route_id) : "" });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api(edit === "new" ? "/admin/buses" : `/admin/buses/${(edit as Bus).id}`, {
        method: edit === "new" ? "POST" : "PUT",
        body: { ...form, capacity: Number(form.capacity), route_id: form.route_id ? Number(form.route_id) : null },
      });
      toast.success("Bus saved.");
      setEdit(null);
      void list.reload();
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
      await api(`/admin/buses/${del.id}`, { method: "DELETE" });
      toast.success("Bus deleted.");
      void list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setDel(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => open("new")}><Plus className="h-4 w-4" aria-hidden /> New bus</Button></div>
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : (
        <>
          <DataTable rows={list.items} loading={list.loading} rowKey={(b) => b.id} empty="No buses yet" columns={[
            { header: "Registration", cell: (b) => <span className="font-mono font-semibold">{b.registration_number}</span> },
            { header: "Capacity", cell: (b) => b.capacity },
            { header: "Route", cell: (b) => routeCode(b.route_id) },
            { header: "Status", cell: (b) => <StatusBadge status={b.status === "active" ? "active" : b.status === "maintenance" ? "pending" : "expired"} /> },
            { header: "Actions", cell: (b) => <div className="flex gap-1"><Button size="sm" variant="secondary" onClick={() => open(b)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => setDel(b)}>Delete</Button></div> },
          ]} />
          <Pagination total={list.total} limit={list.limit} offset={list.offset} onChange={list.setOffset} />
        </>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "New bus" : "Edit bus"}>
        <form onSubmit={save} className="space-y-4">
          {err && <Alert tone="danger">{err}</Alert>}
          <Input label="Registration number" value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} required minLength={4} maxLength={20} />
          <Input label="Seating capacity" type="number" min={1} max={200} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} required />
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="maintenance">In maintenance</option>
            <option value="retired">Retired</option>
          </Select>
          <Select label="Assigned route" value={form.route_id} onChange={(e) => setForm({ ...form, route_id: e.target.value })}>
            <option value="">Unassigned</option>
            {routes.data?.items.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}
          </Select>
          <Button type="submit" className="w-full" loading={busy}>Save bus</Button>
        </form>
      </Modal>
      <ConfirmModal open={!!del} danger busy={busy} title="Delete bus?" message={`Delete bus ${del?.registration_number}?`} confirmLabel="Delete" onConfirm={remove} onClose={() => setDel(null)} />
    </div>
  );
}

/* ------------------------------ Fares ------------------------------ */
export function FaresTab() {
  const toast = useToast();
  const list = usePaged<Route>("/admin/routes");
  const [edit, setEdit] = useState<Route | null>(null);
  const [f, setF] = useState({ base_fare: "", per_km_rate: "", min_fare: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function open(r: Route) {
    setEdit(r);
    setErr(null);
    setF({ base_fare: r.fare?.base_fare ?? "0", per_km_rate: r.fare?.per_km_rate ?? "0", min_fare: r.fare?.min_fare ?? "0" });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/routes/${edit.id}/fare`, { method: "PUT", body: f });
      toast.success("Fare rule saved. New bookings use it immediately.");
      setEdit(null);
      void list.reload();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }
  const preview = Math.max(Number(f.min_fare) || 0, (Number(f.base_fare) || 0) + (Number(f.per_km_rate) || 0) * 10);

  return (
    <div>
      <p className="mb-3 text-sm text-muted">Fare = base + rate × distance between the chosen stops, never below the minimum. Changes apply to new bookings only; existing bookings keep the fare they were quoted.</p>
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : (
        <>
          <DataTable rows={list.items} loading={list.loading} rowKey={(r) => r.id} empty="No routes" columns={[
            { header: "Route", cell: (r) => <span><span className="font-mono font-semibold">{r.code}</span> <span className="text-muted">{r.name}</span></span> },
            { header: "Base", cell: (r) => (r.fare ? formatMoney(r.fare.base_fare) : <span className="text-warning">Not set</span>) },
            { header: "Per km", cell: (r) => (r.fare ? formatMoney(r.fare.per_km_rate) : "—") },
            { header: "Minimum", cell: (r) => (r.fare ? formatMoney(r.fare.min_fare) : "—") },
            { header: "Actions", cell: (r) => <Button size="sm" variant="secondary" onClick={() => open(r)}>{r.fare ? "Edit fare" : "Set fare"}</Button> },
          ]} />
          <Pagination total={list.total} limit={list.limit} offset={list.offset} onChange={list.setOffset} />
        </>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `Fare rule · ${edit.code}` : ""}>
        <form onSubmit={save} className="space-y-4">
          {err && <Alert tone="danger">{err}</Alert>}
          <Input label="Base fare (₹)" type="number" step="0.01" min="0" value={f.base_fare} onChange={(e) => setF({ ...f, base_fare: e.target.value })} required />
          <Input label="Rate per km (₹)" type="number" step="0.01" min="0" value={f.per_km_rate} onChange={(e) => setF({ ...f, per_km_rate: e.target.value })} required />
          <Input label="Minimum fare (₹)" type="number" step="0.01" min="0" value={f.min_fare} onChange={(e) => setF({ ...f, min_fare: e.target.value })} required />
          <p className="rounded-2xl bg-sage/40 p-3 text-sm text-muted">Example: a 10 km ride costs {formatMoney(preview)}.</p>
          <Button type="submit" className="w-full" loading={busy}>Save fare rule</Button>
        </form>
      </Modal>
    </div>
  );
}
