import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaginationInfo } from "@/lib/api/unipile";

type Props = {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  isLoading: boolean;
};

export function SearchPagination({ pagination, onPageChange, isLoading }: Props) {
  const { page, hasMore } = pagination;

  if (page === 1 && !hasMore) return null;

  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1 || isLoading}
        onClick={() => onPageChange(page - 1)}
        className="gap-1.5"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Anterior
      </Button>
      <span className="text-sm text-muted-foreground">
        Página <span className="font-semibold text-foreground">{page}</span>
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasMore || isLoading}
        onClick={() => onPageChange(page + 1)}
        className="gap-1.5"
      >
        Próxima
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
