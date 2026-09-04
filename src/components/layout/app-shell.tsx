import { Link, Outlet } from "react-router-dom";
import { Container } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageContainer } from "@/components/ui/page-header";
import { paths } from "@/lib/router/paths";


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