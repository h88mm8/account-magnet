import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// Resolved filter item with LinkedIn ID
export type ResolvedFilterItem = {
  id: string;
  label: string;
  type: string; // e.g. REGION, REGION_COUNTRY, REGION_STATE, REGION_CITY, INDUSTRY
};

type Props = {
  /** Unipile lookup type: "LOCATION" or "INDUSTRY" */
  lookupType: "LOCATION" | "INDUSTRY";
  value: ResolvedFilterItem[];
  onChange: (value: ResolvedFilterItem[]) => void;
  placeholder?: string;
  className?: string;
};

export function FilterAutocomplete({
  lookupType,
  value,
  onChange,
  placeholder = "Digite para buscar...",
  className,
}: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ResolvedFilterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("unipile-lookup", {
          body: { query: q.trim(), type: lookupType, limit: 15 },
        });

        if (error) {
          console.error("[FilterAutocomplete] lookup error:", error);
          setSuggestions([]);
          return;
        }

        const items: ResolvedFilterItem[] = (data?.items || []).filter(
          (item: ResolvedFilterItem) => item.id && item.label
        );

        // Filter out already selected items
        const selectedIds = new Set(value.map((v) => v.id));
        setSuggestions(items.filter((item) => !selectedIds.has(item.id)));
      } catch (err) {
        console.error("[FilterAutocomplete] fetch error:", err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [lookupType, value]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 350);
  };

  const handleSelect = (item: ResolvedFilterItem) => {
    onChange([...value, item]);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleRemove = (id: string) => {
    onChange(value.filter((v) => v.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && query === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Selected chips + input */}
      <div
        className={cn(
          "flex min-h-[36px] w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((item) => (
          <Badge
            key={item.id}
            variant="secondary"
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-normal"
          >
            <span className="max-w-[120px] truncate">{item.label}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(item.id);
              }}
              className="rounded-sm p-0.5 hover:bg-accent"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        <div className="relative flex flex-1 items-center">
          {value.length === 0 && query === "" && (
            <Search className="absolute left-0 h-3 w-3 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => query.length >= 2 && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ""}
            className={cn(
              "h-7 flex-1 bg-transparent outline-none placeholder:text-muted-foreground",
              value.length === 0 && query === "" ? "pl-5" : "pl-1"
            )}
            style={{ minWidth: "60px" }}
          />
          {loading && <Loader2 className="absolute right-0 h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {open && (suggestions.length > 0 || (query.length >= 2 && !loading)) && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {suggestions.length === 0 && !loading && query.length >= 2 ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              Nenhum resultado encontrado
            </div>
          ) : (
            suggestions.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => handleSelect(item)}
                className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
              >
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {item.type === "REGION_COUNTRY"
                    ? "País"
                    : item.type === "REGION_STATE"
                    ? "Estado"
                    : item.type === "REGION_CITY"
                    ? "Cidade"
                    : item.type === "INDUSTRY"
                    ? "Setor"
                    : "Região"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
