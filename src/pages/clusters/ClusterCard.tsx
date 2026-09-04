/**
 * Cluster card. Navigation uses the "stretched link" pattern: a real <Link>
 * (keyboard/AT accessible, focus ring outlines the whole card) absolutely
 * positioned over the card; the address chip (CopyButton included) sits
 * above it with relative z-10 so copying never navigates.
 * Geometry is mirrored by CardGridSkeleton in components/ui/skeletons.tsx —
 * keep them in sync (pixel-committed, no CLS).
 */
import { Link } from "react-router-dom";
import { ChevronRight, Server } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { paths } from "@/lib/router/paths";
import type { Cluster } from "@/types/api";

export function ClusterCard({ cluster }: { cluster: Cluster }) {
  const namespaceLabel = cluster.namespace_count === 1 ? "namespace" : "namespaces";
  return (
    <article className="group relative flex flex-col justify-between rounded-xl border bg-card p-6 transition-all hover:border-primary/50 hover:bg-accent/30">
      <Link
        to={paths.clusterNamespaces(cluster.id)}
        className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`View namespaces on ${cluster.name}`}
      />
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Server className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="truncate text-base font-semibold tracking-tight">{cluster.name}</h2>
          </div>
          <StatusBadge state={cluster.state} />
        </div>
        <div className="relative z-10 mt-4 flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/50 px-3 py-2 transition-colors hover:bg-muted">
          <span className="truncate font-mono text-[13px] text-muted-foreground select-all">
            {cluster.address}
          </span>
          <CopyButton value={cluster.address} className="h-7 w-7 shrink-0" />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between border-t pt-4">
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{cluster.namespace_count}</span>{" "}
          {namespaceLabel}
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
          Browse
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}