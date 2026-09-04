import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === "" || haystack.toLowerCase().includes(q);
}

export interface FilterChip { id: string; label: string; }

export function CollectionToolbar({
  search, onSearchChange, placeholder, chips, selected, onToggleChip, shown, total, onClear,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  placeholder: string;
  chips: FilterChip[];
  selected: string[];
  onToggleChip: (id: string) => void;
  shown: number;
  total: number;
  onClear: () => void;
}) {
  const filtering = search.trim() !== "" || selected.length > 0;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search" value={search} onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder} aria-label={placeholder} autoComplete="off"
          className="h-8 pl-8"
        />
      </div>
      <div role="group" aria-label="Status filters" className="flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const active = selected.includes(chip.id);
          return (
            <button
              key={chip.id} type="button" aria-pressed={active}
              onClick={() => onToggleChip(chip.id)}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      {filtering && (
        <>
          <span role="status" className="text-xs text-muted-foreground">{shown} of {total}</span>
          <Button variant="ghost" size="xs" onClick={onClear}>Clear</Button>
        </>
      )}
    </div>
  );
}