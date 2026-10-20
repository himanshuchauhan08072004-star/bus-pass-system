"use client";

import { IdCard, RefreshCw } from "lucide-react";
import { useState } from "react";
import { PassCard } from "@/components/features/PassCard";
import { PaymentModal } from "@/components/features/PaymentModal";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Alert, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { cn, formatDate, formatMoney } from "@/lib/format";
import type { Application, BusPass, PassType } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";

type Tab = "passes" | "apply" | "applications";

export default function PassesPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("passes");
  const passes = useFetch<BusPass[]>("/passes");
  const types = useFetch<PassType[]>("/pass-types");
  const apps = useFetch<Application[]>("/passes/applications");

  const [applyFor, setApplyFor] = useState<PassType | null>(null);
  const [declaration, setDeclaration] = useState("");
  const [busy, setBusy] = useState<number | "apply" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [paying, setPaying] = useState<Application | null>(null);

  const reloadAll = () => {
    void passes.reload();
    void apps.reload();
  };

  async function submitApplication() {
    if (!applyFor) return;
    setBusy("apply");
    setFormError(null);
    try {
      const app = await api<Application>("/passes/applications", { method: "POST", body: { pass_type_id: applyFor.id, declaration: declaration.trim() || null } });
      setApplyFor(null);
      setDeclaration("");
      setPaying(app);
      reloadAll();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function renew(p: BusPass) {
    setBusy(p.id);
    try {
      const app = await api<Application>(`/passes/${p.id}/renew`, { method: "POST" });
      setPaying(app);
      reloadAll();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "passes", label: "My passes" },
    { id: "apply", label: "Apply for a pass" },
    { id: "applications", label: "Applications" },
  ];

  return (
    <>
      <PageHeader title="Bus passes" description="Apply, renew and show your digital pass." />
      <div role="tablist" aria-label="Pass sections" className="mb-6 flex gap-1 rounded-xl border border-line bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn("flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors", tab === t.id ? "bg-brand text-brand-fg" : "text-muted hover:text-fg")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "passes" && (
        <div role="tabpanel" id="panel-passes" aria-labelledby="tab-passes" className="space-y-4">
          {passes.error ? <ErrorState message={passes.error} onRetry={passes.reload} /> : passes.loading && !passes.data ? <Skeleton className="h-48" /> : passes.data && passes.data.length === 0 ? (
            <EmptyState icon={<IdCard className="h-6 w-6" />} title="You have no passes yet" message="Apply for a pass to travel more for less. Approved passes appear here with a QR code." action={<Button size="sm" onClick={() => setTab("apply")}>Apply for a pass</Button>} />
          ) : (
            passes.data?.map((p) => (
              <PassCard
                key={p.id}
                pass={p}
                actions={
                  p.can_renew && p.status !== "revoked" ? (
                    <Button size="sm" loading={busy === p.id} onClick={() => renew(p)}>
                      <RefreshCw className="h-4 w-4" aria-hidden /> Renew pass
                    </Button>
                  ) : undefined
                }
              />
            ))
          )}
        </div>
      )}

      {tab === "apply" && (
        <div role="tabpanel" id="panel-apply" aria-labelledby="tab-apply" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {types.error ? <ErrorState message={types.error} onRetry={types.reload} /> : types.loading && !types.data ? <Skeleton className="h-48" /> : types.data?.map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{t.name}</h3>
                {t.eligibility !== "general" && <Badge tone="info">{t.eligibility}</Badge>}
              </div>
              <p className="mt-1 flex-1 text-sm text-muted">{t.description}</p>
              <p className="mt-4 text-3xl font-extrabold tracking-tight">{formatMoney(t.price)}</p>
              <p className="text-xs text-muted">Valid for {t.duration_days} days</p>
              <Button className="mt-4" onClick={() => { setApplyFor(t); setFormError(null); }}>Apply</Button>
            </Card>
          ))}
        </div>
      )}

      {tab === "applications" && (
        <div role="tabpanel" id="panel-applications" aria-labelledby="tab-applications" className="space-y-3">
          {apps.error ? <ErrorState message={apps.error} onRetry={apps.reload} /> : apps.loading && !apps.data ? <Skeleton className="h-32" /> : apps.data && apps.data.length === 0 ? (
            <EmptyState title="No applications yet" message="Your pass applications and their review status will be tracked here." />
          ) : (
            apps.data?.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{a.pass_type_name} {a.is_renewal && <Badge tone="info" className="ml-1">Renewal</Badge>}</p>
                    <p className="text-xs text-muted">Applied {formatDate(a.created_at.slice(0, 10))} · {formatMoney(a.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.payment && <StatusBadge status={a.payment.status} />}
                    <StatusBadge status={a.status} />
                    {a.status === "pending" && a.payment?.status === "pending" && <Button size="sm" onClick={() => setPaying(a)}>Pay now</Button>}
                  </div>
                </div>
                {a.status === "pending" && a.payment?.status === "succeeded" && <p className="mt-2 text-sm text-muted">Payment received. Waiting for an administrator to review your application.</p>}
                {a.review_note && <p className="mt-2 text-sm text-muted">Reviewer note: {a.review_note}</p>}
                {a.status === "rejected" && a.payment?.status === "refunded" && <p className="mt-2 text-sm text-muted">Your payment was refunded in full.</p>}
              </Card>
            ))
          )}
        </div>
      )}

      <Modal open={!!applyFor} onClose={() => setApplyFor(null)} title={applyFor ? `Apply for ${applyFor.name}` : ""}>
        {applyFor && (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface2 p-4">
              <p className="text-sm text-muted">{applyFor.duration_days}-day pass</p>
              <p className="text-2xl font-bold">{formatMoney(applyFor.price)}</p>
              <p className="mt-1 text-xs text-muted">Priced by the server. You pay after applying; an administrator then reviews your application.</p>
            </div>
            {applyFor.eligibility !== "general" && (
              <Textarea label={`Eligibility declaration (${applyFor.eligibility})`} value={declaration} onChange={(e) => setDeclaration(e.target.value)} hint="Institution or ID details. An administrator verifies this." maxLength={500} />
            )}
            {formError && <Alert tone="danger">{formError}</Alert>}
            <Button size="lg" className="w-full" loading={busy === "apply"} onClick={submitApplication}>Submit application</Button>
          </div>
        )}
      </Modal>

      <PaymentModal
        open={!!paying}
        onClose={() => { setPaying(null); reloadAll(); setTab("applications"); }}
        payment={paying?.payment ?? null}
        title={paying ? `${paying.pass_type_name}${paying.is_renewal ? " (renewal)" : ""}` : ""}
        onPaid={() => { setPaying(null); reloadAll(); setTab(paying?.is_renewal ? "passes" : "applications"); }}
      />
    </>
  );
}
