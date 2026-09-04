/**
 * /clusters/:clusterId/namespaces — namespace table for one cluster.
 * Final merged version: uses the shared UnreachableBanner and
 * DisabledWithReason primitives (no local copies).
 *
 * Param validation without rules-of-hooks violations: NamespacesPage is a
 * zero-hook wrapper (only useParams, then a conditional throw per the
 * parseIdParam contract); the content component receives a guaranteed number.
 * "Invalid id in URL" → 404 boundary; "valid id, missing cluster" →
 * contextual inline not-found after the query settles.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Layers, Loader2, Plus, SearchX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { DisabledWithReason } from "@/components/ui/disabled-with-reason";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { UnreachableBanner } from "@/components/ui/unreachable-banner";
import { useCluster, useDeleteNamespace, useNamespaces } from "@/hooks/api";
import { formatDateTime } from "@/lib/format";
import { parseIdParam, paths } from "@/lib/router/paths";
import { isTransient, isReconcilable, type Namespace } from "@/types/api";
import { CreateNamespaceDialog } from "./CreateNamespaceDialog";
import { CollectionToolbar, matchesQuery } from "@/components/ui/collection-toolbar";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

/** Route wrapper (parseIdParam contract): invalid :clusterId → 404 Response. */
export function NamespacesPage() {
  const { clusterId } = useParams();
  const id = parseIdParam(clusterId);
  if (id === null) throw new Response("Not Found", { status: 404 });
  return <NamespacesPageContent clusterId={id} />;
}

