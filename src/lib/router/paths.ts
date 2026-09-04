/**
 * Centralized route builders — never hand-construct paths inline in pages.
 * Accepts number | string so callers can pass ids straight from route params
 * or API payloads without casting.
 */
export const paths = {
  clusters: "/clusters",
  clusterNamespaces: (clusterId: number | string): string =>
    `/clusters/${clusterId}/namespaces`,
  namespaceApps: (clusterId: number | string, namespaceId: number | string): string =>
    `/clusters/${clusterId}/namespaces/${namespaceId}/apps`,
  appDetail: (appId: number | string): string => `/apps/${appId}`,
};

/**
 * Route params are strings — validate before using them as API ids.
 * Returns null for missing/non-numeric/non-positive ids; pages should throw
 * a 404 Response in that case, which the route's errorElement renders:
 *
 *   const clusterId = parseIdParam(params.clusterId);
 *   if (clusterId === null) throw new Response("Invalid cluster id", { status: 404 });
 */
export function parseIdParam(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}