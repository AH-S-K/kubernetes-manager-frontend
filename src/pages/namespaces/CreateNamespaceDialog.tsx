/**
 * Create-namespace form → NamespaceCreateSerializer { cluster_id, name }.
 * K8s name regex validated client-side (instant feedback); server-side
 * duplicates arrive either as VALIDATION_ERROR (inline via useApiForm
 * wiring) or as a DomainError conflict (bus toast with technical details) —
 * both handled without extra code here. Exits locked while in flight.
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
import { StatusBadge } from "@/components/ui/status-badge";
import { useCreateNamespace } from "@/hooks/api";
import { useApiForm } from "@/hooks/useApiForm";
import {
  K8S_NAME_HELPER,
  namespaceFormSchema,
  toNamespaceCreatePayload,
  type NamespaceFormInput,
  type NamespaceFormValues,
} from "@/lib/validation/schemas";
import type { Cluster } from "@/types/api";

interface CreateNamespaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: Cluster;
}

export function CreateNamespaceDialog({
  open,
  onOpenChange,
  cluster,
}: CreateNamespaceDialogProps) {
  const createNamespace = useCreateNamespace();
  const form = useApiForm<NamespaceFormInput, NamespaceFormValues>({
    schema: namespaceFormSchema,
    defaultValues: { name: "" },
  });
  const { reset } = form;

  useEffect(() => {
    if (open) reset({ name: "" });
  }, [open, reset]);

  // Guard on the MUTATION state, not RHF's isSubmitting (race note in
  // AddClusterDialog).
  const requestClose = (next: boolean) => {
    if (!next && createNamespace.isPending) return;
    onOpenChange(next);
  };

  const onSubmit = form.handleApiSubmit(async (values) => {
    await createNamespace.mutateAsync(toNamespaceCreatePayload(cluster.id, values));
    onOpenChange(false); // list cache seeded with the CREATING row → polling starts
  });

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Create Namespace</DialogTitle>
            <DialogDescription>
              Namespaces group applications within a cluster.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-6">
            {/* Read-only cluster context chip (§5.2). */}
            <div className="flex items-center gap-2.5 rounded-md border bg-muted/40 px-3 py-2.5">
              <Layers className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Cluster</span>
              <span className="truncate font-mono text-[13px] font-medium">
                {cluster.name}
              </span>
              <StatusBadge state={cluster.state} size="sm" className="ml-auto" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="namespace-name">Name</Label>
              <Input
                id="namespace-name"
                className="font-mono text-[13px]"
                placeholder="e.g. api-prod"
                autoComplete="off"
                spellCheck={false}
                {...form.register("name")}
                aria-invalid={!!errors.name || undefined}
                aria-describedby={errors.name ? "namespace-name-error" : "namespace-name-hint"}
              />
              {errors.name ? (
                <p id="namespace-name-error" className="text-xs font-medium text-destructive">
                  {errors.name.message}
                </p>
              ) : (
                <p id="namespace-name-hint" className="text-xs text-muted-foreground">
                  {K8S_NAME_HELPER}
                </p>
              )}
            </div>
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
              disabled={createNamespace.isPending}
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
              Create Namespace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}