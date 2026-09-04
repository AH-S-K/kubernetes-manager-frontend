/**
 * Icon-only copy affordance. Feedback = icon swap (Copy → Check, 1.6s) plus a
 * screen-reader announcement via role="status" — deliberately NOT a success
 * toast: copy actions are frequent, and a toast per click is noise. Failures
 * (rare, insecure-context fallback exhausted) do toast.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  /** Accessible name context, e.g. the address itself. Defaults to `value`. */
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the pending revert timer on unmount.
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const handleCopy = async () => {
    const ok = await copyToClipboard(value);
    if (!ok) {
      toast.error("Couldn't copy to clipboard.");
      return;
    }
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1_600);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : `Copy ${label ?? value}`}
      className={cn("h-7 w-7", className)}
    >
      {copied ? (
        <Check
          className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400"
          aria-hidden="true"
        />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </Button>
  );
}