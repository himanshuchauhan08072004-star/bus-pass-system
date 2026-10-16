"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, buildQuery, errorMessage } from "./api";

type Query = Record<string, string | number | boolean | null | undefined>;

export function useFetch<T>(path: string | null, query?: Query) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(path !== null);
  const seq = useRef(0);
  const key = path === null ? null : path + buildQuery(query);

  const load = useCallback(async () => {
    if (key === null) return;
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api<T>(key);
      if (mine === seq.current) setData(res);
    } catch (e) {
      if (mine === seq.current) setError(errorMessage(e));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
