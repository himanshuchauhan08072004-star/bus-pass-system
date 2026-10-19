"use client";

import { useState } from "react";
import { BusesTab } from "@/components/admin/StopsBusesFares";
import { FaresTab, StopsTab } from "@/components/admin/StopsBusesFares";
import { RoutesTab } from "@/components/admin/RoutesTab";
import { PageHeader } from "@/components/ui/States";
import { cn } from "@/lib/format";

const TABS = [
  { id: "routes", label: "Routes" },
  { id: "stops", label: "Stops" },
  { id: "fares", label: "Fares" },
  { id: "buses", label: "Buses" },
] as const;

export default function AdminRoutesPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("routes");
  return (
    <>
      <PageHeader title="Routes, stops & fares" description="Manage the network, route-stop sequences, fare rules and fleet." />
      <div role="tablist" aria-label="Network sections" className="mb-6 inline-flex flex-wrap gap-1 rounded-full border border-line/70 bg-surface/90 p-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} id={`tab-${t.id}`} onClick={() => setTab(t.id)}
            className={cn("rounded-full px-4 py-2 text-sm font-semibold transition-colors", tab === t.id ? "bg-brand text-brand-fg" : "text-muted hover:text-fg")}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "routes" && <RoutesTab />}
        {tab === "stops" && <StopsTab />}
        {tab === "fares" && <FaresTab />}
        {tab === "buses" && <BusesTab />}
      </div>
    </>
  );
}
