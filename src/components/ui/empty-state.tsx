import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Polaris pattern (design system §6.1): muted icon → headline → subtext → CTA.
 * Used standalone on pages and inside DataTable's empty colSpan row.
 */
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Primary CTA, e.g. <Button onClick={…}>Create App</Button> */
  action?: ReactNode;
  secondaryAction?: ReactNode;
  /** "sm" fits inside cards/secondary tables. */
  size?: "default" | "sm";
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  size = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "default" ? "px-6 py-16" : "px-4 py-10",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-muted text-muted-foreground",
          size === "default" ? "h-12 w-12" : "h-10 w-10",
        )}
      >
        <Icon className={size === "default" ? "h-6 w-6" : "h-5 w-5"} aria-hidden="true" />
      </div>
      <h3 className={cn("font-semibold text-foreground", size === "default" ? "mt-4 text-base" : "mt-3 text-sm")}>
        {title}
      </h3>
      {description ? (
        <div className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</div>
      ) : null}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}