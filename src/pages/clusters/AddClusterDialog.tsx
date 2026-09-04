/**
 * Create-cluster form → ClusterCreateSerializer (name ≤128, address, token
 * write-only, ca_cert optional). Client validation mirrors validators.py:
 * the address transform strips scheme/path exactly like validate_address,
 * so pasting "https://1.2.3.4:6443/metrics" validates and submits as
 * "1.2.3.4:6443". Backend VALIDATION_ERROR → inline fields (useApiForm
 * wiring); everything else (CONFLICT, 502, network) → bus toast. Exits
 * (ESC, overlay, Cancel, X) are locked while the mutation is in flight.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useCreateCluster } from "@/hooks/api";
import { useApiForm } from "@/hooks/useApiForm";
import {
  clusterFormSchema,
  toClusterCreatePayload,
  type ClusterFormInput,
  type ClusterFormValues,
} from "@/lib/validation/schemas";

const EMPTY: ClusterFormInput = { name: "", address: "", token: "", ca_cert: "" };

interface AddClusterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddClusterDialog({ open, onOpenChange }: AddClusterDialogProps) {
  const createCluster = useCreateCluster();
  const form = useApiForm<ClusterFormInput, ClusterFormValues>({
    schema: clusterFormSchema,
    defaultValues: EMPTY,
  });
  const { reset } = form;
  const [showToken, setShowToken] = useState(false);

  // Fresh form on every open (also clears any lingering server errors).
  useEffect(() => {
    if (open) {
      reset(EMPTY);
      setShowToken(false);
    }
  }, [open, reset]);

  // Radix routes ESC / overlay / close-button through here: block all exits
  // while the request is in flight. Guard on the MUTATION state, not RHF's
  // isSubmitting — isSubmitting is still true inside the submit handler when
  // we programmatically close after mutateAsync settles.
  const requestClose = (next: boolean) => {
    if (!next && createCluster.isPending) return;
    onOpenChange(next);
  };

  const onSubmit = form.handleApiSubmit(async (values) => {
    await createCluster.mutateAsync(toClusterCreatePayload(values));
    onOpenChange(false); // isPending already false → requestClose lets this through
  });

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Add Cluster</DialogTitle>
            <DialogDescription>
              Register a Kubernetes cluster by its API server address and a
              service account token.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-6">
            {/* Name — plain CharField(128) on the backend, NOT a k8s name: no regex. */}
            <div className="space-y-2">
              <Label htmlFor="cluster-name">Name</Label>
              <Input
                id="cluster-name"
                autoComplete="off"
                {...form.register("name")}
                aria-invalid={!!errors.name || undefined}
                aria-describedby={errors.name ? "cluster-name-error" : "cluster-name-hint"}
              />
              {errors.name ? (
                <p id="cluster-name-error" className="text-xs font-medium text-destructive">
                  {errors.name.message}
                </p>
              ) : (
                <p id="cluster-name-hint" className="text-xs text-muted-foreground">
                  A friendly label for this cluster, e.g. “Production”.
                </p>
              )}
            </div>

            {/* Address — scheme/path stripped client-side, mirroring validate_address. */}
            <div className="space-y-2">
              <Label htmlFor="cluster-address">API Server Address</Label>
              <Input
                id="cluster-address"
                inputMode="url"
                className="font-mono text-[13px]"
                autoComplete="off"
                spellCheck={false}
                placeholder="1.2.3.4:6443"
                {...form.register("address")}
                aria-invalid={!!errors.address || undefined}
                aria-describedby={errors.address ? "cluster-address-error" : "cluster-address-hint"}
              />
              {errors.address ? (
                <p id="cluster-address-error" className="text-xs font-medium text-destructive">
                  {errors.address.message}
                </p>
              ) : (
                <p id="cluster-address-hint" className="text-xs text-muted-foreground">
                  Host:port, e.g. <span className="font-mono">1.2.3.4:6443</span> — a
                  <span className="font-mono"> https:// </span> scheme and path are stripped automatically.
                </p>
              )}
            </div>

            {/* Token — write-only on the backend; password input with reveal toggle. */}
            <div className="space-y-2">
              <Label htmlFor="cluster-token">Token</Label>
              <div className="relative">
                <Input
                  id="cluster-token"
                  type={showToken ? "text" : "password"}
                  className="pr-10 font-mono text-[13px]"
                  autoComplete="off"
                  spellCheck={false}
                  {...form.register("token")}
                  aria-invalid={!!errors.token || undefined}
                  aria-describedby={errors.token ? "cluster-token-error" : "cluster-token-hint"}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  aria-label={showToken ? "Hide token" : "Show token"}
                  aria-pressed={showToken}
                  className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.token ? (
                <p id="cluster-token-error" className="text-xs font-medium text-destructive">
                  {errors.token.message}
                </p>
              ) : (
                <p id="cluster-token-hint" className="text-xs text-muted-foreground">
                  Bearer token for a service account on the cluster. Stored encrypted at rest.
                </p>
              )}
            </div>

            {/* CA cert — optional, write-only. */}
            <div className="space-y-2">
              <Label htmlFor="cluster-ca-cert">
                CA Certificate <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="cluster-ca-cert"
                rows={4}
                className="font-mono text-xs"
                placeholder={"-----BEGIN CERTIFICATE-----\n…"}
                spellCheck={false}
                {...form.register("ca_cert")}
                aria-invalid={!!errors.ca_cert || undefined}
                aria-describedby={errors.ca_cert ? "cluster-ca-error" : "cluster-ca-hint"}
              />
              {errors.ca_cert ? (
                <p id="cluster-ca-error" className="text-xs font-medium text-destructive">
                  {errors.ca_cert.message}
                </p>
              ) : (
                <p id="cluster-ca-hint" className="text-xs text-muted-foreground">
                  PEM-encoded certificate authority used to verify the API server.
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
              disabled={createCluster.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting}>
              {form.formState.isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Add Cluster
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}