function NamespacesPageContent({ clusterId }: { clusterId: number }) {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Namespace | null>(null);
  /** Row awaiting its 204 — drives DataTable's row-pending state. */
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const clusterQuery = useCluster(clusterId);
  const namespacesQuery = useNamespaces(clusterId);
  const deleteNamespace = useDeleteNamespace();

  const cluster = clusterQuery.data;
  const namespaces = namespacesQuery.data ?? [];
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const query = useDebouncedValue(search);

  const NS_FAILED = new Set([
    "CREATE_FAILED",
    "DELETE_FAILED",
    "MISSING",
    "ERROR",
  ]);

  const nsMatches = (ns: Namespace, id: string) =>
    id === "active"
      ? ns.state === "ACTIVE"
      : id === "progress"
        ? isTransient(ns.state) || isReconcilable(ns.state)
        : NS_FAILED.has(ns.state);

  const visible = namespaces.filter(
    (ns) =>
      matchesQuery(ns.name, query) &&
      (statusFilter.length === 0 ||
        statusFilter.some((id) => nsMatches(ns, id))),
  );

  const toggle = (id: string) =>
    setStatusFilter((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );

  const clear = () => {
    setSearch("");
    setStatusFilter([]);
  };  
  
  const hasTransient = namespaces.some((ns) => isTransient(ns.state));

  // Create CTA is disabled while the cluster is missing (loading) or
  // UNREACHABLE; the reason surfaces via tooltip + the amber banner text.
  const createDisabled = !cluster || cluster.state === "UNREACHABLE";
  const createDisabledReason =
    cluster?.state === "UNREACHABLE"
      ? "Cluster is unreachable — restore connectivity to create namespaces."
      : undefined;

  const columns = useMemo<ColumnDef<Namespace>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        // Real link (keyboard/AT path into Apps); row click covers pointer users.
        cell: ({ row }) => (
          <Link
            to={paths.namespaceApps(clusterId, row.original.id)}
            className="font-mono text-[13px] font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "state",
        header: "State",
        meta: { headerClassName: "text-center", cellClassName: "text-center" },
        cell: ({ row }) => <StatusBadge state={row.original.state} />,
      },
      {
        accessorKey: "app_count",
        header: "Apps",
        meta: { align: "right" }, // text-right + tabular-nums via DataTable meta
      },
      {
        // ISO 8601 strings sort chronologically as plain strings — no custom sortingFn.
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-muted-foreground" title={row.original.created_at}>
            {formatDateTime(row.original.created_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right", isActions: true },
        cell: ({ row }) => {
          const ns = row.original;
          const blocked = ns.app_count > 0;
          return (
            <DisabledWithReason
              reason={
                blocked
                  ? `Namespace has apps. Delete apps first — the API refuses deletion while ${ns.app_count} app(s) exist.`
                  : undefined
              }
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label={`Delete namespace ${ns.name}`}
                disabled={blocked}
                onClick={() => setPendingDelete(row.original)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DisabledWithReason>
          );
        },
      },
    ],
    [clusterId],
  );

  // Valid id, but the clusters list doesn't contain it (deleted elsewhere /
  // stale link). Contextual not-found keeps the shell — only after the query
  // has settled, so a loading cache can't flash this.
  if (clusterQuery.isSuccess && cluster === undefined) {
    return (
      <PageContainer>
        <div className="flex min-h-[50svh] items-center justify-center py-12">
          <EmptyState
            icon={SearchX}
            title="Cluster not found"
            description={`No registered cluster matches id ${clusterId}. It may have been deleted, or the link is stale.`}
            action={
              <Button render={<Link to={paths.clusters} />}>
                Back to clusters
              </Button>
            }
          />
        </div>
      </PageContainer>
    );
  }

  const handleDeleteConfirm = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeletingId(target.id);

    deleteNamespace.mutate(
      { id: target.id, clusterId: target.cluster_id, name: target.name },
      {
        onSettled: () =>
          setDeletingId((current) => (current === target.id ? null : current)),
        onSuccess: () => setPendingDelete(null),
      },
    );
  };

  return (
    <>
      <PageHeader
        backTo={paths.clusters}
        breadcrumbs={[
          { label: "Clusters", to: paths.clusters },
          { label: cluster?.name ?? "…" }, // context span (loading-safe)
        ]}
        title="Namespaces"
        badge={
          cluster ? (
            <StatusBadge state={cluster.state} />
          ) : clusterQuery.isError ? (
            <StatusBadge state="ERROR" label="Status unknown" />
          ) : (
            <Skeleton className="h-6 w-24 rounded-full" />
          )
        }
        description={
          cluster ? (
            <>
              Provisioned on{" "}
              <span className="font-mono text-[13px]">{cluster.name}</span>
              <span className="px-1 text-muted-foreground/60">·</span>
              <span className="font-mono text-[13px]">{cluster.address}</span>
            </>
          ) : undefined
        }
        actions={
          <>
            {/* "Auto-refreshing" indicator — visible while any row is transient. */}
            {namespaces.length > 0 && hasTransient && (
              <span
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                role="status"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Auto-refreshing
              </span>
            )}
            <DisabledWithReason reason={createDisabledReason}>
              <Button onClick={() => setCreateOpen(true)} disabled={createDisabled}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create Namespace
              </Button>
            </DisabledWithReason>
          </>
        }
      />

      <PageContainer className="py-6">
        {cluster?.state === "UNREACHABLE" && (
          <div className="mb-4">
            <UnreachableBanner />
          </div>
        )}

        {/* Refetch failed but stale data exists → keep the table, flag staleness. */}
        {namespacesQuery.isError && namespaces.length > 0 && (
          <div
            role="status"
            className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Live updates are failing — showing the last successfully loaded data.
          </div>
        )}

        {namespacesQuery.isError && namespaces.length === 0 ? (
          <QueryErrorState
            title="Couldn't load namespaces"
            error={namespacesQuery.error}
            onRetry={() => namespacesQuery.refetch()}
          />
        ) : (
          <>
            <CollectionToolbar
              search={search}
              onSearchChange={setSearch}
              placeholder="Search namespaces…"
              chips={[
                { id: "active", label: "Active" },
                { id: "progress", label: "In progress" },
                { id: "failed", label: "Failed" },
              ]}
              selected={statusFilter}
              onToggleChip={toggle}
              shown={visible.length}
              total={namespaces.length}
              onClear={clear}
            />
            <DataTable
              className="overflow-hidden rounded-xl border bg-card"
              columns={columns}
              data={visible}
              getRowId={(ns) => String(ns.id)}
              onRowClick={(ns) => navigate(paths.namespaceApps(clusterId, ns.id))}
              isRowPending={(ns) => ns.state === "DELETING" || ns.id === deletingId}
              isLoading={namespacesQuery.isLoading}
              ariaLabel="Namespaces"
              emptyState={
                <EmptyState
                  icon={Layers}
                  title="No namespaces on this cluster"
                  description="Namespaces group the applications running on a cluster. Create the first one to get started."
                  action={
                    cluster ? (
                      <DisabledWithReason reason={createDisabledReason}>
                        <Button
                          onClick={() => setCreateOpen(true)}
                          disabled={cluster.state === "UNREACHABLE"}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Create Namespace
                        </Button>
                      </DisabledWithReason>
                    ) : undefined
                  }
                />
              }
            />
          </>
        )}
      </PageContainer>

      {/* Create modal — only mounted once the cluster context exists (the
          header CTA is disabled until then, so this can't be opened blind). */}
      {cluster && (
        <CreateNamespaceDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          cluster={cluster}
        />
      )}

      {/* Tiered delete: type-to-confirm iff the namespace would take apps with it. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title={`Delete namespace '${pendingDelete?.name}'`}
        description={
          <>This will permanently delete the empty namespace <strong>{pendingDelete?.name}</strong>.</>
        }
        confirmLabel="Delete namespace"
        loading={deleteNamespace.isPending}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}