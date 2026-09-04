import { useMemo } from "react";
import { CheckCircle2, PackageOpen, XCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Pod } from "@/types/api";

const COMPACT = { headerClassName: "h-9", cellClassName: "py-2" } as const;

export function PodsTable({ pods, isLoading = false }: { pods: Pod[]; isLoading?: boolean }) {
  const columns = useMemo<ColumnDef<Pod>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Pod",
        enableSorting: false,
        meta: { mono: true, ...COMPACT },
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <span className="block max-w-[320px] truncate" title={row.original.name}>
              {row.original.name}
            </span>
            <CopyButton value={row.original.name} label="pod name" className="h-6 w-6 shrink-0" />
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: false,
        meta: { ...COMPACT, headerClassName: "h-9 text-center", cellClassName: "py-2 text-center" },
        cell: ({ row }) => <StatusBadge state={row.original.status} />,
      },
      {
        accessorKey: "ready",
        header: "Ready",
        enableSorting: false,
        meta: { ...COMPACT, headerClassName: "h-9 text-center", cellClassName: "py-2 text-center" },
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            {row.original.ready ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Yes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <XCircle className="h-4 w-4" /> No
              </span>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={pods}
      getRowId={(pod) => pod.name}
      isLoading={isLoading}
      loadingRowCount={3}
      ariaLabel="Pods"
      emptyState={
        <EmptyState
          size="sm"
          icon={PackageOpen}
          title="No pods reported"
          description="Kubernetes has not reported any pods for this app yet."
        />
      }
    />
  );
}