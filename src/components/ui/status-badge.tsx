import type { HTMLAttributes } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MinusCircle,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppState, BackupStatus, ClusterState, NamespaceState } from "@/types/api";

type Tone = "success" | "info" | "danger" | "warning" | "neutral";

interface BadgeConfig {
  label: string;
  icon: LucideIcon;
  tone: Tone;
  /** Transient states animate the icon (Master Skill §2.2 — no fake completion). */
  spin?: boolean;
}

/** Every entity + backup + pod state → { label, icon, tone }. Unknown → neutral. */
const STATE_CONFIG: Record<string, BadgeConfig> = {
  // Cluster / Namespace / App states
  ACTIVE: { label: "Active", icon: CheckCircle2, tone: "success" },
  CREATING: { label: "Creating", icon: Loader2, tone: "info", spin: true },
  UPDATING: { label: "Updating", icon: Loader2, tone: "info", spin: true },
  DELETING: { label: "Deleting", icon: Loader2, tone: "info", spin: true },
  CREATE_FAILED: { label: "Create failed", icon: AlertTriangle, tone: "danger" },
  UPDATE_FAILED: { label: "Update failed", icon: AlertTriangle, tone: "danger" },
  DELETE_FAILED: { label: "Delete failed", icon: AlertTriangle, tone: "danger" },
  MISSING: { label: "Missing", icon: MinusCircle, tone: "neutral" },
  ERROR: { label: "Error", icon: AlertTriangle, tone: "danger" },
  UNREACHABLE: { label: "Unreachable", icon: WifiOff, tone: "warning" },
  // Backup statuses (lowercase per models.BackupStatus)
  pending: { label: "Pending", icon: MinusCircle, tone: "neutral" },
  running: { label: "Running", icon: Loader2, tone: "info", spin: true },
  completed: { label: "Completed", icon: CheckCircle2, tone: "success" },
  failed: { label: "Failed", icon: AlertTriangle, tone: "danger" },
  // Kubernetes pod phases & waiting reasons (App detail → Pods table).
  // Case split is deliberate: lowercase "running"/"pending" above belong to
  // BackupStatus; capitalized pod phases are distinct keys.
  Running: { label: "Running", icon: CheckCircle2, tone: "success" },
  Pending: { label: "Pending", icon: Loader2, tone: "info", spin: true },
  Succeeded: { label: "Succeeded", icon: CheckCircle2, tone: "success" },
  Terminating: { label: "Terminating", icon: Loader2, tone: "info", spin: true },
  ContainerCreating: { label: "Container creating", icon: Loader2, tone: "info", spin: true },
  CrashLoopBackOff: { label: "CrashLoopBackOff", icon: AlertTriangle, tone: "danger" },
  ImagePullBackOff: { label: "ImagePullBackOff", icon: AlertTriangle, tone: "danger" },
  ErrImagePull: { label: "ErrImagePull", icon: AlertTriangle, tone: "danger" },
  Evicted: { label: "Evicted", icon: AlertTriangle, tone: "danger" },
  NotReady: { label: "Not ready", icon: AlertTriangle, tone: "warning" },
};

const TONE_CLASSES: Record<Tone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
  info:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300",
  danger:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300",
  neutral: "border-border bg-muted text-muted-foreground",
};

/** Autocompletes known states, still accepts arbitrary strings (e.g. Pod phases). */
export type BadgeState =
  | ClusterState
  | NamespaceState
  | AppState
  | BackupStatus
  | (string & {});

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  state: BadgeState;
  /** Override the humanized label (e.g. Pod names like "CrashLoopBackOff" pass through). */
  label?: string;
  size?: "sm" | "default";
}

export function StatusBadge({
  state,
  label,
  size = "default",
  className,
  ...props
}: StatusBadgeProps) {
  const config =
    STATE_CONFIG[state] ?? { label: state, icon: MinusCircle, tone: "neutral" as const };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        TONE_CLASSES[config.tone],
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className={cn("h-3.5 w-3.5 shrink-0", config.spin && "animate-spin")} />
      {label ?? config.label}
    </span>
  );
}