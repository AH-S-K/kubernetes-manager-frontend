/**
 * Create-app form → AppCreateSerializer { namespace_id, name, image,
 * replicas, cpu, memory }. Defaults mirror the serializer (replicas=1,
 * cpu="100m", memory="128Mi"). Client regexes mirror validators.py; server
 * VALIDATION_ERROR → inline fields (useApiForm wiring); K8s conflicts /
 * unreachable → bus toast. Exits locked while the mutation is in flight.
 */
import { useEffect } from "react";
import { AlertTriangle, Layers, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppResourceFields } from "@/components/apps/app-resource-fields";
import { useCreateApp } from "@/hooks/api";
import { useApiForm } from "@/hooks/useApiForm";
import {
  appFormSchema,
  K8S_NAME_HELPER,
  toAppCreatePayload,
  type AppFormInput,
  type AppFormValues,
} from "@/lib/validation/schemas";

interface CreateAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  namespaceId: number;
  clusterId: number;
  namespaceName: string;
  clusterName?: string;
}

const EMPTY: AppFormInput = { name: "", image: "", replicas: "1", cpu: "100m", memory: "128Mi" };

export function CreateAppDialog({
  open,
  onOpenChange,
  namespaceId,
  clusterId,
  namespaceName,
  clusterName,
}: CreateAppDialogProps) {
  const createApp = useCreateApp();
  const form = useApiForm<AppFormInput, AppFormValues>({
    schema: appFormSchema,
    defaultValues: EMPTY,
  });
  const { reset } = form;

  useEffect(() => {
    if (open) reset(EMPTY);
  }, [open, reset]);

  // Guard on the MUTATION state, not RHF's isSubmitting (race note in
  // AddClusterDialog).
  const requestClose = (next: boolean) => {
    if (!next && createApp.isPending) return;
    onOpenChange(next);
  };

  const onSubmit = form.handleApiSubmit(async (values) => {
    await createApp.mutateAsync({
      payload: toAppCreatePayload(namespaceId, values),
      clusterId,
    });
    onOpenChange(false); // list cache seeded with the CREATING row → polling starts
  });

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Create App</DialogTitle>
            <DialogDescription>
              Deploy a containerized application into this namespace.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-6">
            {/* Read-only namespace context chip (§5.2 pattern). */}
            <div className="flex items-center gap-2.5 rounded-md border bg-muted/40 px-3 py-2.5">
              <Layers className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Namespace</span>
              <span className="truncate font-mono text-[13px] font-medium">{namespaceName}</span>
              {clusterName && (
                <span className="ml-auto truncate font-mono text-xs text-muted-foreground">
                  {clusterName}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="app-name">Name</Label>
              <Input
                id="app-name"
                className="font-mono text-[13px]"
                placeholder="e.g. api-gateway"
                autoComplete="off"
                spellCheck={false}
                {...form.register("name")}
                aria-invalid={!!errors.name || undefined}
                aria-describedby={errors.name ? "app-name-error" : "app-name-hint"}
              />
              {errors.name ? (
                <p id="app-name-error" className="text-xs font-medium text-destructive">
                  {errors.name.message}
                </p>
              ) : (
                <p id="app-name-hint" className="text-xs text-muted-foreground">
                  {K8S_NAME_HELPER} Immutable after creation.
                </p>
              )}
            </div>

            <AppResourceFields form={form as any} idPrefix="app-create" />
          </div>

          {errors.root?.message && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={createApp.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              aria-busy={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Create App
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}