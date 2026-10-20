"use client";

import { ArrowRight, Printer, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PaymentModal } from "@/components/features/PaymentModal";
import { QrBox } from "@/components/features/Qr";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Alert, ErrorState, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatDateTime, formatMoney, formatTime } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";

function HoldCountdown({ until, onExpire }: { until: string; onExpire: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(until).getTime() - Date.now()));
  useEffect(() => {
    const t = setInterval(() => {
      const ms = Math.max(0, new Date(until).getTime() - Date.now());
      setLeft(ms);
      if (ms === 0) {
        clearInterval(t);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [until, onExpire]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return <span className="font-mono font-semibold">{m}:{String(s).padStart(2, "0")}</span>;
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data: b, error, loading, reload, setData } = useFetch<Booking>(`/bookings/${id}`);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !b) return <Skeleton className="h-96" />;
  if (!b) return null;

  async function cancel() {
    setBusy(true);
    try {
      const updated = await api<Booking>(`/bookings/${id}/cancel`, { method: "POST", body: {} });
      setData(updated);
      setCancelOpen(false);
      toast.success(Number(updated.refund_amount) > 0 ? `Booking cancelled. ${formatMoney(updated.refund_amount)} refunded.` : "Booking cancelled.");
    } catch (e) {
      toast.error(errorMessage(e));
      setCancelOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const canCancel = b.cancellation?.allowed && (b.status === "confirmed" || b.status === "pending_payment");

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted no-print">
        <Link href="/dashboard/bookings" className="hover:text-fg">Bookings</Link> <span aria-hidden>/</span> <span className="text-fg font-mono">{b.reference}</span>
      </nav>

      {b.status === "pending_payment" && b.hold_expires_at && (
        <div className="mb-4 no-print">
          <Alert tone="warning">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Your seat is held for <HoldCountdown until={b.hold_expires_at} onExpire={reload} />. Pay to confirm this booking.</span>
              <Button size="sm" onClick={() => setPayOpen(true)}>Pay {formatMoney(b.total_fare)}</Button>
            </div>
          </Alert>
        </div>
      )}
      {b.status === "expired" && <div className="mb-4"><Alert tone="info">This booking expired because payment was not completed in time.</Alert></div>}
      {b.status === "cancelled" && <div className="mb-4"><Alert tone="info">Cancelled{b.cancelled_at ? ` on ${formatDateTime(b.cancelled_at)}` : ""}. {Number(b.refund_amount) > 0 ? `${formatMoney(b.refund_amount)} was refunded.` : "No refund was due."}</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-brand/20 to-transparent px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{b.route_code} · {b.route_name}</p>
              <StatusBadge status={b.status} />
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
              {b.from_stop_name} <ArrowRight className="h-5 w-5 text-brand" aria-hidden /> {b.to_stop_name}
            </p>
          </div>
          <dl className="grid gap-5 p-5 sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Date</dt><dd className="font-semibold">{formatDate(b.travel_date)}</dd></div>
            <div><dt className="text-xs text-muted">Departure</dt><dd className="font-semibold">{formatTime(b.departure_time)}</dd></div>
            <div><dt className="text-xs text-muted">Passengers</dt><dd className="flex items-center gap-1.5 font-semibold"><Users className="h-4 w-4" aria-hidden />{b.passengers}</dd></div>
            <div><dt className="text-xs text-muted">Booking reference</dt><dd className="font-mono font-semibold">{b.reference}</dd></div>
            <div><dt className="text-xs text-muted">Fare per person</dt><dd className="font-semibold">{formatMoney(b.unit_fare)}</dd></div>
            <div><dt className="text-xs text-muted">Total fare</dt><dd className="text-lg font-bold">{formatMoney(b.total_fare)}</dd></div>
          </dl>
          {b.payment && (
            <div className="border-t border-line px-5 py-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted">Payment <span className="font-mono">{b.payment.reference}</span></span>
                <StatusBadge status={b.payment.status} />
              </div>
              {b.payment.transaction_ref && <p className="mt-1 text-xs text-muted">Transaction <span className="font-mono">{b.payment.transaction_ref}</span></p>}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5 text-center">
            {b.qr_token ? (
              <>
                <QrBox value={b.qr_token} label={`QR ticket for booking ${b.reference}`} />
                <p className="mt-3 text-xs text-muted">Show this code when boarding. The conductor verifies it with the server; a screenshot of a cancelled ticket will not pass.</p>
                <Button variant="secondary" size="sm" className="mt-3 no-print" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden /> Print ticket</Button>
              </>
            ) : (
              <p className="py-8 text-sm text-muted">The QR ticket appears here once payment is confirmed.</p>
            )}
          </Card>
          {b.cancellation && (b.status === "confirmed" || b.status === "pending_payment") && (
            <Card className="no-print">
              <CardHeader title="Cancellation" />
              <div className="space-y-3 p-5 text-sm">
                <p className="text-muted">{b.cancellation.message}{b.cancellation.allowed && b.status === "confirmed" ? `: ${formatMoney(b.cancellation.refund_amount)} would be refunded.` : "."}</p>
                <Button variant="danger" className="w-full" disabled={!canCancel} onClick={() => setCancelOpen(true)}>Cancel booking</Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} payment={b.payment} title={`${b.from_stop_name} to ${b.to_stop_name}`} onPaid={() => { setPayOpen(false); void reload(); }} />
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this booking?">
        <div className="space-y-4 text-sm">
          <p>{b.cancellation?.message}. {b.status === "confirmed" && <>You will receive <strong>{formatMoney(b.cancellation?.refund_amount)}</strong>.</>}</p>
          <p className="text-muted">Policy: 24 hours or more before departure, full refund. Between 2 and 24 hours, 50%. Within 2 hours, cancellation is not available.</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setCancelOpen(false)}>Keep booking</Button>
            <Button variant="danger" className="flex-1" loading={busy} onClick={cancel}>Yes, cancel</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
