/**
 * /apps/:appId — full detail: header, transient banner, overview grid,
 * pods sub-table, danger zone.
 *
 * Context reconstruction on deep links: the app gives namespace_id;
 * useNamespace(namespaceId) scans cluster lists cache-first for the namespace
 * (→ cluster_id); useCluster projects the name. Until then, breadcrumbs and
 * the namespace row degrade to placeholders — never to a crash.
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CopyButton } from "@/components/ui/copy-button";
import { AlertTriangle, Box, Clock, Cpu, Gauge, HardDrive, Layers, Loader2, Pencil, SearchX, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DisabledWithReason } from "@/components/ui/disabled-with-reason";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailGridSkeleton } from "@/components/ui/skeletons";
import { ReplicasDisplay } from "@/components/apps/replicas-display";
import { isAppDegraded, isRollingOut, useApp, useCluster, useDeleteApp, useNamespace } from "@/hooks/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseIdParam, paths } from "@/lib/router/paths";
import { isTransient, type AppState, type App as AppEntity } from "@/types/api";
import { EditAppSheet } from "./EditAppSheet";
import { PodsTable } from "./PodsTable";
import { WidgetErrorBoundary } from "@/components/ui/widget-error-boundary";

export function AppDetailPage() {
  const { appId } = useParams();
  const id = parseIdParam(appId);
  if (id === null) throw new Response("Not Found", { status: 404 });
  return <AppDetailPageContent appId={id} />;
}

/* ─────────────────────────── local pieces ─────────────────────────── */

function TransientBanner({ appName }: { state: AppState; appName: string }) {
   return (
     <Alert className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300">
       <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
       <AlertTitle>Rollout in progress</AlertTitle>
       <AlertDescription>
         Kubernetes is applying changes to <span className="font-mono font-medium">{appName}</span>. This view will automatically update once all pods are ready.
       </AlertDescription>
     </Alert>
   );
 }

const MONO = "font-mono text-[13px]";

/* ─────────────────────────── content ──────────────────────────────── */

