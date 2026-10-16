"use client";

import { ErrorState } from "@/components/ui/States";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-24">
      <ErrorState message="Something went wrong on our side. Please try again." onRetry={reset} />
    </main>
  );
}
