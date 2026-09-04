import { Link, Outlet } from "react-router-dom";
import { Container } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageContainer } from "@/components/ui/page-header";
import { paths } from "@/lib/router/paths";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";

function ApiHealthIndicator() {
  const { data, isError } = useQuery({
    queryKey: ["healthz-ready"],
    queryFn: async () => {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
      const healthUrl = apiBase.startsWith("http")
        ? `${new URL(apiBase).origin}/healthz/ready/`
        : "/healthz/ready/";
      return (await axios.get<{ status: string }>(healthUrl, { timeout: 3000 })).data;
    },
    refetchInterval: 30_000,
    retry: false,
  });

  const ok = !isError && data?.status === "ready";
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2" title={ok ? "API & DB Connected" : "API Disconnected"}>
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-destructive animate-pulse"}`} />
      <span className="hidden sm:inline font-mono text-[11px]">{ok ? "Ready" : "Degraded"}</span>
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <PageContainer className="flex h-12 items-center justify-between gap-4">
        <Link to={paths.clusters} className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Container className="h-3.5 w-3.5" />
          </span>
          Kubernetes Manager
        </Link>
        <div className="flex items-center gap-2">
          <ApiHealthIndicator />
          <ThemeToggle />
        </div>
      </PageContainer>
    </header>
  );
}

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>
      <TopBar />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}