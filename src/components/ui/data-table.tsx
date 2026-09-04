/**
 * Generic, typed data table on @tanstack/react-table + shadcn Table.
 *
 * Column-level conventions via `meta` (typed through module augmentation):
 *   align?: "left" | "right"   → "right" adds text-right + tabular-nums (metrics)
 *   mono?: boolean             → JetBrains Mono, slightly smaller (IDs, images)
 *   isActions?: boolean        → cell content is replaced by a spinner while
 *                                the row is pending (see isRowPending)
 *   headerClassName / cellClassName → escape hatches
 *
 * Row behavior:
 *   onRowClick    → pointer + keyboard (Enter/Space) activation. Clicks on
 *                   interactive elements (a, button, input, …, or anything
 *                   marked [data-row-click-ignore]) never trigger navigation.
 *                   For keyboard/AT users, ALSO render a real <Link> in the
 *                   first column — the row handler is a convenience, not the
 *                   only path (all screens follow this).
 *   isRowPending  → no-optimistic-delete rule: pass "a mutation is in flight
 *                   for this row" (e.g. state === "DELETING" or a tracked
 *                   in-flight id set). The row fades, ignores pointers, gets
 *                   aria-busy, and the actions cell shows a spinner.
 *
 * Responsiveness: shadcn's <Table> wraps the table in `overflow-x-auto`;
 * min-w-max prevents column squeezing, and stickyFirstColumn pins the first
 * column (bg-matched so row hover stays coherent).
 */
import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "right" | "center";
    mono?: boolean;
    isActions?: boolean;
    headerClassName?: string;
    cellClassName?: string;
  }
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Stable ids keep pending/keys coherent across sorting. Default: row index. */
  getRowId?: (row: TData, index: number) => string;
  onRowClick?: (row: TData) => void;
  isRowPending?: (row: TData) => boolean;
  /** Renders skeleton rows inside the real header (zero CLS on the header). */
  isLoading?: boolean;
  loadingRowCount?: number;
  /** Rendered in a full-colSpan row when data is empty and not loading. */
  emptyState?: ReactNode;
  stickyFirstColumn?: boolean;
  initialSorting?: SortingState;
  ariaLabel?: string;
  className?: string;
}

function isInteractive(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      "a, button, input, select, textarea, [data-row-click-ignore]",
    ) !== null
  );
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") {
    return <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />;
  }
  if (sorted === "desc") {
    return <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />;
  }
  return (
    <ChevronsUpDown
      className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60"
      aria-hidden="true"
    />
  );
}

export function DataTable<TData, TValue>({
  columns,
  data,
  getRowId,
  onRowClick,
  isRowPending = () => false,
  isLoading = false,
  loadingRowCount = 6,
  emptyState,
  stickyFirstColumn = false,
  initialSorting,
  ariaLabel,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    enableMultiSort: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(getRowId ? { getRowId } : {}),
  });

  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const skeletonAligns = table
    .getAllLeafColumns()
    .map((column) => column.columnDef.meta?.align);

  const stickyClasses = "sticky left-0 z-10 border-r bg-background";

  return (
    <div className={cn("w-full", className)}>
      <Table aria-label={ariaLabel} className="w-full">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b hover:bg-transparent">
              {headerGroup.headers.map((header, columnIndex) => {
                const meta = header.column.columnDef.meta;
                const isFirst = stickyFirstColumn && columnIndex === 0;
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();

                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted === "asc"
                        ? "ascending"
                        : sorted === "desc"
                          ? "descending"
                          : canSort
                            ? "none"
                            : undefined
                    }
                    className={cn(
                      meta?.align === "right" && "text-right",
                      meta?.align === "center" && "text-center",
                      isFirst && stickyClasses,
                      meta?.headerClassName,
                    )}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "group/sort inline-flex items-center gap-1.5 cursor-pointer rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                          sorted && "text-foreground",
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon sorted={sorted} />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {isLoading ? (
            Array.from({ length: loadingRowCount }).map((_, i) => (
              <TableRowSkeleton
                key={`skeleton-${i}`}
                columns={visibleColumnCount}
                aligns={skeletonAligns}
                stickyFirstColumn={stickyFirstColumn}
              />
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={visibleColumnCount} className="p-0 whitespace-normal text-center">
                {emptyState /* caller supplies the Polaris-pattern EmptyState */}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => {
              const pending = isRowPending(row.original);
              const clickable = onRowClick !== undefined && !pending;

              const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
                if (!clickable || isInteractive(event.target)) return;
                onRowClick?.(row.original);
              };

              const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
                if (!clickable) return;
                if (event.key !== "Enter" && event.key !== " ") return;
                if (isInteractive(event.target)) return;
                event.preventDefault(); // Space would otherwise scroll the page
                onRowClick?.(row.original);
              };

              return (
                <TableRow
                  key={row.id}
                  aria-busy={pending || undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={handleClick}
                  onKeyDown={handleKeyDown}
                  className={cn(
                    stickyFirstColumn && "group/row",
                    onRowClick !== undefined && !pending && "cursor-pointer",
                    onRowClick !== undefined &&
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                    pending && "pointer-events-none opacity-60",
                  )}
                >
                  {row.getVisibleCells().map((cell, columnIndex) => {
                    const meta = cell.column.columnDef.meta;
                    const isFirst = stickyFirstColumn && columnIndex === 0;

                                          return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          meta?.align === "right" && "text-right tabular-nums",
                          meta?.align === "center" && "text-center",
                          meta?.mono && "font-mono text-[13px]",
                          isFirst && stickyClasses,
                          isFirst && "group-hover/row:bg-muted/50",
                          meta?.cellClassName,
                        )}
                      >
                        {meta?.isActions && pending ? (
                          <div
                            className={cn(
                              "flex",
                              meta.align === "right" ? "justify-end" : "justify-start",
                            )}
                            role="status"
                          >
                            <Loader2
                              className="h-4 w-4 animate-spin text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span className="sr-only">Processing…</span>
                          </div>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}