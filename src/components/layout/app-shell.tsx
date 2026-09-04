import { Link, Outlet } from "react-router-dom";
import { Container } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageContainer } from "@/components/ui/page-header";
import { paths } from "@/lib/router/paths";


function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
      <PageContainer className="flex h-16 items-center justify-between gap-4">
        <Link to={paths.clusters} className="flex items-center gap-3 text-base font-bold tracking-tight transition-opacity hover:opacity-90">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-xs text-primary-foreground">
            <Container className="h-5 w-5" />
          </span>
          <div className="flex items-center gap-2">
            <span>Kubernetes Manager</span>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
              v1.0
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
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