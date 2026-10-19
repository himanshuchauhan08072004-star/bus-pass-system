"use client";

import { ArrowRightLeft, Search } from "lucide-react";
import { useState } from "react";
import { useFetch } from "@/lib/useFetch";
import type { Stop } from "@/lib/types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";

export function SearchForm({ initialOrigin = "", initialDestination = "", onSearch, compact }: { initialOrigin?: string; initialDestination?: string; onSearch: (origin: string, destination: string) => void; compact?: boolean }) {
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const { data: stops } = useFetch<Stop[]>("/stops");

  return (
    <form
      role="search"
      aria-label="Search bus routes"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(origin.trim(), destination.trim());
      }}
      className={`grid gap-3 ${compact ? "md:grid-cols-[1fr_auto_1fr_auto]" : "md:grid-cols-[1fr_auto_1fr_auto]"} items-end`}
    >
      <Input label="From" name="origin" list="stop-options" placeholder="e.g. Gurugram Bus Stand" value={origin} onChange={(e) => setOrigin(e.target.value)} autoComplete="off" />
      <button
        type="button"
        onClick={() => {
          setOrigin(destination);
          setDestination(origin);
        }}
        aria-label="Swap origin and destination"
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-muted transition-all duration-200 hover:rotate-180 hover:text-brand"
      >
        <ArrowRightLeft className="h-4 w-4 rotate-90 md:rotate-0" aria-hidden />
      </button>
      <Input label="To" name="destination" list="stop-options" placeholder="e.g. IGI Airport T3" value={destination} onChange={(e) => setDestination(e.target.value)} autoComplete="off" />
      <Button type="submit" size="md" className="h-11 w-full md:w-auto md:px-7">
        <Search className="h-4 w-4" aria-hidden /> Search routes
      </Button>
      <datalist id="stop-options">
        {(stops ?? []).map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
    </form>
  );
}
