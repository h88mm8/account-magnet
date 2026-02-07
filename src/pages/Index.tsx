import { useState } from "react";
import { motion } from "framer-motion";
import { Radar, Zap } from "lucide-react";
import { SearchForm } from "@/components/SearchForm";
import { ResultsTable } from "@/components/ResultsTable";
import { searchAccounts, type AccountResult } from "@/lib/api/unipile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [results, setResults] = useState<AccountResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [accountId, setAccountId] = useState("");
  const { toast } = useToast();

  const handleSearch = async (filters: {
    keywords: string;
    revenue: string;
    location: string;
    industry: string;
    companySize: string;
  }) => {
    if (!accountId.trim()) {
      toast({
        title: "Account ID necessário",
        description: "Informe o Account ID da Unipile para realizar a busca.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const data = await searchAccounts({
        ...filters,
        accountId: accountId.trim(),
      });
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Radar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">LeadFinder</h1>
              <p className="text-xs text-muted-foreground">Sales Navigator Search</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-accent" />
            <span className="text-xs text-muted-foreground">Powered by Unipile</span>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <section
        className="relative overflow-hidden py-12"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(217_91%_50%/0.15),transparent_50%)]" />
        <div className="container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <h2 className="font-display text-3xl font-bold text-white md:text-4xl">
              Encontre as empresas certas
              <span
                className="block bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-accent)" }}
              >
                para o seu negócio
              </span>
            </h2>
            <p className="mt-3 text-base text-white/60">
              Busque accounts no LinkedIn Sales Navigator com filtros avançados de palavras-chave, faturamento, localização, setor e tamanho.
            </p>
          </motion.div>

          {/* Account ID input */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-6 flex max-w-md items-center gap-3"
          >
            <Input
              placeholder="Unipile Account ID"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-primary"
            />
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container space-y-6 py-8">
        <SearchForm onSearch={handleSearch} isLoading={isLoading} />

        {(hasSearched || results.length > 0) && (
          <ResultsTable results={results} isLoading={isLoading} />
        )}
      </main>
    </div>
  );
};

export default Index;
