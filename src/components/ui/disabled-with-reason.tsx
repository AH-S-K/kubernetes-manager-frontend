import type { ReactElement } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Wraps a disabled control with an explanatory tooltip. A disabled <button>
 * swallows pointer events in some browsers, so the trigger is a focusable
 * <span> — keyboard users get focus + tooltip. Reason text should ALSO exist
 * in surrounding copy (banner/empty state); never tooltip-only.
 */
export function DisabledWithReason({
  reason,
  children,
}: {
  reason?: string;
  children: ReactElement;
}) {
  if (!reason) return children;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className="inline-flex rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{reason}</TooltipContent>
    </Tooltip>
  );
}