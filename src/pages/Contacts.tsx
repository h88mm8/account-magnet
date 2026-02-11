import { useState, useCallback, useRef } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadSearchForm } from "@/components/LeadSearchForm";
import { LeadResultsTable } from "@/components/LeadResultsTable";
import { SearchPagination } from "@/components/SearchPagination";
import {
  searchLeads,
  type LeadResult,
  type LeadSearchFilters,
} from "@/lib/api/unipile";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_PER_PAGE = 25;

const Contacts = () => {
  const { toast } = useToast();
  const [results, setResults] = useState<LeadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filters, setFilters] = useState<LeadSearchFilters>({});
  const cursorRef = useRef<{
    cursors: (string | null)[];
    page: number;
    totalCount: number | null;
    perPage: number;
    latestCursor: string | null;
  }>({ cursors: [], page: 1, totalCount: null, perPage: DEFAULT_PER_PAGE, latestCursor: null });

  const handleSearch = useCallback(async (f: LeadSearchFilters, cursor?: string | null, page = 1) => {
    setLoading(true);
    setSearched(true);
    setFilters(f);
    try {
      const data = await searchLeads(f, cursor);
      setResults(data.items || []);
      cursorRef.current = {
        ...cursorRef.current,
        page,
        totalCount: data.paging.total,
        latestCursor: data.cursor,
      };
      if (data.cursor) {
        cursorRef.current.cursors[page - 1] = data.cursor;
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Erro na busca",
        description: error instanceof Error ? error.message : "Falha ao buscar contatos",
        variant: "destructive",
      });
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handlePageChange = useCallback((direction: "next" | "prev") => {
    const ref = cursorRef.current;
    if (direction === "next" && ref.latestCursor) {
      handleSearch(filters, ref.latestCursor, ref.page + 1);
    } else if (direction === "prev" && ref.page > 1) {
      const prevPage = ref.page - 1;
      if (prevPage === 1) {
        handleSearch(filters, undefined, 1);
      } else {
        handleSearch(filters, ref.cursors[prevPage - 2] || null, prevPage);
      }
    }
  }, [filters, handleSearch]);

  const handleExport = () => {
    if (results.length === 0) return;
    const headers = ["Nome", "Cargo", "Empresa", "Localização", "LinkedIn"];
    const rows = results.map((r) => [
      `${r.firstName || ""} ${r.lastName || ""}`.trim(),
      r.title || "",
      r.company || "",
      r.location || "",
      r.linkedinUrl || "",
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contatos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const ref = cursorRef.current;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Contatos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Encontre profissionais e salve em listas de prospecção.
          </p>
        </div>
        {results.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        )}
      </div>

      <LeadSearchForm
        onSearch={(f) => {
          cursorRef.current = { cursors: [], page: 1, totalCount: null, perPage: cursorRef.current.perPage, latestCursor: null };
          handleSearch(f, undefined, 1);
        }}
        isLoading={loading}
      />

      {(searched || results.length > 0) && (
        <>
          <LeadResultsTable results={results} isLoading={loading} />
          <SearchPagination
            page={ref.page}
            hasMore={!!ref.latestCursor}
            totalCount={ref.totalCount}
            perPage={ref.perPage}
            onPageChange={handlePageChange}
            onPerPageChange={(n) => { cursorRef.current.perPage = n; }}
            isLoading={loading}
            entityLabel="profissionais"
          />
        </>
      )}
    </div>
  );
};

export default Contacts;
