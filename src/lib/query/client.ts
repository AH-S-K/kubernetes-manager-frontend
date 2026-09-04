import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";

/** Cadence while DB state is in flight (state columns are never cached). */
export const POLL_INTERVAL_MS = 3_000;
/** Live pod/replica data is Redis-cached 60s server-side (k8s.py) —
 *  polling faster than this just re-reads the same cache. */
export const ROLLOUT_POLL_INTERVAL_MS = 10_000;

/** Freshness window before focus/mount-triggered background refetches. */
export const STALE_TIME_MS = 15_000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          // 4xx are deterministic (validation, 404, 409) — retrying only
          // delays the error state the UI should show.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return false;
          }
          // Network blips / 5xx / 502 (K8s unavailable): retry twice, then surface.
          return failureCount < 2;
        },
      },
      mutations: {
        // Mutations report immediately (inline field errors or toast) — never retry.
        retry: false,
      },
    },
  });
}