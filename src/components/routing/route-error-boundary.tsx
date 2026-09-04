import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import { AlertTriangle, RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-header";
import { paths } from "@/lib/router/paths";

function getRouteErrorStatus(error: unknown): number | null {
  if (isRouteErrorResponse(error)) return error.status;
  // Native Response thrown at render time (see lib/router/paths.ts contract).
  if (error instanceof Response) return error.status;
  return null;
}

function describeError(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    const text = `${error.status} ${error.statusText}`.trim();
    return text || "The router reported an error response.";
  }
  if (error instanceof Response) {
    const text = `${error.status} ${error.statusText}`.trim();
    return text || "The requested resource could not be found.";
  }
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred while rendering this page.";
}

/**
 * Attached to every page route (and the root). Per-route attachment means a
 * crash inside a page keeps the shell visible; `root` covers a shell-level
 * crash and renders standalone. Also renders 404 Responses thrown by pages
 * for invalid route ids (see parseIdParam).
 */
export function RouteErrorBoundary({ root = false }: { root?: boolean }) {
  const error = useRouteError();
  const navigate = useNavigate();
  const is404 = getRouteErrorStatus(error) === 404;
  const message = is404
    ? "This page doesn't exist. Check the URL or head back to your clusters."
    : describeError(error);

  return (
    <div className={root ? "flex min-h-svh flex-col" : undefined}>
      <PageContainer>
        <div className="flex min-h-[60svh] flex-col items-center justify-center py-12">
          <EmptyState
            icon={is404 ? SearchX : AlertTriangle}
            title={is404 ? "Page not found" : "Something went wrong"}
            description={message}
            action={
              <Button onClick={() => navigate(paths.clusters)}>Back to clusters</Button>
            }
            secondaryAction={
              <Button variant="outline" onClick={() => window.location.reload()}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reload page
              </Button>
            }
          />
          {import.meta.env.DEV && error instanceof Error && (
            <pre className="mt-8 w-full max-w-2xl overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-left font-mono text-xs leading-relaxed text-muted-foreground">
              {error.stack ?? error.message}
            </pre>
          )}
        </div>
      </PageContainer>
    </div>
  );
}