import { cn } from "@/lib/utils";

export function QuickPickChips({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={`${label} quick picks`} className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 tracking-wider">Presets:</span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(option)}
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-[11px] transition-all cursor-pointer",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                selected
                  ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground hover:border-border",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}