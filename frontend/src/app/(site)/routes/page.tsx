"use client";

import { SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RouteCard } from "@/components/features/RouteCard";
import { SearchForm } from "@/components/features/SearchForm";
import { Select } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/States";
import { ButtonLink } from "@/components/ui/Button";
import type { Paged, Route } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";

function RoutesView() {
  const router = useRouter();
  const sp = useSearchParams();
  const origin = sp.get("origin") ?? "";
  const destination = sp.get("destination") ?? "";
  const sort = sp.get("sort") ?? "name";
  const maxFare = sp.get("max_fare") ?? "";
  const maxFreq = sp.get("max_frequency") ?? "";

  const { data, error, loading, reload } = useFetch<Paged<Route>>("/routes", {
    origin,
    destination,
    sort,
    max_fare: maxFare,
    max_frequency: maxFreq,
  });

  function update(patch: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace(`/routes${p.toString() ? `?${p}` : ""}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <PageHeader title="Explore routes" description="Search by origin and destination, then filter and sort the results." />
      <Card className="bg-surface p-5 sm:p-7">
        <SearchForm key={`${origin}|${destination}`} initialOrigin={origin} initialDestination={destination} onSearch={(o, d) => update({ origin: o, destination: d })} />
        <div className="mt-5 grid gap-3 border-t border-line/60 pt-5 sm:grid-cols-3">
          <Select label="Sort by" value={sort} onChange={(e) => update({ sort: e.target.value === "name" ? "" : e.target.value })}>
            <option value="name">Route name</option>
            <option value="fare">Lowest fare</option>
            <option value="distance">Shortest distance</option>
            <option value="frequency">Most frequent</option>
          </Select>
          <Select label="Maximum fare" value={maxFare} onChange={(e) => update({ max_fare: e.target.value })}>
            <option value="">Any fare</option>
            <option value="30">Up to ₹30</option>
            <option value="60">Up to ₹60</option>
            <option value="100">Up to ₹100</option>
            <option value="150">Up to ₹150</option>
          </Select>
          <Select label="Frequency" value={maxFreq} onChange={(e) => update({ max_frequency: e.target.value })}>
            <option value="">Any frequency</option>
            <option value="20">Every 20 min or better</option>
            <option value="30">Every 30 min or better</option>
            <option value="45">Every 45 min or better</option>
          </Select>
        </div>
      </Card>

      <div className="mt-6" aria-live="polite">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <div className="space-y-4"><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={<SlidersHorizontal className="h-6 w-6" />}
            title="No routes match your search"
            message="Check the spelling, try a nearby stop, or clear the filters. Remember that direction matters: the destination must come after the origin on the route."
            action={<ButtonLink href="/routes" variant="secondary" size="sm">Clear search</ButtonLink>}
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">{data?.total} route{data?.total === 1 ? "" : "s"} found</p>
            <div className="grid gap-4">{data?.items.map((r) => <RouteCard key={r.id} route={r} />)}</div>
          </>
        )}
      </div>
    </div>
  );
}

export default function RoutesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-10 sm:px-8"><Skeleton className="h-64" /></div>}>
      <RoutesView />
    </Suspense>
  );
}
