/**
 * /clusters — responsive card grid. State machine per Master Skill §6.1:
 * skeleton grid → error state (retry) → empty state (CTA) → data grid.
 * CardGridSkeleton geometry mirrors ClusterCard (p-5, badge row, address row,
 * border-t footer) to prevent CLS on load.
 */
import { useState } from "react";

import { AlertTriangle, Plus, SearchX, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CollectionToolbar, matchesQuery } from "@/components/ui/collection-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { CardGridSkeleton } from "@/components/ui/skeletons";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useClusters } from "@/hooks/api";

import { AddClusterDialog } from "./AddClusterDialog";
import { ClusterCard } from "./ClusterCard";

export function ClustersPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const clustersQuery = useClusters();
  const clusters = clustersQuery.data ?? [];
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const query = useDebouncedValue(search);
  const visible = clusters.filter(
    (c) =>
      matchesQuery(`${c.name} ${c.address}`, query) &&
      (stateFilter.length === 0 || stateFilter.includes(c.state)),
  );
  const toggle = (id: string) =>
    setStateFilter((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const clear = () => { setSearch(""); setStateFilter([]); };

  return (
    <>
      <PageHeader
        title="Clusters"
        description="Registered Kubernetes clusters. Select a cluster to browse its namespaces and apps."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Cluster
          </Button>
        }
      />

      <PageContainer className="py-6">
        {clustersQuery.isError && clusters.length > 0 && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Live updates are failing — showing the last successfully loaded data.
          </div>
        )}

        {clustersQuery.isLoading ? (
          <CardGridSkeleton />
        ) : clustersQuery.isError && clusters.length === 0 ? (
          <QueryErrorState
            title="Couldn't load clusters"
            error={clustersQuery.error}
            onRetry={() => clustersQuery.refetch()}
          />
        ) : clusters.length === 0 ? (
          <EmptyState
            icon={Server}
            title="No clusters registered"
            description="Connect your first Kubernetes cluster to browse its namespaces and applications."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Cluster
              </Button>
            }
            className="rounded-xl border border-dashed"
          />
        ) : (
          <>
            <CollectionToolbar
              search={search} onSearchChange={setSearch}
              placeholder="Search by name or address…"
              chips={[{ id: "ACTIVE", label: "Active" }, { id: "UNREACHABLE", label: "Unreachable" }]}
              selected={stateFilter} onToggleChip={toggle}
              shown={visible.length} total={clusters.length} onClear={clear}
            />
            {visible.length === 0 ? (
              <EmptyState
                size="sm" icon={SearchX} title="No matches"
                description="No clusters match the current search or filters."
                action={<Button variant="outline" size="sm" onClick={clear}>Clear filters</Button>}
                className="rounded-xl border border-dashed"
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((cluster) => (<ClusterCard key={cluster.id} cluster={cluster} />))}
              </div>
            )}
          </>
        )}
      </PageContainer>

      <AddClusterDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}