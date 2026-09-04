/**
 * Write hooks. Cache policy:
 *   1. Creates: seed the list cache with the SERVER-returned row (authoritative,
 *      includes derived state like CREATING → list polling kicks in on the next
 *      tick), then invalidate count-bearing lists.
 *   2. Deletes: NO optimistic removal. The row leaves the cache only after the
 *      204; the UI shows a row-level pending spinner meanwhile.
 *   3. Errors: never handled here — the global bus toasts non-validation
 *      failures; forms map VALIDATION_ERROR inline. Success copy lives here so
 *      every caller gets identical toasts.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { appApi, clusterApi, namespaceApi, queryKeys } from "@/lib/api/endpoints";
import type {
  App,
  AppCreatePayload,
  AppUpdatePayload,
  Cluster,
  ClusterCreatePayload,
  Namespace,
  NamespaceCreatePayload,
} from "@/types/api";

/**
 * Key-hierarchy refresher (lib/api/endpoints.ts) — powers prefix invalidation:
 *   ["clusters"]                          → cluster list
 *   ["clusters", clusterId, "namespaces"] → namespace list
 *   ["namespaces", namespaceId, "apps"]   → app list
 *   ["apps", appId]                       → app detail
 */

/* ─────────────────────────── Cluster ─────────────────────────────── */

export function useCreateCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClusterCreatePayload) => clusterApi.create(payload),
    onSuccess: (cluster) => {
      toast.success(`Cluster '${cluster.name}' created successfully.`);
      // Seed for instant feedback; invalidate so the server's canonical
      // ordering/counts reconcile in the background.
      qc.setQueryData<Cluster[]>(queryKeys.clusters, (prev) =>
        prev ? [...prev, cluster] : [cluster],
      );
      qc.invalidateQueries({ queryKey: queryKeys.clusters, exact: true });
    },
  });
}

/* ─────────────────────────── Namespace ───────────────────────────── */

export function useCreateNamespace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: NamespaceCreatePayload) => namespaceApi.create(payload),
    onSuccess: (namespace) => {
      toast.success(`Namespace '${namespace.name}' created successfully.`);
      // Seeding a CREATING row starts list polling immediately.
      qc.setQueryData<Namespace[]>(
        queryKeys.namespaces(namespace.cluster_id),
        (prev) => (prev ? [...prev, namespace] : [namespace]),
      );
      qc.invalidateQueries({ queryKey: queryKeys.namespaces(namespace.cluster_id) });
      // Cluster cards show namespace_count.
      qc.invalidateQueries({ queryKey: queryKeys.clusters, exact: true });
    },
  });
}

export interface DeleteNamespaceVars {
  id: number;
  clusterId: number;
  /** Success-toast copy only. */
  name: string;
}

export function useDeleteNamespace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: DeleteNamespaceVars) => namespaceApi.delete(id),
    onSuccess: (_data, { id, clusterId, name }) => {
      toast.success(`Namespace '${name}' deleted.`);
      // The 204 confirmed it — now (and only now) drop the row.
      qc.setQueryData<Namespace[]>(
        queryKeys.namespaces(clusterId),
        (prev) => prev?.filter((ns) => ns.id !== id),
      );
      qc.invalidateQueries({ queryKey: queryKeys.clusters, exact: true });

      // Cascade hygiene: its apps died server-side. Drop the app-list cache
      // for this namespace (prefix-matches ["namespaces", id, "apps"]) and
      // all cached app details (ids unknown) so stale rows can't reappear.
      qc.removeQueries({ queryKey: ["namespaces", id] });
      qc.removeQueries({ predicate: (query) => query.queryKey[0] === "apps" });
    },
  });
}

/* ───────────────────────────── App ───────────────────────────────── */

export interface CreateAppVars {
  payload: AppCreatePayload;
  /** Route context — not part of the App payload; used to refresh app_count. */
  clusterId: number;
}

export function useCreateApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payload }: CreateAppVars) => appApi.create(payload),
    onSuccess: (app, { payload, clusterId }) => {
      toast.success(`App '${app.name}' created successfully.`);
      // Seed with payload.namespace_id (we know it) — the response's
      // namespace_id is unconfirmed since services.py wasn't provided.
      qc.setQueryData<App[]>(
        queryKeys.apps(payload.namespace_id),
        (prev) => (prev ? [...prev, app] : [app]),
      );
      qc.invalidateQueries({ queryKey: queryKeys.apps(payload.namespace_id) });
      qc.invalidateQueries({ queryKey: queryKeys.namespaces(clusterId), exact: true });
    },
  });
}

export interface UpdateAppVars {
  id: number;
  namespaceId: number;
  payload: AppUpdatePayload;
}

export function useUpdateApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: UpdateAppVars) => appApi.update(id, payload),
    onSuccess: (app, { id, namespaceId }) => {
      toast.success(`App '${app.name}' updated successfully.`);
      qc.invalidateQueries({ queryKey: queryKeys.apps(namespaceId) });
      qc.invalidateQueries({ queryKey: queryKeys.app(id) });
    },
  });
}


export interface DeleteAppVars {
  id: number;
  namespaceId: number;
  clusterId: number;
  /** Success-toast copy only. */
  name: string;
}

export function useDeleteApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: DeleteAppVars) => appApi.delete(id),
    onSuccess: (_data, { id, namespaceId, name }) => {
      toast.success(`App '${name}' deleted.`);
      // 204 confirmed — drop the row and the detail cache (the detail page
      // navigates back; removing prevents a flash of stale data).
      qc.setQueryData<App[]>(queryKeys.apps(namespaceId), (prev) =>
        prev?.filter((a) => a.id !== id),
      );
      qc.removeQueries({ queryKey: queryKeys.app(id) });
      // clusterId may be 0 from the detail page before context resolves —
      // refresh every cached namespace list so app_count stays truthful.
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "clusters" && q.queryKey[2] === "namespaces",
      });
    },
  });
}