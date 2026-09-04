/**
 * Global error surface. Subscribes once to the onApiError bus (lib/api/client.ts).
 * - Suppresses VALIDATION_ERROR (forms render it inline — see lib/forms/apiErrors.ts).
 * - Dedupes bursts (query retries, 3s polling against a downed API) two ways:
 *   a time-window guard, and a stable Sonner id so identical failures update
 *   in place instead of stacking.
 * - Renders the "Show technical details" toggle (code + raw details).
 * - Renders <ThemedToaster/> so toasts follow the next-themes theme.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ApiError, onApiError } from "@/lib/api/client";
import { ThemedToaster } from "@/components/providers/themed-toaster";

const SUPPRESSED_CODES = new Set<string>(["VALIDATION_ERROR"]);

/** Per-code quiet windows. Infra failures recur on every background poll
 *  against a downed target → long quiet window instead of toast-spam. */
const DEDUP_WINDOWS_MS: Record<string, number> = {
  KUBERNETES_UNAVAILABLE: 60_000,
  NETWORK_ERROR: 60_000,
  HTTP_ERROR: 30_000,
};
const DEFAULT_DEDUP_WINDOW_MS = 4_000;

/** Success toasts use the <Toaster/> default (4s). */
const ERROR_DURATION_MS = 8_000;

function errorKey(err: ApiError): string {
  return `${err.status}:${err.code}:${err.message}`;
}

/** Manual escape hatch for flows that must toast a suppressed code. */
export function toastApiError(err: ApiError): void {
  toast.error(err.userMessage, {
    description: <TechnicalDetails error={err} />,
    duration: ERROR_DURATION_MS,
  });
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const lastShown = useRef(new Map<string, number>());

  useEffect(() => {
    // Bus listeners live for the app's lifetime — subscribe once
    // (StrictMode's double-mount just re-runs this idempotently).
    return onApiError((err) => {
      if (SUPPRESSED_CODES.has(err.code)) return;

      const key = errorKey(err);
      const now = Date.now();
      const windowMs = DEDUP_WINDOWS_MS[err.code] ?? DEFAULT_DEDUP_WINDOW_MS;
      if (now - (lastShown.current.get(key) ?? 0) < windowMs) return;
      lastShown.current.set(key, now); // bounded by distinct error kinds

      toast.error(err.userMessage, {
        id: key,
        description: <TechnicalDetails error={err} />,
        duration: ERROR_DURATION_MS,
      });
    });
  }, []);

  return (
    <>
      {children}
      <ThemedToaster />
    </>
  );
}

function TechnicalDetails({ error }: { error: ApiError }) {
  const hasDetails = Object.keys(error.details).length > 0;
  return (
    <pre className="mt-1.5 max-h-40 w-full min-w-0 overflow-auto whitespace-pre-wrap break-all rounded-md bg-black/10 p-2 font-mono text-[11px] leading-relaxed dark:bg-white/10">
      {`code: ${error.code}${hasDetails ? `\n${JSON.stringify(error.details, null, 2)}` : ""}`}
    </pre>
  );
}