/**
 * /clusters/:clusterId/namespaces/:namespaceId/apps
 *
 * Context resolution: cluster via the shared clusters cache (useCluster),
 * namespace via useNamespace(nsId, clusterId) — the scoped fast path.
 * Row click navigates; every row also carries a real <Link> (Name column)
 * and explicit View/Edit/Delete buttons for keyboard/AT users — the row
 * handler is a convenience, never the only path.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  Boxes,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  SearchX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { DisabledWithReason } from "@/components/ui/disabled-with-reason";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UnreachableBanner } from "@/components/ui/unreachable-banner";
import { ReplicasDisplay } from "@/components/apps/replicas-display";
import {
  isRollingOut,
  useApps,
  useCluster,
  useDeleteApp,
  useNamespace,
} from "@/hooks/api";
import { parseIdParam, paths } from "@/lib/router/paths";
import { isTransient, isReconcilable, type App } from "@/types/api";
import { CreateAppDialog } from "./CreateAppDialog";
import { EditAppSheet } from "@/pages/app-detail/EditAppSheet";
import { CollectionToolbar, matchesQuery } from "@/components/ui/collection-toolbar";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";


/** Route wrapper — invalid params → 404 Response → route errorElement. */
export function AppsPage() {
  const { clusterId, namespaceId } = useParams();
  const cid = parseIdParam(clusterId);
  const nsid = parseIdParam(namespaceId);
  if (cid === null || nsid === null) throw new Response("Not Found", { status: 404 });
  return <AppsPageContent clusterId={cid} namespaceId={nsid} />;
}

