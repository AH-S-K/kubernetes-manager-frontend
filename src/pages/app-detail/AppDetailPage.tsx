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
import { Loader2, Pencil, SearchX, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DisabledWithReason } from "@/components/ui/disabled-with-reason";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { DetailGridSkeleton } from "@/components/ui/skeletons";
import { ReplicasDisplay } from "@/components/apps/replicas-display";
import { isRollingOut, useApp, useCluster, useDeleteApp, useNamespace } from "@/hooks/api";
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

function TransientBanner({ state, appName }: { state: AppState; appName: string }) {
  const gerund = state === "CREATING" ? "creating" : state === "UPDATING" ? "updating" : "deleting";
  return (
    <Alert className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <AlertTitle>Changes to this app are in progress</AlertTitle>
      <AlertDescription>
        Kubernetes is {gerund} <span className="font-mono">{appName}</span> (state:{" "}
        <span className="font-mono">{state}</span>). The page auto-refreshes until
        the state settles.
      </AlertDescription>
    </Alert>
  );
}

function OverviewItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
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
        badge={
          rollingOut ? (
            <StatusBadge state="UPDATING" label="Scaling / Rolling out" />
          ) : (
            <StatusBadge state={app.state} />
          )
        }
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
          <>
            <DisabledWithReason reason={transient ? "Locked while changes are in progress." : undefined}>
              <Button variant="outline" onClick={() => setEditOpen(true)} disabled={transient}>
                <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
              </Button>
            </DisabledWithReason>
            <DisabledWithReason reason={transient ? "Locked while changes are in progress." : undefined}>
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={transient}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
              </Button>
            </DisabledWithReason>
          </>
        }
      />

      <PageContainer className="space-y-6 py-6">
        {isInProgress && (
          <TransientBanner 
            state={transient ? app.state : "UPDATING"} 
            appName={app.name} 
          />
        )}

        {/* Overview grid */}
        <section className="rounded-xl border bg-card">
          <div className="border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">Overview</h2>
          </div>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2">
            <OverviewItem label="Image">
              <div className="flex items-start gap-1">
                <span className={cn(MONO, "break-all")}>{app.image}</span>
                <CopyButton value={app.image} label="image" className="-mt-1" />
              </div>
            </OverviewItem>
            <OverviewItem label="Replicas">
              <ReplicasDisplay app={app} />
            </OverviewItem>
            <OverviewItem label="CPU">
              <span className={MONO}>{app.cpu}</span>
            </OverviewItem>
            <OverviewItem label="Memory">
              <span className={MONO}>{app.memory}</span>
            </OverviewItem>
            <OverviewItem label="Namespace">
              {namespace ? (
                <Link
                  to={paths.namespaceApps(namespace.cluster_id, namespace.id)}
                  className={cn(MONO, "hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring")}
                >
                  {namespace.name}
                </Link>
              ) : namespaceLookup.isLoading ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <span className={cn(MONO, "text-muted-foreground")}>#{app.namespace_id}</span>
              )}
            </OverviewItem>
            <OverviewItem label="Created">
              <span className="text-muted-foreground">{formatDateTime(app.created_at)}</span>
            </OverviewItem>
            <OverviewItem label="Last updated">
              <span className="text-muted-foreground">{formatDateTime(app.updated_at)}</span>
            </OverviewItem>
          </dl>
        </section>

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
        <section
          aria-busy={deleteApp.isPending || undefined}
          className={cn(
            "rounded-xl border border-red-200 bg-red-50/40 p-5 dark:border-red-500/25 dark:bg-red-500/5",
            deleteApp.isPending && "pointer-events-none opacity-60",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-lg">
              <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Deleting <span className={MONO}>{app.name}</span> removes its
                Deployment and Pods from the cluster permanently. This action
                cannot be undone.
              </p>
            </div>
            <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)} disabled={!deletable}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete App
            </Button>
          </div>
        </section>
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