/**
 * Confirmation dialog for destructive (or default-tone) actions.
 * Layout: warning icon + title/description, optional type-to-confirm input,
 * inline right-aligned action row — deliberately NO full-width footer bar so
 * short confirmations stay visually balanced. Exits lock while `loading`.
 */
import { useEffect, useId, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Consequence copy — always state what will be lost (never color alone). */
  description: ReactNode;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Type-to-confirm: confirm stays disabled until the trimmed input matches. */
  confirmPhrase?: string;
  confirmPhraseLabel?: string;
  /** Request in flight: spinner on confirm, all exits locked. */
  loading?: boolean;
  tone?: "destructive" | "default";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmPhrase,
  confirmPhraseLabel,
  loading = false,
  tone = "destructive",
}: ConfirmDialogProps) {
  const inputId = useId();
  const [typed, setTyped] = useState("");

  // Fresh input every time the dialog opens.
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const phraseSatisfied = !confirmPhrase || typed.trim() === confirmPhrase;
  const disabled = loading || !phraseSatisfied;

  // Lock every exit while the request is in flight.
  const requestOpenChange = (next: boolean) => {
    if (!next && loading) return;
    onOpenChange(next);
  };

  const submit = () => {
    if (disabled) return;
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent className="gap-0 p-6 sm:max-w-[420px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <DialogHeader className="min-w-0 flex-1 gap-1.5 pt-0.5 text-left">
              <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
              <DialogDescription render={<div className="leading-relaxed" />}>
                {description}
              </DialogDescription>
            </DialogHeader>
          </div>

          {confirmPhrase && (
            <div className="mt-4 space-y-2 rounded-lg border bg-muted/30 p-3">
              <label htmlFor={inputId} className="block text-xs text-muted-foreground">
                Type{" "}
                <span className="font-mono font-semibold text-foreground">{confirmPhrase}</span>{" "}
                to confirm:
              </label>
              <Input
                id={inputId}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmPhrase}
                aria-label={confirmPhraseLabel ?? `Type ${confirmPhrase} to confirm`}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                autoFocus
                className="h-8 font-mono text-xs"
              />
              {typed.trim() !== "" && !phraseSatisfied && (
                <p className="text-xs text-destructive">Doesn’t match yet — check for typos.</p>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button type="submit" variant={tone} size="sm" disabled={disabled} aria-busy={loading}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}