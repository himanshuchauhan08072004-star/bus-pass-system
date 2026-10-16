"use client";

import { useEffect, useState } from "react";
import type { Paged } from "./types";
import { useFetch } from "./useFetch";

export const PAGE_SIZE = 15;

/** Paged admin list. Resets to the first page whenever the filters change. */
export function usePaged<T>(path: string, filters: Record<string, string | number | undefined> = {}) {
  const [offset, setOffset] = useState(0);
  const filterKey = JSON.stringify(filters);
  useEffect(() => setOffset(0), [filterKey]);
  const res = useFetch<Paged<T>>(path, { ...filters, limit: PAGE_SIZE, offset });
  return { ...res, items: res.data?.items, total: res.data?.total ?? 0, offset, setOffset, limit: PAGE_SIZE };
}
