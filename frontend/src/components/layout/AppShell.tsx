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
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200",
                active ? "bg-brand text-brand-fg shadow-glow" : "text-muted hover:bg-surface2/80 hover:text-fg",
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
    <div className="frame lg:grid lg:grid-cols-[236px_1fr]">
      <aside className="hidden border-r border-line/50 bg-sage/20 p-5 lg:flex lg:flex-col no-print">
        <div className="mb-8 px-1"><Logo href="/" /></div>
        <p className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{title}</p>
        <nav aria-label={title}>{items}</nav>
        <div className="mt-auto rounded-3xl bg-peach/40 p-4 text-xs text-muted">
          <p className="font-display text-sm font-semibold text-fg">{user.full_name}</p>
          <p className="mt-0.5 break-all">{user.email}</p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line/50 bg-bg/80 px-4 backdrop-blur-xl sm:px-8 no-print">
          <button className="rounded-full border border-line bg-surface p-2.5 lg:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}>
            <Menu className="h-4 w-4" aria-hidden />
          </button>
          <div className="hidden text-sm text-muted lg:block">
            Signed in as <span className="font-semibold text-fg">{user.full_name}</span>
            {user.role === "admin" && <span className="ml-2 rounded-full bg-peach/60 px-2.5 py-0.5 text-xs font-semibold text-fg">Admin</span>}
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
        <main key={pathname} id="main" className="mx-auto max-w-6xl animate-rise px-4 py-8 sm:px-8">{children}</main>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade bg-stage/60 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 animate-pop rounded-r-3xl border-r border-line/70 bg-surface p-5">
            <div className="mb-6 flex items-center justify-between">
              <Logo href="/" />
              <button onClick={() => setOpen(false)} aria-label="Close navigation" className="rounded-full p-1.5 text-muted hover:bg-surface2">
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
