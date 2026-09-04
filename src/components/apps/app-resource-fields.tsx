import { Minus, Plus, Cpu, HardDrive, Layers, Box } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QuickPickChips } from "@/components/apps/quick-pick-chips";
import type { ApiForm } from "@/hooks/useApiForm";
import {
  CPU_PRESETS,
  MEMORY_PRESETS,
  type AppFormInput,
  type AppFormValues,
} from "@/lib/validation/schemas";

type AppResourceInput = Pick<AppFormInput, "image" | "replicas" | "cpu" | "memory">;
type AppResourceValues = Pick<AppFormValues, "image" | "replicas" | "cpu" | "memory">;

interface AppResourceFieldsProps {
  form: ApiForm<AppResourceInput, AppResourceValues>;
  idPrefix: string;
  originalValues?: Partial<AppResourceValues>;
}

export function AppResourceFields({ form, idPrefix, originalValues }: AppResourceFieldsProps) {
  const errors = form.formState.errors;
  const replicas = Number(form.watch("replicas") ?? 1);
  const currentCpu = form.watch("cpu") ?? "";
  const currentMemory = form.watch("memory") ?? "";

  const handleStepReplicas = (delta: number) => {
    const next = Math.max(0, replicas + delta);
    form.setValue("replicas", String(next), { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div className="space-y-4">
      {/* Container Image Card */}
      <div className="rounded-lg border border-border/80 bg-card/60 p-3.5 shadow-sm transition-all focus-within:border-primary/60">
        <div className="flex items-center justify-between pb-2">
          <Label htmlFor={`${idPrefix}-image`} className="flex items-center gap-2 font-medium text-sm">
            <Box className="h-4 w-4 text-primary" /> Container Image
          </Label>
          {originalValues?.image && form.watch("image") !== originalValues.image && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">Modified</span>
          )}
        </div>
        <Input
          id={`${idPrefix}-image`}
          className="font-mono text-xs bg-background/80"
          placeholder="e.g. nginx:1.27.0-alpine"
          autoComplete="off"
          spellCheck={false}
          {...form.register("image")}
          aria-invalid={!!errors.image || undefined}
        />
        {errors.image ? (
          <p className="mt-1.5 text-xs text-destructive">{errors.image.message}</p>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Image reference with registry and tag (e.g. <code className="font-mono text-foreground/80">registry.osdl.ir/app:v1</code>).
          </p>
        )}
      </div>

      {/* Pod Replicas Stepper Card */}
      <div className="rounded-lg border border-border/80 bg-card/60 p-3.5 shadow-sm transition-all">
        <div className="flex items-center justify-between pb-2">
          <Label htmlFor={`${idPrefix}-replicas`} className="flex items-center gap-2 font-medium text-sm">
            <Layers className="h-4 w-4 text-emerald-500" /> Pod Replicas
          </Label>
          <span className="text-[11px] text-muted-foreground font-mono">
            {replicas === 0 ? "Scaling to 0 (Stopped)" : `${replicas} desired pod${replicas > 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={replicas <= 0}
            onClick={() => handleStepReplicas(-1)}
            aria-label="Decrease replicas"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Input
            id={`${idPrefix}-replicas`}
            type="number"
            min={0}
            step={1}
            className="h-8 text-center font-mono font-semibold tabular-nums bg-background/80"
            {...form.register("replicas")}
            aria-invalid={!!errors.replicas || undefined}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => handleStepReplicas(1)}
            aria-label="Increase replicas"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {errors.replicas && (
          <p className="mt-1.5 text-xs text-destructive">{errors.replicas.message}</p>
        )}
      </div>

      {/* Compute Resources (CPU & Memory in 2 Columns or Neat Cards) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {/* CPU Card */}
        <div className="flex flex-col justify-between rounded-lg border border-border/80 bg-card/60 p-3.5 shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-2">
              <Label htmlFor={`${idPrefix}-cpu`} className="flex items-center gap-1.5 font-medium text-xs">
                <Cpu className="h-3.5 w-3.5 text-amber-500" /> CPU Limit
              </Label>
            </div>
            <Input
              id={`${idPrefix}-cpu`}
              className="h-8 font-mono text-xs bg-background/80"
              placeholder="100m"
              autoComplete="off"
              spellCheck={false}
              {...form.register("cpu")}
              aria-invalid={!!errors.cpu || undefined}
            />
            {errors.cpu && <p className="mt-1 text-[11px] text-destructive">{errors.cpu.message}</p>}
          </div>
          <div className="pt-2">
            <QuickPickChips
              label="CPU"
              options={CPU_PRESETS}
              value={currentCpu}
              onSelect={(v) => form.setValue("cpu", v, { shouldValidate: true, shouldDirty: true })}
            />
          </div>
        </div>

        {/* Memory Card */}
        <div className="flex flex-col justify-between rounded-lg border border-border/80 bg-card/60 p-3.5 shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-2">
              <Label htmlFor={`${idPrefix}-memory`} className="flex items-center gap-1.5 font-medium text-xs">
                <HardDrive className="h-3.5 w-3.5 text-violet-500" /> Memory Limit
              </Label>
            </div>
            <Input
              id={`${idPrefix}-memory`}
              className="h-8 font-mono text-xs bg-background/80"
              placeholder="128Mi"
              autoComplete="off"
              spellCheck={false}
              {...form.register("memory")}
              aria-invalid={!!errors.memory || undefined}
            />
            {errors.memory && <p className="mt-1 text-[11px] text-destructive">{errors.memory.message}</p>}
          </div>
          <div className="pt-2">
            <QuickPickChips
              label="Memory"
              options={MEMORY_PRESETS}
              value={currentMemory}
              onSelect={(v) => form.setValue("memory", v, { shouldValidate: true, shouldDirty: true })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}