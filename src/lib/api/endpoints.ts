/**
 * One function per backend route (core/urls.py).
 * Django requires trailing slashes — kept exactly as declared server-side.
 */
import { http, isRecord } from "./client";
import type {
  App,
  AppCreatePayload,
  AppDetail,
  AppState,
  AppUpdatePayload,
  BackupDetail,
  BackupStatus,
  BackupTriggerPayload,
  Cluster,
  ClusterCreatePayload,
  ClusterState,
  Namespace,
  NamespaceCreatePayload,
  NamespaceState,
  Pod,
} from "@/types/api";

/* ─────────────────────────── routes ──────────────────────────────── */

const routes = {
  clusters: "/clusters/",
  namespaces: "/namespaces/",
  namespace: (id: number | string) => `/namespaces/${id}/`,
  apps: "/apps/",
  app: (id: number | string) => `/apps/${id}/`,
  backups: "/backup/",
  backup: (backupId: string) => `/backup/${encodeURIComponent(backupId)}/`,
};

/* ─────────── tolerant parsing (services.py was not provided) ───────
 * list_clusters()/list_namespaces() are bare arrays (DRF many=True) — ground
 * truth. But app_service.list_apps()/get_app_detail() shapes are inferred,
 * so everything below parses defensively and normalizes to our types.
 * ──────────────────────────────────────────────────────────────────── */

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function parseCluster(raw: unknown): Cluster {
  const r = isRecord(raw) ? raw : {};
  return {
    id: toNumber(r["id"]) ?? 0,
    name: toString(r["name"]),
    address: toString(r["address"]),
    state: (toString(r["state"]) || "UNREACHABLE") as ClusterState,
    namespace_count: toNumber(r["namespace_count"]) ?? 0,
    created_at: toString(r["created_at"]),
  };
}

export function parseNamespace(raw: unknown): Namespace {
  const r = isRecord(raw) ? raw : {};
  return {
    id: toNumber(r["id"]) ?? 0,
    cluster_id: toNumber(r["cluster_id"]) ?? 0,
    name: toString(r["name"]),
    state: (toString(r["state"]) || "MISSING") as NamespaceState,
    app_count: toNumber(r["app_count"]) ?? 0,
    created_at: toString(r["created_at"]),
    updated_at: toString(r["updated_at"]),
  };
}

export function parsePod(raw: unknown): Pod {
  const r = isRecord(raw) ? raw : {};
  return {
    name: toString(r["name"]),
    status: toString(r["phase"], "Unknown"),
    ready: r["ready"] === true,
    restarts: toNumber(r["restarts"]) ?? 0,
    pod_ip: typeof r["pod_ip"] === "string" ? r["pod_ip"] : undefined,
    node_name: typeof r["node_name"] === "string" ? r["node_name"] : undefined,
    created_at: typeof r["created_at"] === "string" ? r["created_at"] : undefined,
  };
}


export function parseApp(raw: unknown): App {
  const r = isRecord(raw) ? raw : {};
  const namespaceId =
    toNumber(r["namespace_id"]) ??
    (isRecord(r["namespace"]) ? toNumber(r["namespace"]["id"]) : null) ??
    0;

  const desired = toNumber(r["desired_replicas"]) ?? toNumber(r["replicas"]) ?? 0;
  const available = toNumber(r["available_replicas"]);

  return {
    id: toNumber(r["id"]) ?? 0,
    namespace_id: namespaceId,
    namespace_name: typeof r["namespace"] === "string" ? r["namespace"] : undefined,
    name: toString(r["name"]),
    image: toString(r["image"]),
    replicas: desired,
    cpu: toString(r["cpu"]),
    memory: toString(r["memory"]),
    state: (toString(r["state"]) || "MISSING") as AppState,
    created_at: typeof r["created_at"] === "string" ? r["created_at"] : undefined,
    updated_at: typeof r["updated_at"] === "string" ? r["updated_at"] : undefined,
    ready: typeof r["ready"] === "boolean" ? r["ready"] : undefined,
    deployment_found: typeof r["deployment_found"] === "boolean" ? r["deployment_found"] : true,
    desired_replicas: desired,
    available_replicas: available ?? undefined,
    pods: (Array.isArray(r["pods"]) ? r["pods"] : []).map(parsePod),
  };
}


export function parseAppDetail(data: unknown): AppDetail {
  const r = isRecord(data) ? data : {};
  return {
    ...parseApp(r),
    pods: (Array.isArray(r["pods"]) ? r["pods"] : []).map(parsePod),
  };
}

/** Bare array (ground truth) with tolerance for {results|apps|…: []} wrappers. */
function parseList<T>(data: unknown, parse: (raw: unknown) => T): T[] {
  if (Array.isArray(data)) return data.map(parse);
  if (isRecord(data)) {
    for (const key of ["results", "apps", "namespaces", "clusters"]) {
      const value = data[key];
      if (Array.isArray(value)) return value.map(parse);
    }
  }
  return [];
}

/* ─────────────────────────── endpoints ───────────────────────────── */

export const clusterApi = {
  list: (): Promise<Cluster[]> =>
    http.get<unknown>(routes.clusters).then((d) => parseList(d, parseCluster)),

  create: (payload: ClusterCreatePayload): Promise<Cluster> =>
    http.post<unknown>(routes.clusters, payload).then(parseCluster),
};

export const namespaceApi = {
  list: (clusterId: number): Promise<Namespace[]> =>
    http
      .get<unknown>(routes.namespaces, { cluster_id: clusterId })
      .then((d) => parseList(d, parseNamespace)),

  create: (payload: NamespaceCreatePayload): Promise<Namespace> =>
    http.post<unknown>(routes.namespaces, payload).then(parseNamespace),

  delete: (id: number): Promise<void> => http.delete(routes.namespace(id)),
};

export const appApi = {
  list: (namespaceId: number, clusterId?: number): Promise<App[]> =>
    http
      .get<unknown>(routes.apps, {
        namespace_id: namespaceId,
        ...(clusterId ? { cluster_id: clusterId } : {}),
      })
      .then((d) => parseList(d, parseApp)),

  create: (payload: AppCreatePayload): Promise<App> =>
    http.post<unknown>(routes.apps, payload).then(parseApp),

  detail: (id: number): Promise<AppDetail> =>
    http.get<unknown>(routes.app(id)).then(parseAppDetail),

  update: (id: number, payload: AppUpdatePayload): Promise<App> =>
    http.patch<unknown>(routes.app(id), payload).then(parseApp),

  delete: (id: number): Promise<void> => http.delete(routes.app(id)),
};

export const backupApi = {
  trigger: (
    payload: BackupTriggerPayload,
  ): Promise<{ backup_id: string; status: BackupStatus }> =>
    http.post(routes.backups, payload), // 202 Accepted → poll via backupApi.detail

  detail: (backupId: string): Promise<BackupDetail> =>
    http.get(routes.backup(backupId)),
};

/* ─────────────────────────── React Query keys ────────────────────── */

export const queryKeys = {
  clusters: ["clusters"] as const,
  namespaces: (clusterId: number) => ["clusters", clusterId, "namespaces"] as const,
  apps: (namespaceId: number) => ["namespaces", namespaceId, "apps"] as const,
  app: (appId: number) => ["apps", appId] as const,
};

