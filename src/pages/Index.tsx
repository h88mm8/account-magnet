import { useState } from "react";
import { SearchForm } from "@/components/SearchForm";
import { ResultsTable } from "@/components/ResultsTable";
import { StatsCards } from "@/components/StatsCards";
import { searchAccounts, type AccountResult } from "@/lib/api/unipile";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [results, setResults] = useState<AccountResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (filters: {
    keywords: string;
    revenue: string;
    location: string;
    industry: string;
    companySize: string;
  }) => {
    setIsLoading(true);
    setHasSearched(true);

    try {
      const data = await searchAccounts(filters);
      setResults(data.items || []);
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Erro na busca",
        description: error instanceof Error ? error.message : "Falha ao buscar leads",
        variant: "destructive",
      });
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Page header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Encontre empresas ideais para o seu negócio com filtros avançados.
        </p>
      </div>

      {/* Stats */}
      <StatsCards />

      {/* Search */}
      <SearchForm onSearch={handleSearch} isLoading={isLoading} />

      {/* Results */}
      {(hasSearched || results.length > 0) && (
        <ResultsTable results={results} isLoading={isLoading} />
      )}
    </div>
  );
};

export default Index;
