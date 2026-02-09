import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadSearchForm } from "@/components/LeadSearchForm";
import { LeadResultsTable } from "@/components/LeadResultsTable";
import { SearchPagination } from "@/components/SearchPagination";
import {
  searchLeads,
  type LeadResult,
  type LeadSearchFilters,
  type PaginationInfo,
} from "@/lib/api/unipile";
import { useToast } from "@/hooks/use-toast";

const Contacts = () => {
  const { toast } = useToast();
  const [results, setResults] = useState<LeadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filters, setFilters] = useState<LeadSearchFilters>({});
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    hasMore: false,
    totalEstimate: null,
  });

  const handleSearch = async (f: LeadSearchFilters, page = 1) => {
    setLoading(true);
    setSearched(true);
    setFilters(f);
    try {
      const data = await searchLeads(f, page);
      setResults(data.items || []);
      setPagination(data.pagination || { page, hasMore: false, totalEstimate: null });
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
  };

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

      <LeadSearchForm onSearch={(f) => handleSearch(f, 1)} isLoading={loading} />

      {(searched || results.length > 0) && (
        <>
          <LeadResultsTable results={results} isLoading={loading} />
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

export default Contacts;
