"use client";

import { useState, useEffect } from "react";

/**
 * Fetches data from an API endpoint on mount.
 * Uses `fallback` as initial data so the page renders instantly
 * (since seeded DB data matches hardcoded data, no visual flash).
 */
export function useApiData<T>(fetcher: () => Promise<T>, fallback: T): { data: T; loading: boolean } {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then(result => { if (!cancelled) setData(result); })
      .catch(() => {}) // fallback stays — hardcoded data works fine offline
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading };
}
