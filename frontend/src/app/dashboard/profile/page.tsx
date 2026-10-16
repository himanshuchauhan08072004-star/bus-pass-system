"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Alert, PageHeader } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { User } from "@/lib/types";

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  if (!user) return null;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setProfileError(null);
    try {
      setUser(await api<User>("/auth/me", { method: "PATCH", body: { full_name: name.trim(), phone: phone.trim() || null } }));
      toast.success("Profile updated.");
    } catch (err) {
      setProfileError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (pw.next !== pw.confirm) return setPwError("New passwords do not match");
    setChanging(true);
    try {
      await api("/auth/change-password", { method: "POST", body: { current_password: pw.current, new_password: pw.next } });
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password changed. Other devices were signed out.");
    } catch (err) {
      setPwError(errorMessage(err));
    } finally {
      setChanging(false);
    }
  }

  return (
    <>
      <PageHeader title="Profile & settings" description="Manage your details and account security." />
      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader title="Personal details" subtitle={`Member since ${formatDate(user.created_at.slice(0, 10))}`} />
          <form onSubmit={saveProfile} className="space-y-4 p-5">
            {profileError && <Alert tone="danger">{profileError}</Alert>}
            <Input label="Email" value={user.email} disabled hint="Email cannot be changed." readOnly />
            <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button type="submit" loading={saving}>Save changes</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Change password" subtitle="You will stay signed in here; other devices are signed out." />
          <form onSubmit={changePassword} className="space-y-4 p-5">
            {pwError && <Alert tone="danger">{pwError}</Alert>}
            <Input label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
            <Input label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} hint="At least 10 characters with a letter and a number." required />
            <Input label="Confirm new password" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
            <Button type="submit" loading={changing}>Update password</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