function AppDetailPageContent({ appId }: { appId: number }) {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const appQuery = useApp(appId);
  const app = appQuery.data;

  const namespaceLookup = useNamespace(app?.namespace_id ?? 0);
  const namespace = namespaceLookup.namespace;
  const clusterQuery = useCluster(namespace?.cluster_id ?? 0);
  const cluster = clusterQuery.data;
  const deleteApp = useDeleteApp();

  /* ── Error: 404 vs everything else ── */
  if (appQuery.isError && !app) {
    const notFound = appQuery.error.isNotFound;
    const backTo = namespace
      ? paths.namespaceApps(namespace.cluster_id, namespace.id)
      : paths.clusters;
    return (
      <PageContainer>
        <div className="flex min-h-[50svh] items-center justify-center py-12">
          {notFound ? (
            <EmptyState
              icon={SearchX}
              title="App not found"
              description={`No app matches id ${appId}. It may have been deleted.`}
              action={<Button render={<Link to={backTo} />}>{namespace ? "Back to apps" : "Back to clusters"}</Button>}
            />
          ) : (
            <QueryErrorState title="Couldn't load this app" error={appQuery.error} onRetry={() => appQuery.refetch()} />
          )}
        </div>
      </PageContainer>
    );
  }

  /* ── Loading: skeleton layout committed to the final geometry ── */
  if (!app) {
    return (
      <>
        <PageHeader
          backTo={paths.clusters}
          breadcrumbs={[{ label: "Clusters", to: paths.clusters }, { label: "…" }]}          title={<Skeleton className="h-7 w-44" />}
          badge={<Skeleton className="h-6 w-24 rounded-full" />}
          actions={<Skeleton className="h-9 w-44" />}
        />
        <PageContainer className="space-y-6 py-6">
          <div className="rounded-xl border bg-card p-5">
            <DetailGridSkeleton count={6} />
          </div>
          <section className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <PodsTable pods={[]} isLoading />
          </section>
        </PageContainer>
      </>
    );
  }

  /* ── Success ── */
  const transient = isTransient(app.state);
  const rollingOut = isRollingOut(app);
  const isInProgress = transient || rollingOut;
  const deletable = app.state !== "DELETING";

  const crumbs = [
    { label: "Clusters", to: paths.clusters },
    ...(namespace?.cluster_id !== undefined
      ? [
          {
            label: cluster?.name ?? "Cluster",
            to: paths.clusterNamespaces(namespace.cluster_id),
          },
          {
            label: namespace?.name ?? "Namespace",
            to: paths.namespaceApps(namespace.cluster_id, app.namespace_id),
          },
        ]
      : [{ label: "…" }]),
    { label: app.name },
  ];

  return (
    <>
      <PageHeader
        backTo={
          namespace
            ? paths.namespaceApps(namespace.cluster_id, namespace.id)
            : paths.clusters
        }
        breadcrumbs={crumbs}
        title={<span className={cn(MONO, "text-xl")}>{app.name}</span>}
        description={
          <>
            In namespace{" "}
            <span className={MONO}>{namespace?.name ?? `#${app.namespace_id}`}</span>
            {cluster && (
              <>
                <span className="px-1 text-muted-foreground/60">·</span>
                <span className={MONO}>{cluster.name}</span>
              </>
            )}
          </>
        }
        actions={
          <DisabledWithReason reason={transient ? "Locked while changes are in progress." : undefined}>
            <Button variant="outline" onClick={() => setEditOpen(true)} disabled={transient}>
              <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
            </Button>
          </DisabledWithReason>
        }
      />

      <PageContainer className="space-y-6 py-6">
        {isAppDegraded(app) ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Application deployment is degraded</AlertTitle>
            <AlertDescription>
              One or more pods failed to start (e.g. ImagePullBackOff). Click <strong>Edit</strong> to fix the image or resources.
            </AlertDescription>
          </Alert>
        ) : isInProgress ? (
          <TransientBanner state={transient ? app.state : "UPDATING"} appName={app.name} />
        ) : null}

        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Replicas */}
          <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Replicas</span>
              <Layers className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-3">
              <ReplicasDisplay app={app} className="text-xl font-bold" />
            </div>
          </div>

          {/* Card 2: Image */}
          <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Image</span>
              <Box className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-1">
              <span className="font-mono text-sm font-semibold truncate" title={app.image}>
                {app.image}
              </span>
              <CopyButton value={app.image} className="h-6 w-6 shrink-0" />
            </div>
          </div>

          {/* Card 3: Compute Limits (Split Sub-tiles) */}
          <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground pb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Compute Limits</span>
              <Gauge className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 grid grid-cols-2 divide-x divide-border/60">
              {/* CPU Column */}
              <div className="flex flex-col pr-3">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Cpu className="h-3 w-3 text-amber-500" /> CPU
                </span>
                <span className="mt-1 font-mono text-base font-bold text-foreground">
                  {app.cpu}
                </span>
              </div>
              {/* Memory Column */}
              <div className="flex flex-col pl-3">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <HardDrive className="h-3 w-3 text-violet-500" /> RAM
                </span>
                <span className="mt-1 font-mono text-base font-bold text-foreground">
                  {app.memory}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Last Updated */}
          <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Last Activity</span>
              <Clock className="h-4 w-4 text-violet-500" />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Updated: <span className="font-medium text-foreground">{formatDateTime(app.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* Pods sub-table */}
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">Pods</h2>
            <span
              className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs tabular-nums text-muted-foreground"
              aria-label={`${app.pods.length} pods`}
            >
              {app.pods.length}
            </span>
          </div>
          <WidgetErrorBoundary label="the pods table">
            <PodsTable pods={app.pods} />
          </WidgetErrorBoundary>
        </section>

        {/* Danger Zone */}
        <div
          aria-busy={deleteApp.isPending || undefined}
          className={cn(
            "rounded-xl border border-destructive/25 bg-destructive/5 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all",
            deleteApp.isPending && "pointer-events-none opacity-60",
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Delete application</p>
              <p className="text-xs text-muted-foreground truncate">
                Permanently remove <span className="font-mono text-foreground font-medium">{app.name}</span> and terminate its pods.
              </p>
            </div>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={!deletable}
            className="shrink-0"
          >
            Delete App
          </Button>
        </div>
      </PageContainer>

      <EditAppSheet
        open={editOpen}
        app={app as AppEntity}
        onOpenChange={(open) => {
          if (!open) setEditOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete app '${app.name}'`}
        description={
          <>
            This will permanently delete <strong>{app.name}</strong>, removing its
            deployment and pods from the cluster. This action cannot be undone.
          </>
        }
        confirmLabel="Delete app"
        loading={deleteApp.isPending}
        onConfirm={() =>
          deleteApp.mutate(
            // clusterId 0 → the app_count invalidation in useDeleteApp is a
            // harmless no-op key when namespace context hasn't resolved.
            {
              id: app.id,
              namespaceId: app.namespace_id,
              clusterId: namespace?.cluster_id ?? 0,
              name: app.name,
            },
            {
              onSuccess: () =>
                navigate(
                  namespace
                    ? paths.namespaceApps(namespace.cluster_id, namespace.id)
                    : paths.clusters,
                ),
            },
          )
        }
      />
    </>
  );
}