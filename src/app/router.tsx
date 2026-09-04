import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { RouteErrorBoundary } from "@/components/routing/route-error-boundary";
import { paths } from "@/lib/router/paths";

const ClustersPage = lazy(() => import("@/pages/clusters/ClustersPage").then((m) => ({ default: m.ClustersPage })));
const NamespacesPage = lazy(() => import("@/pages/namespaces/NamespacesPage").then((m) => ({ default: m.NamespacesPage })));
const AppsPage = lazy(() => import("@/pages/namespace-apps/AppsPage").then((m) => ({ default: m.AppsPage })));
const AppDetailPage = lazy(() => import("@/pages/app-detail/AppDetailPage").then((m) => ({ default: m.AppDetailPage })));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorBoundary root />,
    children: [
      { index: true, element: <Navigate to={paths.clusters} replace /> },
      { path: "clusters", element: <Suspense fallback={<div className="p-6">Loading...</div>}><ClustersPage /></Suspense>, errorElement: <RouteErrorBoundary /> },
      { path: "clusters/:clusterId", element: <Navigate to="namespaces" replace /> },
      { path: "clusters/:clusterId/namespaces", element: <Suspense fallback={<div className="p-6">Loading...</div>}><NamespacesPage /></Suspense>, errorElement: <RouteErrorBoundary /> },
      { path: "clusters/:clusterId/namespaces/:namespaceId/apps", element: <Suspense fallback={<div className="p-6">Loading...</div>}><AppsPage /></Suspense>, errorElement: <RouteErrorBoundary /> },
      { path: "apps/:appId", element: <Suspense fallback={<div className="p-6">Loading...</div>}><AppDetailPage /></Suspense>, errorElement: <RouteErrorBoundary /> },
      { path: "*", element: <Suspense fallback={null}><NotFoundPage /></Suspense> },
    ],
  },
]);