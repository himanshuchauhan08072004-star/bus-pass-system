"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api, ApiError, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Payment } from "@/lib/types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Alert } from "../ui/States";
import { useToast } from "../ui/Toast";

const SHOW_SIM = process.env.NEXT_PUBLIC_SHOW_PAYMENT_SIMULATOR !== "false";

export function PaymentModal({
  open,
  onClose,
  payment,
  title,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  payment: Pick<Payment, "id" | "amount" | "currency" | "reference"> | null;
  title: string;
  onPaid: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(simulate: "success" | "failure") {
    if (!payment) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/payments/${payment.id}/pay`, { method: "POST", body: { simulate } });
      toast.success("Payment verified by the server.");
      onPaid();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 402 ? "The payment was declined. You have not been charged. Try again." : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open && !!payment} onClose={busy ? () => undefined : onClose} title="Complete payment">
      {payment && (
        <div className="space-y-4">
          <div className="rounded-xl bg-surface2 p-4">
            <p className="text-sm text-muted">{title}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{formatMoney(payment.amount, payment.currency)}</p>
            <p className="mt-1 font-mono text-xs text-muted">Ref {payment.reference}</p>
          </div>
          <Alert tone="info">
            <strong>Demo payment.</strong> No card details are collected and no money moves. The amount above was calculated by the server, and
            the result is only trusted after the server verifies it with the payment provider.
          </Alert>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex flex-col gap-2">
            <Button size="lg" loading={busy} onClick={() => pay("success")}>
              <ShieldCheck className="h-4 w-4" aria-hidden /> Pay {formatMoney(payment.amount, payment.currency)}
            </Button>
            {SHOW_SIM && (
              <Button variant="secondary" disabled={busy} onClick={() => pay("failure")}>
                Simulate a declined payment (demo only)
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
