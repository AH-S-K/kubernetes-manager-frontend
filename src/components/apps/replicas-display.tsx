import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { App } from "@/types/api";

export function ReplicasDisplay({
  app,
  className,
}: {
  app: Pick<App, "replicas" | "desired_replicas" | "available_replicas" | "deployment_found">;
  className?: string;
}) {
  if (app.deployment_found === false) {
    return <span className="font-mono text-xs font-medium text-destructive">Deployment missing</span>;
  }

  const desired = app.desired_replicas ?? app.replicas ?? 0;
  const available = app.available_replicas;
  const hasLive = typeof available === "number";
  const converging = hasLive && desired > 0 && available < desired;

  return (
    <div className={cn("inline-flex flex-col items-start gap-1", className)}>
      <span className="font-mono text-[13px] tabular-nums">
        {hasLive ? `${available}/${desired}` : desired}
        {!hasLive && <span className="ml-1.5 font-sans text-[11px] text-muted-foreground">ready n/a</span>}
      </span>
      {converging && hasLive && (
        <Progress
          value={Math.min(100, (available / desired) * 100)}
          className="h-1 w-24"
          aria-label={`${available} of ${desired} replicas available`}
        />
      )}
    </div>
  );
}