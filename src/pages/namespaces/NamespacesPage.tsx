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
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ChevronRight, Layers, Loader2, Plus, SearchX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DisabledWithReason } from "@/components/ui/disabled-with-reason";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { CardGridSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { UnreachableBanner } from "@/components/ui/unreachable-banner";
import { useCluster, useDeleteNamespace, useNamespaces } from "@/hooks/api";
import { formatDateTime } from "@/lib/format";
import { parseIdParam, paths } from "@/lib/router/paths";
import { isTransient, type Namespace } from "@/types/api";
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

function NamespaceCard({
  namespace,
  clusterId,
  onDelete,
}: {
  namespace: Namespace;
  clusterId: number;
  onDelete: (ns: Namespace) => void;
}) {
  const appLabel = namespace.app_count === 1 ? "app" : "apps";
  const blocked = namespace.app_count > 0;

  return (
    <article className="group relative flex flex-col justify-between rounded-xl border bg-card p-5 transition-all hover:border-primary/50 hover:bg-accent/20 shadow-sm">
      <Link
        to={paths.namespaceApps(clusterId, namespace.id)}
        className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`View apps in ${namespace.name}`}
      />

      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Layers className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 relative z-10">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <h2 className="cursor-default truncate font-mono text-sm font-semibold tracking-tight text-foreground hover:underline" />
                  }
                >
                  {namespace.name}
                </TooltipTrigger>
                <TooltipContent className="font-mono text-xs max-w-xs break-all">
                  {namespace.name}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-1.5 shrink-0">
            <StatusBadge state={namespace.state} size="sm" />
            <DisabledWithReason
              reason={
                blocked
                  ? `Cannot delete namespace containing active applications. Delete all apps first.`
                  : undefined
              }
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-all"
                aria-label={`Delete namespace ${namespace.name}`}
                disabled={blocked}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(namespace);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </DisabledWithReason>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Created: {formatDateTime(namespace.created_at)}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 pointer-events-none">
        <span className="text-xs font-medium text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{namespace.app_count}</span> {appLabel}
        </span>

        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
          Browse
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

function NamespacesPageContent({ clusterId }: { clusterId: number }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Namespace | null>(null);

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
        ? isTransient(ns.state) && !NS_FAILED.has(ns.state)
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
  // UNREACHABLE; the reason surfaces via tooltip  the amber banner text.
  const createDisabled = !cluster || cluster.state === "UNREACHABLE";
  const createDisabledReason =
    cluster?.state === "UNREACHABLE"
      ? "Cluster is unreachable — restore connectivity to create namespaces."
      : undefined;


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
    deleteNamespace.mutate(
      { id: pendingDelete.id, clusterId: pendingDelete.cluster_id, name: pendingDelete.name },
      {
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
              Cluster:{" "}
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
            {namespacesQuery.isLoading ? (
              <CardGridSkeleton count={3} />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No namespaces found"
                description="No namespaces match your current search."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((ns) => (
                  <NamespaceCard
                    key={ns.id}
                    namespace={ns}
                    clusterId={clusterId}
                    onDelete={setPendingDelete}
                  />
                ))}
              </div>
            )}
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