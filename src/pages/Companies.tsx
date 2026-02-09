import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountSearchForm } from "@/components/AccountSearchForm";
import { ResultsTable } from "@/components/ResultsTable";
import { SearchPagination } from "@/components/SearchPagination";
import {
  searchAccounts,
  type AccountResult,
  type AccountSearchFilters,
  type PaginationInfo,
} from "@/lib/api/unipile";
import { useToast } from "@/hooks/use-toast";

const Companies = () => {
  const { toast } = useToast();
  const [results, setResults] = useState<AccountResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filters, setFilters] = useState<AccountSearchFilters>({});
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    hasMore: false,
    totalEstimate: null,
  });

  const handleSearch = async (f: AccountSearchFilters, page = 1) => {
    setLoading(true);
    setSearched(true);
    setFilters(f);
    try {
      const data = await searchAccounts(f, page);
      setResults(data.items || []);
      setPagination(data.pagination || { page, hasMore: false, totalEstimate: null });
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Erro na busca",
        description: error instanceof Error ? error.message : "Falha ao buscar empresas",
        variant: "destructive",
      });
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (results.length === 0) return;
    const headers = ["Nome", "Indústria", "Localização", "Funcionários", "LinkedIn"];
    const rows = results.map((r) => [
      r.name || "",
      r.industry || "",
      r.location || "",
      r.employeeCount || "",
      r.linkedinUrl || "",
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "empresas.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Empresas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Busque e gerencie empresas para prospecção.
          </p>
        </div>
        {results.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        )}
      </div>

      <AccountSearchForm onSearch={(f) => handleSearch(f, 1)} isLoading={loading} />

      {(searched || results.length > 0) && (
        <>
          <ResultsTable results={results} isLoading={loading} />
          <SearchPagination
            pagination={pagination}
            onPageChange={(p) => handleSearch(filters, p)}
            isLoading={loading}
          />
        </>
      )}
    </div>
  );
};

export default Companies;
