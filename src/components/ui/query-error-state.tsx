/**
 * Shared query-failure state (Polaris pattern). The global bus has already
 * toasted the ApiError — this is the persistent, retryable surface where the
 * data would have rendered.
 */
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { ApiError } from "@/lib/api/client";

export function QueryErrorState({
  title,
  error,
  onRetry,
  className,
}: {
  title: string;
  error: ApiError | null;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title}
      description={error?.userMessage ?? "An unexpected error occurred. Try again."}
      action={
        <Button variant="outline" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      }
      className={className}
    />
  );
}