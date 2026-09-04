import { WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** §5.2 amber banner — exact spec text. Tones mirror StatusBadge's warning set. */
export function UnreachableBanner() {
  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Cluster is unreachable</AlertTitle>
      <AlertDescription>
        Data may be stale. Namespace creation is disabled until the cluster is
        reachable again.
      </AlertDescription>
    </Alert>
  );
}