"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { api, errorMessage } from "@/lib/api";
import type { VerifyResult } from "@/lib/types";

export default function VerifyPage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api<VerifyResult>("/verify", { method: "POST", body: { token: token.trim() } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <h1 className="text-2xl font-bold tracking-tight">Verify a ticket or pass</h1>
      <p className="mt-1 text-sm text-muted">
        Paste the code read from a QR ticket. A QR code alone proves nothing: this check looks the ticket up on the server and reports whether it is valid right now.
        No personal details are shown.
      </p>
      <Card className="mt-6 p-5">
        <form onSubmit={check} className="space-y-4">
          <Textarea label="QR code contents" placeholder="TF1.B.TFB-XXXXXXXXXX.…" value={token} onChange={(e) => setToken(e.target.value)} className="font-mono text-xs" />
          <Button type="submit" loading={busy} disabled={token.trim().length < 10}>Verify</Button>
        </form>
      </Card>
      <div aria-live="polite" className="mt-6">
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {result && (
          <Card className={`p-5 ${result.valid ? "border-success/50" : "border-danger/50"}`}>
            <div className="flex items-center gap-3">
              {result.valid ? <CheckCircle2 className="h-8 w-8 text-success" aria-hidden /> : <XCircle className="h-8 w-8 text-danger" aria-hidden />}
              <div>
                <p className="text-lg font-bold">{result.valid ? "Valid" : "Not valid"}</p>
                {!result.valid && <p className="text-sm text-muted">{result.reason}</p>}
              </div>
            </div>
            {result.summary && (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {Object.entries(result.summary).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs capitalize text-muted">{k.replace(/_/g, " ")}</dt>
                    <dd className="font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
