/**
 * Layout-committed skeletons (CLS prevention, design system §6.1).
 * Each mirrors the geometry of its final component — when a final layout
 * changes, update its skeleton HERE to stay pixel-committed.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Deterministic bar-width cycle so rows look varied but stable. */
const BAR_WIDTHS = ["w-28", "w-16", "w-20", "w-14", "w-24", "w-12"] as const;

/** One <tr> of skeleton cells. `aligns` mirrors DataTable column meta so
 *  numeric-column bars right-align exactly like real cells. */
export function TableRowSkeleton({
  columns,
  aligns,
  stickyFirstColumn = false,
  className,
}: {
  columns: number;
  aligns?: ReadonlyArray<"left" | "right" | "center" | undefined>;
  stickyFirstColumn?: boolean;
  className?: string;
}) {
  return (
    <TableRow className={cn("pointer-events-none", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <TableCell
          key={i}
          className={cn(
            aligns?.[i] === "right" && "text-right",
            aligns?.[i] === "center" && "text-center",
            stickyFirstColumn && i === 0 && "sticky left-0 z-10 border-r bg-background",
          )}
        >
          <Skeleton
            className={cn(
              "h-4",
              BAR_WIDTHS[i % BAR_WIDTHS.length],
              aligns?.[i] === "right" && "ml-auto",
              aligns?.[i] === "center" && "mx-auto",
            )}
          />
        </TableCell>
      ))}
    </TableRow>
  );
}

/**
 * Cluster page — mirrors ClusterCard: name + state badge, mono address,
 * divider, namespace count + chevron. Default grid matches the card grid.
 */
export function CardGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-6">
          {/* row 1: icon + name + status badge */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-6 w-28" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          {/* row 2: address chip (28 + py-2×2 + border = 46px) */}
          <Skeleton className="mt-4 h-[46px] w-full rounded-lg" />
          {/* row 3: namespace count + browse */}
          <div className="mt-5 flex items-center justify-between border-t pt-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** App detail — mirrors the overview grid of label/value pairs. */
export function DetailGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
      ))}
    </div>
  );
}