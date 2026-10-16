"use client";

import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/format";
import { Button } from "../ui/Button";
import { ErrorState, Spinner } from "../ui/States";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
}

export function AppShell({ nav, role, title, children }: { nav: NavItem[]; role: "passenger" | "admin"; title: string; children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);
  useEffect(() => setOpen(false), [pathname]);

  if (loading || !user) return <Spinner label="Checking your session" />;
  // UX only. The backend enforces authorization on every admin request.
  if (role === "admin" && user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <ErrorState message="You do not have access to the administrator area." />
        <div className="mt-4 text-center">
          <Link href="/dashboard" className="text-sm font-semibold text-brand">Go to your dashboard</Link>
        </div>
      </div>
    );
  }

  const items = (
    <ul className="space-y-1">
      {nav.map((n) => {
        const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-brand/10 text-brand" : "text-muted hover:bg-surface2 hover:text-fg",
              )}
            >
              <span aria-hidden>{n.icon}</span>
              {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-line bg-surface/60 p-4 lg:block no-print">
        <div className="mb-6 px-2"><Logo href="/" /></div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
        <nav aria-label={title}>{items}</nav>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-bg/80 px-4 backdrop-blur-xl no-print">
          <button className="rounded-xl border border-line bg-surface p-2.5 lg:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}>
            <Menu className="h-4 w-4" aria-hidden />
          </button>
          <div className="hidden text-sm text-muted lg:block">
            Signed in as <span className="font-semibold text-fg">{user.full_name}</span>
            {user.role === "admin" && <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">Admin</span>}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout();
                router.push("/");
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </Button>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface p-4">
            <div className="mb-6 flex items-center justify-between">
              <Logo href="/" />
              <button onClick={() => setOpen(false)} aria-label="Close navigation" className="rounded-lg p-1.5 text-muted hover:bg-surface2">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <nav aria-label={title}>{items}</nav>
          </aside>
        </div>
      )}
    </div>
  );
}
