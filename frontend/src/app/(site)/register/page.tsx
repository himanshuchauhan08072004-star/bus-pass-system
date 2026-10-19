"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/States";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate() {
    const e: Record<string, string> = {};
    if (form.full_name.trim().length < 2) e.full_name = "Enter your full name";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email address";
    if (form.password.length < 10) e.password = "Use at least 10 characters";
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) e.password = "Include at least one letter and one number";
    if (form.confirm !== form.password) e.confirm = "Passwords do not match";
    if (form.phone && !/^\+?[0-9][0-9\- ]{6,18}$/.test(form.phone)) e.phone = "Enter a valid phone number";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      await register({ email: form.email.trim(), password: form.password, full_name: form.full_name.trim(), phone: form.phone.trim() || undefined });
      router.push("/dashboard");
    } catch (err) {
      setServerError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted">Book tickets and apply for passes in minutes.</p>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {serverError && <Alert tone="danger">{serverError}</Alert>}
          <Input label="Full name" autoComplete="name" value={form.full_name} onChange={set("full_name")} error={errors.full_name} required />
          <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} required />
          <Input label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} error={errors.phone} />
          <Input label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint="At least 10 characters with a letter and a number." required />
          <Input label="Confirm password" type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} error={errors.confirm} required />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          Already registered? <Link href="/login" className="font-semibold text-brand">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
