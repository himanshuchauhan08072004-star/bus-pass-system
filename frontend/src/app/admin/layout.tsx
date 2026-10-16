"use client";

import { Bus, CreditCard, IdCard, LayoutDashboard, Map, ScrollText, Ticket, Users } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

const nav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" />, exact: true },
  { href: "/admin/routes", label: "Routes, stops & fares", icon: <Map className="h-4 w-4" /> },
  { href: "/admin/passes", label: "Passes", icon: <IdCard className="h-4 w-4" /> },
  { href: "/admin/bookings", label: "Bookings", icon: <Ticket className="h-4 w-4" /> },
  { href: "/admin/payments", label: "Payments", icon: <CreditCard className="h-4 w-4" /> },
  { href: "/admin/users", label: "Passengers & users", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/audit", label: "Audit log", icon: <ScrollText className="h-4 w-4" /> },
];
void Bus;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell nav={nav} role="admin" title="Administration">
      {children}
    </AppShell>
  );
}
