/**
 * Central Axios client.
 * Parses the backend's `{ error: { code, message, details } }` envelope
 * (core/exceptions.py) into a typed ApiError and flattens DRF field errors
 * for inline form mapping.
 */
import axios, { AxiosInstance } from "axios";

/* ─────────────────────────── small guards ────────────────────────── */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/* ─────────────────────────── Typed error ─────────────────────────── */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Raw `details` from the backend — also feeds "Show Technical Details". */
  readonly details: Record<string, unknown>;
  /** DRF field errors flattened to `{ fieldName: string[] }` for inline errors. */
  readonly fieldErrors: Record<string, string[]>;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    fieldErrors?: Record<string, string[]>;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? {};
    this.fieldErrors = init.fieldErrors ?? {};
  }

  get isValidation(): boolean {
    return this.code === "VALIDATION_ERROR";
  }

  /** Drives the global amber "Cluster unreachable" banner. */
  get isKubernetesUnavailable(): boolean {
    return this.code === "KUBERNETES_UNAVAILABLE";
  }

  get isNotFound(): boolean {
    return this.code === "NOT_FOUND";
  }

  /**
   * Best text for a toast/banner. DRF returns the literal message
   * "Request failed." for per-field validation errors (see _format_drf_detail),
   * which is useless on its own — point at the highlighted fields instead.
   */
  get userMessage(): string {
    if (this.isValidation && Object.keys(this.fieldErrors).length > 0) {
      return "Please fix the highlighted fields and try again.";
    }
    return this.message;
  }

  static from(err: unknown): ApiError {
    return err instanceof ApiError ? err : normalizeError(err);
  }
}

/* ─────────────────────────── normalization ───────────────────────── */

const STATUS_MESSAGES: Record<number, string> = {
  400: "The request was rejected. Check the highlighted fields.",
  401: "Authentication required.",
  403: "You do not have permission to perform this action.",
  404: "The requested resource does not exist (it may have been deleted).",
  409: "The resource already exists or is in a conflicting state.",
  500: "Unexpected server error. Try again in a moment.",
  502: "Cannot communicate with Kubernetes.",
  503: "The service is temporarily unavailable.",
  504: "The server took too long to respond.",
};

function toMessages(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(toMessages);
  if (isRecord(value)) {
    if (typeof value["message"] === "string") return [value["message"]];
    if (typeof value["detail"] === "string") return [value["detail"]];
  }
  return [];
}

/**
 * DRF field errors arrive in `details`, e.g.
 *   { name: ["Name must be lowercase…"], cpu: ["Invalid CPU quantity…"] }
 * "detail" / "non_field_errors" are form-level (banner), not tied to a field.
 * DomainError details may be arbitrary (e.g. { app_id: 5 }) — non-text values
 * are intentionally ignored here.
 */
function flattenFieldErrors(details: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!isRecord(details)) return out;

  for (const [key, value] of Object.entries(details)) {
    const messages = toMessages(value);
    if (messages.length === 0) continue;
    const field = key === "non_field_errors" ? "detail" : key;
    out[field] = [...(out[field] ?? []), ...messages];
  }
  return out;
}

export function normalizeError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 0;
    const data: unknown = err.response?.data;

    // 1) Backend envelope (DomainErrors + mapped DRF errors).
    if (isRecord(data) && isRecord(data["error"])) {
      const e = data["error"];
      const details = isRecord(e["details"]) ? e["details"] : {};
      const fallback = STATUS_MESSAGES[status] ?? "Request failed.";
      return new ApiError({
        status,
        code: typeof e["code"] === "string" ? e["code"] : "HTTP_ERROR",
        message:
          typeof e["message"] === "string" && e["message"]
            ? e["message"]
            : fallback,
        details,
        fieldErrors: flattenFieldErrors(details),
      });
    }

    // 2) Request never reached the backend (CORS, DNS, down, timeout).
    if (status === 0) {
      return new ApiError({
        status: 0,
        code: "NETWORK_ERROR",
        message:
          err.code === "ECONNABORTED"
            ? "The server took too long to respond. Try again."
            : "Cannot reach the API server. Check your connection or try again.",
      });
    }

    // 3) Response without the envelope (reverse-proxy HTML pages, plain DRF…).
    return new ApiError({
      status,
      code: "HTTP_ERROR",
      message: STATUS_MESSAGES[status] ?? `Request failed with status ${status}.`,
      details: isRecord(data) ? data : {},
    });
  }

  return new ApiError({
    status: 0,
    code: "INTERNAL_ERROR",
    message: err instanceof Error ? err.message : "Unexpected client error.",
  });
}

/* ─────────────────────────── global error bus ────────────────────── */

type ErrorListener = (error: ApiError) => void;
const listeners = new Set<ErrorListener>();

/**
 * Register a global handler (toast/banner system). Called for EVERY failed
 * request — the UI layer decides filtering (e.g. skip NOT_FOUND on background
 * refetches, route VALIDATION_ERROR to inline fields instead of a toast).
 * Returns an unsubscribe function.
 */
export function onApiError(listener: ErrorListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ─────────────────────────── instance ────────────────────────────── */

const client: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  // K8s-backed operations can be slow server-side; don't abort mutations early.
  timeout: 30_000,
});

client.interceptors.response.use(undefined, (error: unknown) => {
  const apiError = normalizeError(error);
  listeners.forEach((listener) => listener(apiError));
  return Promise.reject(apiError);
});

/* ─────────────────────────── typed helpers ───────────────────────── */

export const http = {
  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const res = await client.get<T>(url, { params });
    return res.data;
  },
  async post<T>(url: string, body?: unknown): Promise<T> {
    const res = await client.post<T>(url, body);
    return res.data;
  },
  async patch<T>(url: string, body: unknown): Promise<T> {
    const res = await client.patch<T>(url, body);
    return res.data;
  },
  /** 204 No Content — resolves only after the server confirms the delete. */
  async delete(url: string): Promise<void> {
    await client.delete(url);
  },
};