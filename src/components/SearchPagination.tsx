import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  page: number;
  hasMore: boolean;
  totalCount: number | null;
  perPage: number;
  onPageChange: (direction: "next" | "prev") => void;
  onPerPageChange: (perPage: number) => void;
  isLoading: boolean;
  entityLabel?: string;
};

const PER_PAGE_OPTIONS = [25, 50, 100];

export function SearchPagination({
  page,
  hasMore,
  totalCount,
  perPage,
  onPageChange,
  onPerPageChange,
  isLoading,
  entityLabel = "resultados",
}: Props) {
  if (page === 1 && !hasMore && !totalCount) return null;

  const totalPages = totalCount ? Math.ceil(totalCount / perPage) : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Total count */}
      <div className="text-sm text-muted-foreground">
        {totalCount != null && (
          <span>
            <span className="font-semibold text-foreground">
              {totalCount.toLocaleString("pt-BR")}
            </span>{" "}
            {entityLabel} encontrados
          </span>
        )}
      </div>

      {/* Center: page nav */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange("prev")}
          className="gap-1.5"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">
          Página{" "}
          <span className="font-semibold text-foreground">{page}</span>
          {totalPages != null && (
            <span> de {totalPages}</span>
          )}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore || isLoading}
          onClick={() => onPageChange("next")}
          className="gap-1.5"
        >
          Próxima
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Right: per-page selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Por página:</span>
        <Select
          value={String(perPage)}
          onValueChange={(v) => onPerPageChange(Number(v))}
        >
          <SelectTrigger className="h-8 w-[72px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PER_PAGE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
