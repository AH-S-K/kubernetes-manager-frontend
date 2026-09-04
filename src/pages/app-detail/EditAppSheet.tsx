import { useEffect, useMemo } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AppResourceFields } from "@/components/apps/app-resource-fields";
import { useUpdateApp } from "@/hooks/api";
import { useApiForm } from "@/hooks/useApiForm";
import {
  appEditSchema,
  type AppEditInput,
  type AppEditValues,
} from "@/lib/validation/schemas";
import type { App, AppUpdatePayload } from "@/types/api";

interface EditAppSheetProps {
  open: boolean;
  app: App | null;
  onOpenChange: (open: boolean) => void;
}

export function EditAppSheet({ open, app, onOpenChange }: EditAppSheetProps) {
  const updateApp = useUpdateApp();
  const form = useApiForm<AppEditInput, AppEditValues>({ schema: appEditSchema });
  const { reset, watch, formState } = form;

  useEffect(() => {
    if (open && app) {
      reset({
        image: app.image,
        replicas: String(app.replicas),
        cpu: app.cpu,
        memory: app.memory,
      });
    }
  }, [open, app?.id, reset]);

  const requestClose = (next: boolean) => {
    if (!next && updateApp.isPending) return;
    onOpenChange(next);
  };

  if (!app) return null;

  // محاسبه زنده فیلدهای تغییر یافته برای نمایش Diff
  const watchedValues = watch();
  const changedFields = useMemo(() => {
    const list: { name: string; oldVal: string | number; newVal: string | number }[] = [];
    if (watchedValues.image && watchedValues.image !== app.image) {
      list.push({ name: "Image", oldVal: app.image, newVal: watchedValues.image });
    }
    if (watchedValues.replicas !== undefined && Number(watchedValues.replicas) !== app.replicas) {
      list.push({ name: "Replicas", oldVal: app.replicas, newVal: watchedValues.replicas });
    }
    if (watchedValues.cpu && watchedValues.cpu !== app.cpu) {
      list.push({ name: "CPU", oldVal: app.cpu, newVal: watchedValues.cpu });
    }
    if (watchedValues.memory && watchedValues.memory !== app.memory) {
      list.push({ name: "Memory", oldVal: app.memory, newVal: watchedValues.memory });
    }
    return list;
  }, [watchedValues, app]);

  const hasChanges = changedFields.length > 0;

  const onSubmit = form.handleApiSubmit(async (values) => {
    const dirty = formState.dirtyFields;
    const payload: AppUpdatePayload = {};
    if (dirty.image) payload.image = values.image;
    if (dirty.replicas) payload.replicas = values.replicas;
    if (dirty.cpu) payload.cpu = values.cpu;
    if (dirty.memory) payload.memory = values.memory;

    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }
    await updateApp.mutateAsync({ id: app.id, namespaceId: app.namespace_id, payload });
    onOpenChange(false);
  });

  const errors = formState.errors;

  return (
    <Sheet open={open} onOpenChange={requestClose}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-lg bg-background border-l border-border shadow-2xl"
      >
        {/* Header با جزئیات بهتر */}
        <SheetHeader className="border-b border-border/80 px-6 py-5 bg-card/40 text-left">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <SheetTitle className="text-base font-semibold">Configure Application</SheetTitle>
          </div>
          <SheetDescription className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Modifying <span className="font-mono font-medium text-foreground bg-muted/60 px-1.5 py-0.5 rounded">{app.name}</span>.
            Kubernetes will execute a rolling restart for changed pods.
          </SheetDescription>
        </SheetHeader>

        {/* Body Container بدون باگ کشش عمودی */}
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col justify-between">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <AppResourceFields
              form={form}
              idPrefix="app-edit"
              originalValues={{
                image: app.image,
                replicas: app.replicas,
                cpu: app.cpu,
                memory: app.memory,
              }}
            />

            {/* Live Diff Summary Box */}
            {hasChanges && (
              <div className="rounded-lg border border-primary/25 bg-primary/5 p-3.5 transition-all">
                <p className="flex items-center gap-1.5 font-medium text-xs text-primary mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Pending Changes ({changedFields.length})
                </p>
                <div className="space-y-1.5 text-xs">
                  {changedFields.map((field) => (
                    <div key={field.name} className="flex items-center justify-between font-mono text-[11px] bg-background/60 px-2 py-1 rounded">
                      <span className="text-muted-foreground">{field.name}:</span>
                      <div className="flex items-center gap-1.5 truncate max-w-[240px]">
                        <span className="line-through text-muted-foreground/70 truncate">{field.oldVal}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-primary" />
                        <span className="font-semibold text-foreground truncate">{field.newVal}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errors.root?.message && (
              <Alert variant="destructive" className="mt-3">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Sticky Action Footer */}
          <div className="border-t border-border/80 bg-card/40 px-6 py-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono">
              {hasChanges ? `${changedFields.length} update(s) ready` : "No modifications"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={updateApp.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!hasChanges || formState.isSubmitting}
                aria-busy={formState.isSubmitting}
                className="min-w-28"
              >
                {formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Applying...
                  </>
                ) : (
                  "Apply Changes"
                )}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}