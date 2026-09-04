import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";

/** Shared page container — PageHeader and every page body must use it
 *  so content columns stay aligned. */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>
      {children}
    </div>
  );
}

export interface PageHeaderProps {
  /** Omit on top-level pages (e.g. /clusters) — no breadcrumb row renders. */
  breadcrumbs?: Crumb[];
  title: ReactNode;
  /** Context badge beside the H1 (StatusBadge; pass a Skeleton while loading). */
  badge?: ReactNode;
  /** One line of context under the title. */
  description?: ReactNode;
  /** Right-aligned action cluster (primary CTA). */
  actions?: ReactNode;
  /** Route for an ergonomic back button (real <Link>, left of the H1). */
  backTo?: string;
}

export function PageHeader({
  breadcrumbs,
  title,
  badge,
  description,
  actions,
  backTo,
}: PageHeaderProps) {
  const hasCrumbs = !!breadcrumbs && breadcrumbs.length > 0;
  return (
    <header className="border-b bg-background">
      <PageContainer>
        {hasCrumbs && (
          <div className="pt-4">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pb-5",
            hasCrumbs ? "pt-3" : "pt-6",
          )}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {backTo && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ml-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Go back"
                  render={<Link to={backTo} />}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
              <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
              {badge}
            </div>
            {description ? (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </PageContainer>
    </header>
  );
}