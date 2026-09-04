import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { App } from "@/types/api";

export function ReplicasDisplay({
  app,
  variant = "inline",
  className,
}: {
  app: Pick<App, "replicas" | "desired_replicas" | "available_replicas" | "deployment_found">;
  variant?: "inline" | "kpi";
  className?: string;
}) {
  if (app.deployment_found === false) {
    return (
      <div className={cn("inline-flex items-center gap-1.5", className)}>
        <span className="h-2 w-2 rounded-full bg-destructive animate-ping" />
        <span className="font-mono text-xs font-bold text-destructive">Deployment Missing</span>
      </div>
    );
  }

  const desired = app.desired_replicas ?? app.replicas ?? 0;
  const available = app.available_replicas;
  const hasLive = typeof available === "number";
  const isReady = hasLive && desired > 0 && available === desired;
  const converging = hasLive && desired > 0 && available < desired;
  const isScaledToZero = desired === 0;

  const percent = hasLive && desired > 0 
    ? Math.min(100, Math.round((available / desired) * 100)) 
    : isScaledToZero ? 100 : 0;

  if (variant === "kpi") {
    return (
      <div className={cn("space-y-2.5", className)}>
        <div className="flex items-baseline justify-between">
          <div className="font-mono text-3xl font-extrabold tracking-tight text-foreground">
            {hasLive ? available : desired}
            <span className="text-lg font-normal text-muted-foreground">/{desired}</span>
          </div>

          {isReady ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              100% Ready
            </span>
          ) : converging ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Scaling ({percent}%)
            </span>
          ) : isScaledToZero ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              Stopped (0)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              Syncing...
            </span>
          )}
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full transition-all duration-500",
              isReady ? "bg-emerald-500" : converging ? "bg-amber-500" : isScaledToZero ? "bg-muted-foreground/40" : "bg-primary"
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("inline-flex flex-col items-start gap-1 font-mono", className)}>
      <span className="text-[13px] font-semibold tabular-nums text-foreground">
        {hasLive ? `${available}/${desired}` : desired}
        {!hasLive && <span className="ml-1.5 font-sans text-[11px] text-muted-foreground font-normal">ready n/a</span>}
      </span>
      {converging && hasLive && (
        <Progress
          value={percent}
          className="h-1 w-20"
          aria-label={`${available} of ${desired} replicas available`}
        />
      )}
    </div>
  );
}