function AppsPageContent({ clusterId, namespaceId }: { clusterId: number; namespaceId: number }) {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [pendingDelete, setPendingDelete] = useState<App | null>(null);
  /** In-flight delete id → instant row-pending between confirm and the 204. */
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const clusterQuery = useCluster(clusterId);
  const namespaceLookup = useNamespace(namespaceId, clusterId);
  const appsQuery = useApps(namespaceId);
  const deleteApp = useDeleteApp();

  const cluster = clusterQuery.data;
  const namespace = namespaceLookup.namespace;
  const apps = appsQuery.data ?? [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const query = useDebouncedValue(search);

  const APP_FAILED = new Set([
    "CREATE_FAILED",
    "UPDATE_FAILED",
    "DELETE_FAILED",
    "MISSING",
    "ERROR",
  ]);

  const appMatches = (app: App, id: string) =>
    id === "active"
      ? app.state === "ACTIVE" && !isRollingOut(app)
      : id === "progress"
        ? isTransient(app.state) ||
          isReconcilable(app.state) ||
          isRollingOut(app)
        : APP_FAILED.has(app.state);

  const visible = apps.filter(
    (app) =>
      matchesQuery(`${app.name} ${app.image}`, query) &&
      (statusFilter.length === 0 ||
        statusFilter.some((id) => appMatches(app, id))),
  );

  const toggle = (id: string) =>
    setStatusFilter((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );

  const clear = () => {
    setSearch("");
    setStatusFilter([]);
  };

  // "Auto-refreshing" while transient OR while any rollout is converging.
  const activity = apps.some((app) => isTransient(app.state) || isRollingOut(app));

  const createDisabled =
    !namespace || namespace.state !== "ACTIVE" || cluster?.state === "UNREACHABLE";
  const createDisabledReason =
    cluster?.state === "UNREACHABLE"
      ? "Cluster is unreachable — restore connectivity to create apps."
      : namespace && namespace.state !== "ACTIVE"
        ? "This namespace is not active yet — apps can be created once it settles."
        : undefined;

  const columns = useMemo<ColumnDef<App>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link
            to={paths.appDetail(row.original.id)}
            className="font-mono text-[13px] font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "state",
        header: "Status",
        meta: { headerClassName: "text-center", cellClassName: "text-center" },
        cell: ({ row }) => <StatusBadge state={row.original.state} />,
      },
      {
        accessorKey: "image",
        header: "Image",
        meta: { mono: true },
        cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="block max-w-[220px] cursor-default truncate" />
            }
          >
            {row.original.image}
          </TooltipTrigger>
          <TooltipContent className="max-w-sm break-all font-mono text-xs">
            {row.original.image}
          </TooltipContent>
        </Tooltip>
        ),
      },
      {
        accessorKey: "replicas",
        header: "Replicas",
        meta: { align: "right" },
        cell: ({ row }) => <ReplicasDisplay app={row.original} />,
      },
      { accessorKey: "cpu", header: "CPU", meta: { align: "right", mono: true } },
      { accessorKey: "memory", header: "Memory", meta: { align: "right", mono: true } },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right", isActions: true },
        cell: ({ row }) => {
          const app = row.original;
          const locked = isTransient(app.state);
          const reason = locked ? "Locked while Kubernetes applies changes to this app." : undefined;
          return (
            <div className="flex justify-end gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`View app ${app.name}`}
                onClick={() => navigate(paths.appDetail(app.id))}
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
              </Button>
              <DisabledWithReason reason={reason}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Edit app ${app.name}`}
                  disabled={locked}
                  onClick={() => setEditingApp(app)}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DisabledWithReason>
              <DisabledWithReason reason={reason}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete app ${app.name}`}
                  disabled={locked}
                  onClick={() => setPendingDelete(app)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DisabledWithReason>
            </div>
          );
        },
      }
    ],
    [navigate],
  );

  return (
    <>
      <PageHeader
        backTo={paths.clusterNamespaces(clusterId)}
        breadcrumbs={[
          { label: "Clusters", to: paths.clusters },
          { label: cluster?.name ?? "…", to: paths.clusterNamespaces(clusterId) },
          { label: namespace?.name ?? "…" },
        ]}
        title="Apps"
        badge={
          namespace ? (
            <StatusBadge state={namespace.state} />
          ) : (
            <Skeleton className="h-6 w-24 rounded-full" />
          )
        }
        description={
          <>
            Deployed in{" "}
            <span className="font-mono text-[13px]">
              {namespace?.name ?? `#${namespaceId}`}
            </span>
            {cluster && (
              <>
                <span className="px-1 text-muted-foreground/60">·</span>
                <span className="font-mono text-[13px]">{cluster.name}</span>
              </>
            )}
          </>
        }
        actions={
          <>
            {activity && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Auto-refreshing
              </span>
            )}
            <DisabledWithReason reason={createDisabledReason}>
              <Button onClick={() => setCreateOpen(true)} disabled={createDisabled}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create App
              </Button>
            </DisabledWithReason>
          </>
        }
      />

      <PageContainer className="py-6">
        {(cluster?.state === "UNREACHABLE" || appsQuery.error?.isKubernetesUnavailable) && (
          <div className="mb-4">
            <UnreachableBanner />
          </div>
        )}

        {/* Refetch failed but stale rows exist → keep the table, flag staleness. */}
        {appsQuery.isError && apps.length > 0 && (
          <div
            role="status"
            className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Live updates are failing — showing the last successfully loaded data.
          </div>
        )}

        {appsQuery.isError && apps.length === 0 ? (
          appsQuery.error.isNotFound ? (
            <EmptyState
              icon={SearchX}
              title="Namespace not found"
              description={`No namespace matches id ${namespaceId}. It may have been deleted.`}
              action={
                <Button render={<Link to={paths.clusterNamespaces(clusterId)} />}>
                  Back to namespaces
                </Button>
              }
              className="rounded-xl border border-dashed"
            />
          ) : (
            <QueryErrorState
              title="Couldn't load apps"
              error={appsQuery.error}
              onRetry={() => appsQuery.refetch()}
            />
          )
        ) : (
          <>
            <CollectionToolbar
              search={search}
              onSearchChange={setSearch}
              placeholder="Search by name or image…"
              chips={[
                { id: "active", label: "Active" },
                { id: "progress", label: "In progress" },
                { id: "failed", label: "Failed" },
              ]}
              selected={statusFilter}
              onToggleChip={toggle}
              shown={visible.length}
              total={apps.length}
              onClear={clear}
            />
            <DataTable
              className="overflow-hidden rounded-xl border bg-card"
              columns={columns}
              data={visible}
              getRowId={(app) => String(app.id)}
              onRowClick={(app) => navigate(paths.appDetail(app.id))}
              isRowPending={(app) => app.state === "DELETING" || app.id === deletingId}
              isLoading={appsQuery.isLoading}
              initialSorting={[{ id: "name", desc: false }]}
              ariaLabel="Apps"
              emptyState={
                <EmptyState
                  icon={Boxes}
                  title="No apps in this namespace"
                  description="Deploy your first application to get started."
                  action={
                    <Button onClick={() => setCreateOpen(true)} disabled={createDisabled}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Create App
                    </Button>
                  }
                  className="rounded-xl border border-dashed"
                />
              }
            />
          </>
        )}
      </PageContainer>

      <CreateAppDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        namespaceId={namespaceId}
        clusterId={clusterId}
        namespaceName={namespace?.name ?? `namespace-${namespaceId}`}
        clusterName={cluster?.name}
      />

      {/* Always mounted (post-hooks null guard inside) → preserves the sheet's
          exit animation; the form re-seeds per open + app.id, never per poll. */}
      <EditAppSheet
        open={editingApp !== null}
        app={editingApp}
        onOpenChange={(open) => {
          if (!open) setEditingApp(null);
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={pendingDelete ? `Delete app '${pendingDelete.name}'` : "Delete app"}
        description={
          <>
            This will permanently delete <strong>{pendingDelete?.name}</strong>, removing
            its deployment and pods from the cluster. This action cannot be undone.
          </>
        }
        confirmLabel="Delete app"
        loading={deleteApp.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          const target = pendingDelete;
          setDeletingId(target.id);
          deleteApp.mutate(
            { id: target.id, namespaceId: target.namespace_id, clusterId, name: target.name },
            {
              onSettled: () =>
                setDeletingId((current) => (current === target.id ? null : current)),
              onSuccess: () => setPendingDelete(null),
            },
          );
        }}
      />
    </>
  );
}