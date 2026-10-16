"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusBadge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { DataTable, Pagination } from "../ui/DataTable";
import { Input, Select } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { Alert, ErrorState } from "../ui/States";
import { useToast } from "../ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { formatTime } from "@/lib/format";
import type { Paged, Route, Stop } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";
import { usePaged } from "@/lib/usePaged";
import { ConfirmModal } from "./Confirm";

const hhmm = (t: string) => t.slice(0, 5);

function RouteForm({ route, onClose, onSaved }: { route: Route | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    code: route?.code ?? "",
    name: route?.name ?? "",
    operating_start: route ? hhmm(route.operating_start) : "06:00",
    operating_end: route ? hhmm(route.operating_end) : "21:00",
    frequency_minutes: route?.frequency_minutes ?? 30,
    is_active: route?.is_active ?? true,
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api(route ? `/admin/routes/${route.id}` : "/admin/routes", { method: route ? "PUT" : "POST", body: { ...f, frequency_minutes: Number(f.frequency_minutes) } });
      toast.success(route ? "Route updated." : "Route created. Add its stops and fare next.");
      onSaved();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {err && <Alert tone="danger">{err}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required maxLength={20} />
        <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <Input label="First departure" type="time" value={f.operating_start} onChange={(e) => setF({ ...f, operating_start: e.target.value })} required />
        <Input label="Last departure" type="time" value={f.operating_end} onChange={(e) => setF({ ...f, operating_end: e.target.value })} required />
        <Input label="Minutes between buses" type="number" min={1} max={240} value={f.frequency_minutes} onChange={(e) => setF({ ...f, frequency_minutes: Number(e.target.value) })} required />
        <Select label="Status" value={f.is_active ? "1" : "0"} onChange={(e) => setF({ ...f, is_active: e.target.value === "1" })}>
          <option value="1">Active (bookable)</option>
          <option value="0">Inactive (hidden)</option>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button type="submit" className="flex-1" loading={busy}>Save route</Button>
      </div>
    </form>
  );
}

function StopsEditor({ route, onClose, onSaved }: { route: Route; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const stops = useFetch<Paged<Stop>>("/admin/stops", { limit: 200 });
  const [rows, setRows] = useState<{ stop_id: number | ""; distance_km: string }[]>(route.stops.map((s) => ({ stop_id: s.stop_id, distance_km: String(Number(s.distance_km)) })));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (rows.length === 0) setRows([{ stop_id: "", distance_km: "0" }, { stop_id: "", distance_km: "" }]);
  }, [rows.length]);

  const move = (i: number, d: -1 | 1) =>
    setRows((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const c = [...r];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  async function save() {
    setErr(null);
    if (rows.some((r) => r.stop_id === "" || r.distance_km === "")) return setErr("Choose a stop and distance for every row.");
    setBusy(true);
    try {
      await api(`/admin/routes/${route.id}/stops`, { method: "PUT", body: { stops: rows.map((r) => ({ stop_id: r.stop_id, distance_km: r.distance_km })) } });
      toast.success("Route stops saved.");
      onSaved();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Order the stops along the route. Distance is cumulative from the first stop (which must be 0) and must increase.</p>
      {stops.error && <ErrorState message={stops.error} onRetry={stops.reload} />}
      {err && <Alert tone="danger">{err}</Alert>}
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[auto_1fr_90px_auto] items-end gap-2">
            <span className="mb-3 w-5 text-center text-sm text-muted">{i + 1}</span>
            <Select label={i === 0 ? "Stop" : `Stop ${i + 1}`} value={r.stop_id} onChange={(e) => setRows((x) => x.map((y, k) => (k === i ? { ...y, stop_id: e.target.value ? Number(e.target.value) : "" } : y)))}>
              <option value="">Select…</option>
              {stops.data?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input label="Km" type="number" step="0.1" min="0" value={r.distance_km} onChange={(e) => setRows((x) => x.map((y, k) => (k === i ? { ...y, distance_km: e.target.value } : y)))} />
            <div className="mb-0.5 flex">
              <Button type="button" variant="ghost" size="sm" aria-label={`Move stop ${i + 1} up`} onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" aria-hidden /></Button>
              <Button type="button" variant="ghost" size="sm" aria-label={`Move stop ${i + 1} down`} onClick={() => move(i, 1)} disabled={i === rows.length - 1}><ArrowDown className="h-4 w-4" aria-hidden /></Button>
              <Button type="button" variant="ghost" size="sm" aria-label={`Remove stop ${i + 1}`} onClick={() => setRows((x) => x.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4 text-danger" aria-hidden /></Button>
            </div>
          </li>
        ))}
      </ol>
      <Button type="button" variant="secondary" size="sm" onClick={() => setRows((x) => [...x, { stop_id: "", distance_km: "" }])}><Plus className="h-4 w-4" aria-hidden /> Add stop</Button>
      <div className="flex gap-2 border-t border-line pt-4">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" loading={busy} onClick={save}>Save stops</Button>
      </div>
    </div>
  );
}

export function RoutesTab() {
  const toast = useToast();
  const list = usePaged<Route>("/admin/routes");
  const [edit, setEdit] = useState<Route | "new" | null>(null);
  const [stopsFor, setStopsFor] = useState<Route | null>(null);
  const [del, setDel] = useState<Route | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!del) return;
    setBusy(true);
    try {
      await api(`/admin/routes/${del.id}`, { method: "DELETE" });
      toast.success("Route deleted.");
      setDel(null);
      void list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
      setDel(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setEdit("new")}><Plus className="h-4 w-4" aria-hidden /> New route</Button></div>
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : (
        <>
          <DataTable
            rows={list.items}
            loading={list.loading}
            rowKey={(r) => r.id}
            empty="No routes yet"
            columns={[
              { header: "Code", cell: (r) => <span className="font-mono font-semibold">{r.code}</span> },
              { header: "Name", cell: (r) => r.name },
              { header: "Hours", cell: (r) => `${formatTime(r.operating_start)} – ${formatTime(r.operating_end)}` },
              { header: "Every", cell: (r) => `${r.frequency_minutes} min` },
              { header: "Stops", cell: (r) => r.stops.length },
              { header: "Status", cell: (r) => <StatusBadge status={r.is_active ? "active" : "expired"} /> },
              {
                header: "Actions",
                cell: (r) => (
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setEdit(r)}>Edit</Button>
                    <Button size="sm" variant="secondary" onClick={() => setStopsFor(r)}>Stops</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDel(r)}>Delete</Button>
                  </div>
                ),
              },
            ]}
          />
          <Pagination total={list.total} limit={list.limit} offset={list.offset} onChange={list.setOffset} />
        </>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "New route" : "Edit route"}>
        {edit && <RouteForm route={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void list.reload(); }} />}
      </Modal>
      <Modal open={!!stopsFor} onClose={() => setStopsFor(null)} title={stopsFor ? `Stops · ${stopsFor.code}` : ""} wide>
        {stopsFor && <StopsEditor route={stopsFor} onClose={() => setStopsFor(null)} onSaved={() => { setStopsFor(null); void list.reload(); }} />}
      </Modal>
      <ConfirmModal open={!!del} danger busy={busy} title="Delete route?" message={`Delete ${del?.code}? Routes with bookings cannot be deleted; deactivate them instead.`} confirmLabel="Delete" onConfirm={remove} onClose={() => setDel(null)} />
    </div>
  );
}
