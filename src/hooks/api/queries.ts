/**
 * Read hooks. Async contract (Master Skill §2.2): lists/details poll every
 * POLL_INTERVAL_MS while any entity is transient (or, for apps, while a
 * rollout is still converging) and stop automatically at terminal states.
 * Errors arrive pre-parsed as ApiError via the interceptor.
 */
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { appApi, clusterApi, namespaceApi, queryKeys } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { POLL_INTERVAL_MS, ROLLOUT_POLL_INTERVAL_MS } from "@/lib/query/client";
import { isReconcilable, isTransient } from "@/types/api";
import type { App, AppDetail, Cluster, Namespace } from "@/types/api";

/** Structural subset of TanStack's Query that the interval callbacks need. */
interface QueryLike<T> {
  state: { data: T | undefined };
}

/** True when an ACTIVE app is still converging (rollout not finished). */
export function isRollingOut(app: App): boolean {
  if (app.state !== "ACTIVE") return false;
  if (app.deployment_found === false) return false;
  if (typeof app.ready === "boolean") return !app.ready;
  if (typeof app.available_replicas === "number") {
    const desired = app.desired_replicas ?? app.replicas;
    return app.available_replicas < desired;
  }
  return false;
}


/** Poll a list while ANY row is mid-flight (CREATING / UPDATING / DELETING). */
function pollWhileAnyTransient(
  query: QueryLike<{ state: string }[]>,
): number | false {
  return query.state.data?.some(
    (e) => isTransient(e.state) || isReconcilable(e.state),
  )
    ? POLL_INTERVAL_MS
    : false;
}


/** App lists also poll while any rollout is still converging. */
function pollWhileAppsConverging(query: QueryLike<App[]>): number | false {
  const apps = query.state.data;
  if (!apps) return false;
  if (apps.some((a) => isTransient(a.state) || isReconcilable(a.state)))
    return POLL_INTERVAL_MS;
  if (apps.some(isRollingOut)) return ROLLOUT_POLL_INTERVAL_MS;
  return false;
}


/**
 * App detail: transient state, an ACTIVE rollout still converging, or any
 * pod explicitly not ready (pods table updates in real-time as K8s
 * provisions them). ready === null/undefined ⇒ unknown, deliberately ignored.
 */
function pollWhileAppConverging(query: QueryLike<AppDetail>): number | false {
  const app = query.state.data;
  if (!app) return false;
  if (isTransient(app.state) || isReconcilable(app.state))
    return POLL_INTERVAL_MS;
  if (isRollingOut(app)) return ROLLOUT_POLL_INTERVAL_MS;
  return false;
}

export function useClusters(): UseQueryResult<Cluster[], ApiError> {
  return useQuery<Cluster[], ApiError>({
    queryKey: queryKeys.clusters,
    queryFn: clusterApi.list,
    // Cluster.state is derived server-side (ACTIVE/UNREACHABLE) — never
    // transient, so no polling; mutations keep counts fresh via invalidation.
  });
}

export function useNamespaces(clusterId: number): UseQueryResult<Namespace[], ApiError> {
  return useQuery<Namespace[], ApiError>({
    queryKey: queryKeys.namespaces(clusterId),
    queryFn: () => namespaceApi.list(clusterId),
    // Guards against NaN from an unparseable :clusterId route param.
    enabled: Number.isFinite(clusterId),
    refetchInterval: pollWhileAnyTransient,
  });
}

export function useApps(namespaceId: number): UseQueryResult<App[], ApiError> {
  return useQuery<App[], ApiError>({
    queryKey: queryKeys.apps(namespaceId),
    queryFn: () => appApi.list(namespaceId),
    enabled: Number.isFinite(namespaceId),
    refetchInterval: pollWhileAppsConverging,
  });
}

export function useApp(appId: number): UseQueryResult<AppDetail, ApiError> {
  return useQuery<AppDetail, ApiError>({
    queryKey: queryKeys.app(appId),
    queryFn: () => appApi.detail(appId),
    enabled: Number.isFinite(appId),
    refetchInterval: pollWhileAppConverging,
  });
}

/**
 * Single cluster. Ground truth: core/urls.py exposes no GET /clusters/:id —
 * only the list endpoint. So we share the ["clusters"] cache entry with
 * useClusters(): navigating from the list renders instantly from cache
 * (zero extra requests); deep-linking fetches the list once and `select`
 * projects the entity. Mutations already invalidate ["clusters"], so both
 * consumers stay in sync (e.g. UNREACHABLE → ACTIVE transitions).
 */
export function useCluster(
  clusterId: number,
): UseQueryResult<Cluster | undefined, ApiError> {
  return useQuery<Cluster[], ApiError, Cluster | undefined>({
    queryKey: queryKeys.clusters,
    queryFn: clusterApi.list,
    enabled: Number.isFinite(clusterId) && clusterId > 0,
    select: (clusters) => clusters.find((c) => c.id === clusterId),
  });
}

export interface NamespaceLookup {
  namespace: Namespace | undefined;
  isLoading: boolean;
  isError: boolean;
  error: ApiError | null;
}

/**
 * Single namespace, resolved WITHOUT a dedicated endpoint — core/urls.py
 * exposes no GET /namespaces/:id, only ?cluster_id= lists. Two modes:
 *
 *  - clusterId provided (Apps page): one scoped list fetch + select. Cache
 *    key is shared with useNamespaces(clusterId), so arriving from the
 *    Namespaces page renders instantly with zero extra requests.
 *
 *  - clusterId omitted (cold deep link into /apps/:appId): scan each
 *    cluster's namespace list until one contains the id. Worst case is N
 *    lightweight list requests, once, on a cold deep link — the tradeoff for
 *    a backend that offers no single-namespace read. Everything is cached
 *    under the same keys the rest of the app uses.
 */
export function useNamespace(namespaceId: number, clusterId?: number): NamespaceLookup {
  const qc = useQueryClient();
  const enabled = Number.isFinite(namespaceId) && namespaceId > 0;

  // Fast path: parent cluster known
  const scoped = useQuery<Namespace[], ApiError, Namespace | undefined>({
    queryKey: queryKeys.namespaces(clusterId ?? 0),
    queryFn: () => namespaceApi.list(clusterId ?? 0),
    enabled: enabled && clusterId !== undefined,
    select: (rows) => rows.find((ns) => ns.id === namespaceId),
    refetchInterval: pollWhileAnyTransient,
  });

  // Scan path: single query with sequential, early-stopping fetch.
  // No refetchInterval → no foreign pollers installed on this page.
  const needsScan = enabled && clusterId === undefined;
  const scan = useQuery<Namespace | null, ApiError>({
    queryKey: ["namespace-scan", namespaceId],
    enabled: needsScan,
    queryFn: async ({ signal }) => {
      const clusters = await clusterApi.list();
      for (const cluster of clusters) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        const key = queryKeys.namespaces(cluster.id);
        const cached = qc.getQueryData<Namespace[]>(key);
        const rows = cached ?? (await namespaceApi.list(cluster.id));
        if (!cached) qc.setQueryData(key, rows); // warm cache
        const found = rows.find((ns) => ns.id === namespaceId);
        if (found) return found; // early stop — no exhaustive fan-out
      }
      return null; // not found → page degrades gracefully
    },
  });

  if (clusterId !== undefined) {
    return {
      namespace: scoped.data,
      isLoading: scoped.isPending,
      isError: scoped.isError,
      error: scoped.error,
    };
  }
  return {
    namespace: scan.data ?? undefined,
    isLoading: scan.isPending,
    isError: scan.isError,
    error: scan.error,
  };
}