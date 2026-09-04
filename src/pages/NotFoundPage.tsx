import { Link, useLocation } from "react-router-dom";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-header";
import { paths } from "@/lib/router/paths";

/** Catch-all route: unmatched URLs land here (no error thrown). */
export function NotFoundPage() {
  const location = useLocation();
  return (
    <PageContainer>
      <div className="flex min-h-[60svh] items-center justify-center py-12">
        <EmptyState
          icon={SearchX}
          title="Page not found"
          description={`No route matches "${location.pathname}". Check the URL or head back to your clusters.`}
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