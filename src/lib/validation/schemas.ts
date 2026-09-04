/**
 * Zod schemas mirroring core/validators.py 1:1.
 * The backend is the source of truth — these exist for instant client-side
 * feedback (same trim semantics, same regexes, same bounds) and must never
 * be stricter or looser than the server.
 */
import { z } from "zod";
import type {
  AppCreatePayload,
  AppUpdatePayload,
  ClusterCreatePayload,
  NamespaceCreatePayload,
} from "@/types/api";

/* ─────────────────────────── regex ground truth ──────────────────── */

/** validators.NAME_RE */
export const K8S_NAME_RE = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
/** validators.CPU_RE */
export const CPU_RE = /^(?:[0-9]+m|[0-9]+(?:\.[0-9]+)?)$/;
/** validators.MEMORY_RE */
export const MEMORY_RE = /^[0-9]+(?:\.[0-9]+)?(Ki|Mi|Gi|Ti|K|M|G|T)?$/;
/** validators.ADDRESS_RE — applied AFTER scheme/path stripping, like the backend */
export const ADDRESS_RE = /^[a-zA-Z0-9.-]+:\d+$/;

/* ─────────────────────────── helper text ─────────────────────────── */

export const K8S_NAME_HELPER =
  "Lowercase alphanumeric and hyphens only. Must start/end with alphanumeric.";
export const CPU_HELPER = "Examples: 100m, 500m, 1, 1.5";
export const MEMORY_HELPER = "Examples: 128Mi, 512Mi, 1Gi";

/** Quick-pick chips for the App form. */
export const CPU_PRESETS = ["100m", "250m", "500m", "1", "2"] as const;
export const MEMORY_PRESETS = ["128Mi", "256Mi", "512Mi", "1Gi", "2Gi"] as const;

/* ─────────────────────────── field schemas ───────────────────────── */

/** Mirrors validate_k8s_name: trim → required → ≤63 chars → NAME_RE. */
export const k8sNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(63, "Name must be at most 63 characters.")
  .regex(K8S_NAME_RE, K8S_NAME_HELPER);

export const cpuSchema = z
  .string()
  .trim()
  .min(1, "CPU is required.")
  .max(32, "CPU must be at most 32 characters.")
  .regex(CPU_RE, "Invalid CPU quantity. Examples: 100m, 500m, 1, 1.5");


export const memorySchema = z
  .string()
  .trim()
  .min(1, "Memory is required.")
  .max(32, "Memory must be at most 32 characters.")
  .regex(MEMORY_RE, "Invalid memory quantity. Examples: 128Mi, 512Mi, 1Gi");


export const imageSchema = z
  .string()
  .trim()
  .min(1, "Image is required.")
  .max(255, "Image must be at most 255 characters.");

/**
 * Mirrors validate_address: strip scheme + path, then validate host:port.
 * Using .transform().pipe() (zod ≥ 3.20) keeps z.input as `string`, so the
 * RHF resolver typing stays clean.
 */
export const addressSchema = z
  .string()
  .trim()
  .transform((value) => {
    let s = value;
    if (s.includes("://")) s = s.slice(s.indexOf("://") + 3);
    return s.split("/", 1)[0];
  })
  .pipe(
    z
      .string()
      .min(1, "Address is required.")
      .regex(ADDRESS_RE, "Address must be host:port, e.g. 1.2.3.4:6443"),
  );

/**
 * Replicas: accepts "3" or 3 (HTML numeric inputs submit strings).
 * "" → required error (avoids z.coerce pitfall where Number("") === 0).
 * Mirrors AppCreateSerializer: min_value=0, PositiveIntegerField.
 */
export const replicasSchema = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const raw = typeof value === "number" ? value : value.trim();
    if (raw === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Replicas is required." });
      return z.NEVER;
    }
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Replicas must be a number." });
      return z.NEVER;
    }
    return n;
  })
  .pipe(
    z
      .number()
      .int("Replicas must be a whole number.")
      .min(0, "Replicas must be 0 or more."),
  );

/* ─────────────────────────── form schemas ────────────────────────── */

export const clusterFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(128, "Name must be at most 128 characters."),
  address: addressSchema,
  token: z.string().trim().min(1, "Token is required."),
  ca_cert: z.string().trim().optional(),
});
export type ClusterFormValues = z.output<typeof clusterFormSchema>;
export type ClusterFormInput = z.input<typeof clusterFormSchema>;

export const namespaceFormSchema = z.object({
  name: k8sNameSchema,
});
export type NamespaceFormValues = z.output<typeof namespaceFormSchema>;
export type NamespaceFormInput = z.input<typeof namespaceFormSchema>;

export const appFormSchema = z.object({
  name: k8sNameSchema,
  image: imageSchema,
  replicas: replicasSchema,
  cpu: cpuSchema,
  memory: memorySchema,
});

export const appEditSchema = appFormSchema.omit({ name: true });
export type AppEditValues = z.output<typeof appEditSchema>;
export type AppEditInput = z.input<typeof appEditSchema>;

export type AppFormValues = z.output<typeof appFormSchema>;
/** Input variant for RHF (replicas can arrive as string from the DOM). */
export type AppFormInput = z.input<typeof appFormSchema>;

/** Mirrors AppUpdateSerializer + the "No fields to update." guard. */
export const appUpdateSchema = z
  .object({
    image: imageSchema.optional(),
    replicas: replicasSchema.optional(),
    cpu: cpuSchema.optional(),
    memory: memorySchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "No fields to update.",
  });

/* ─────────────────── form → payload adapters ─────────────────────── */

export function toClusterCreatePayload(values: ClusterFormValues): ClusterCreatePayload {
  return {
    name: values.name,
    address: values.address,
    token: values.token,
    ...(values.ca_cert ? { ca_cert: values.ca_cert } : {}),
  };
}

export function toNamespaceCreatePayload(
  clusterId: number,
  values: NamespaceFormValues,
): NamespaceCreatePayload {
  return { cluster_id: clusterId, name: values.name };
}

export function toAppCreatePayload(
  namespaceId: number,
  values: AppFormValues,
): AppCreatePayload {
  return { namespace_id: namespaceId, ...values };
}

export function toAppUpdatePayload(
  values: Partial<AppFormValues>,
): AppUpdatePayload {
  return {
    ...(values.image !== undefined && { image: values.image }),
    ...(values.replicas !== undefined && { replicas: values.replicas }),
    ...(values.cpu !== undefined && { cpu: values.cpu }),
    ...(values.memory !== undefined && { memory: values.memory }),
  };
}