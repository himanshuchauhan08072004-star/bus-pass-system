"use client";

import { IdCard, LayoutDashboard, Ticket, UserCircle, Map } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

const nav: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: <LayoutDashboard className="h-4 w-4" />, exact: true },
  { href: "/routes", label: "Explore routes", icon: <Map className="h-4 w-4" />, exact: true },
  { href: "/dashboard/bookings", label: "My bookings", icon: <Ticket className="h-4 w-4" /> },
  { href: "/dashboard/passes", label: "My passes", icon: <IdCard className="h-4 w-4" /> },
  { href: "/dashboard/profile", label: "Profile", icon: <UserCircle className="h-4 w-4" /> },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell nav={nav} role="passenger" title="Passenger">
      {children}
    </AppShell>
  );
}
