/**
 * Ground-truth types mirroring core/models.py and core/serializers.py.
 * JSON field names are snake_case exactly as Django returns them.
 */

/* ─────────────────────────── State enums ─────────────────────────── */

export type ClusterState = "ACTIVE" | "UNREACHABLE";

export type NamespaceState =
  | "CREATING"
  | "ACTIVE"
  | "DELETING"
  | "CREATE_FAILED"
  | "DELETE_FAILED"
  | "MISSING"
  | "ERROR";

export type AppState =
  | "CREATING"
  | "ACTIVE"
  | "UPDATING"
  | "DELETING"
  | "CREATE_FAILED"
  | "UPDATE_FAILED"
  | "DELETE_FAILED"
  | "MISSING"
  | "ERROR";

export type BackupStatus = "pending" | "running" | "completed" | "failed";

/**
 * Async polling rule: transient states MUST be polled (refetchInterval)
 * until a terminal state is reached. Helpers consumed by React Query wiring.
 */
const TRANSIENT = new Set<string>(["CREATING", "UPDATING", "DELETING"]);
const TRANSIENT_BACKUP = new Set<string>(["pending", "running"]);

export const isTransient = (state: string | null | undefined): boolean =>
  !!state && TRANSIENT.has(state);

export const isTransientBackup = (status: string | null | undefined): boolean =>
  !!status && TRANSIENT_BACKUP.has(status);

const RECONCILABLE = new Set<string>([
  "CREATE_FAILED", "UPDATE_FAILED", "DELETE_FAILED", "MISSING", "ERROR",
]);
export const isReconcilable = (state: string | null | undefined): boolean =>
  !!state && RECONCILABLE.has(state);
/* ─────────────────────────── Cluster ─────────────────────────────── */

/** ClusterReadSerializer — GET /api/v1/clusters/ */
export interface Cluster {
  id: number;
  name: string;
  address: string;
  /** Derived server-side: token decrypts → ACTIVE, else UNREACHABLE. */
  state: ClusterState;
  namespace_count: number;
  created_at: string; // ISO 8601
}

/** ClusterCreateSerializer — POST /api/v1/clusters/ (token/ca_cert are write-only) */
export interface ClusterCreatePayload {
  name: string;
  address: string;
  token: string;
  ca_cert?: string;
}

/* ─────────────────────────── Namespace ───────────────────────────── */

/** NamespaceReadSerializer — GET /api/v1/namespaces/?cluster_id=… */
export interface Namespace {
  id: number;
  cluster_id: number;
  name: string;
  state: NamespaceState;
  app_count: number;
  created_at: string;
  updated_at: string;
}

export interface NamespaceCreatePayload {
  cluster_id: number;
  name: string;
}

/* ─────────────────────────── App & Pod ───────────────────────────── */

/**
 * Read shape inferred from models.App + app_service.app_basic_dict().
 * core/services/apps.py was NOT in the provided source — optional fields
 * are parsed defensively (see parseApp in lib/api/endpoints.ts).
 */
export interface App {
  id: number;
  namespace_id: number;
  namespace_name?: string;
  name: string;
  image: string;
  replicas: number;
  cpu: string;
  memory: string;
  state: AppState;
  created_at?: string;
  updated_at?: string;
  ready?: boolean;
  deployment_found?: boolean;
  desired_replicas?: number;
  available_replicas?: number;
}

export interface Pod {
  name: string;
  status: string; // "Running" | "Pending" | "CrashLoopBackOff" | …
  ready: boolean;
}


/** get_app_detail() — assumed to be the app row plus its pod list. */
export interface AppDetail extends App {
  pods: Pod[];
}

export interface AppCreatePayload {
  namespace_id: number;
  name: string;
  image: string;
  replicas: number;
  cpu: string;
  memory: string;
}

/** AppUpdateSerializer — all fields optional (PATCH semantics). */
export type AppUpdatePayload = Partial<
  Pick<AppCreatePayload, "image" | "replicas" | "cpu" | "memory">
>;

/* ─────────────────────────── Backup (extension surface) ──────────── */

export interface Backup {
  backup_id: string;
  app_id: number;
  source_path: string;
  status: BackupStatus;
  file_path: string;
  created_at: string;
  updated_at: string;
}

export interface BackupTriggerPayload {
  app_id: number;
  source_path: string;
  /** Optional 5-field cron expression, e.g. "0 3 * * *". */
  schedule?: string;
}

export type BackupDetail = Pick<Backup, "backup_id" | "app_id" | "status">;

/* ─────────────────────────── Error envelope ──────────────────────── */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "KUBERNETES_UNAVAILABLE"
  | "KUBERNETES_CONFLICT"
  | "KUBERNETES_FORBIDDEN"
  | "INTERNAL_ERROR"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"; // client-side only: no response at all

/** Exactly what core/exceptions.py returns for handled failures. */
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}