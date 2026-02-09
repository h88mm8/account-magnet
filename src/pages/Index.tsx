import { useState } from "react";
import { Building2, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountSearchForm } from "@/components/AccountSearchForm";
import { LeadSearchForm } from "@/components/LeadSearchForm";
import { ResultsTable } from "@/components/ResultsTable";
import { LeadResultsTable } from "@/components/LeadResultsTable";
import { SearchPagination } from "@/components/SearchPagination";
import { StatsCards } from "@/components/StatsCards";
import {
  searchAccounts,
  searchLeads,
  type AccountResult,
  type AccountSearchFilters,
  type LeadResult,
  type LeadSearchFilters,
  type PaginationInfo,
} from "@/lib/api/unipile";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { toast } = useToast();

  // Accounts state
  const [accountResults, setAccountResults] = useState<AccountResult[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountSearched, setAccountSearched] = useState(false);
  const [accountFilters, setAccountFilters] = useState<AccountSearchFilters>({});
  const [accountPagination, setAccountPagination] = useState<PaginationInfo>({
    page: 1,
    hasMore: false,
    totalEstimate: null,
  });

  // Leads state
  const [leadResults, setLeadResults] = useState<LeadResult[]>([]);
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadSearched, setLeadSearched] = useState(false);
  const [leadFilters, setLeadFilters] = useState<LeadSearchFilters>({});
  const [leadPagination, setLeadPagination] = useState<PaginationInfo>({
    page: 1,
    hasMore: false,
    totalEstimate: null,
  });

  const handleAccountSearch = async (filters: AccountSearchFilters, page = 1) => {
    setAccountLoading(true);
    setAccountSearched(true);
    setAccountFilters(filters);
    try {
      const data = await searchAccounts(filters, page);
      setAccountResults(data.items || []);
      setAccountPagination(data.pagination || { page, hasMore: false, totalEstimate: null });
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Erro na busca",
        description: error instanceof Error ? error.message : "Falha ao buscar empresas",
        variant: "destructive",
      });
      setAccountResults([]);
    } finally {
      setAccountLoading(false);
    }
  };

  const handleLeadSearch = async (filters: LeadSearchFilters, page = 1) => {
    setLeadLoading(true);
    setLeadSearched(true);
    setLeadFilters(filters);
    try {
      const data = await searchLeads(filters, page);
      setLeadResults(data.items || []);
      setLeadPagination(data.pagination || { page, hasMore: false, totalEstimate: null });
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Erro na busca",
        description: error instanceof Error ? error.message : "Falha ao buscar leads",
        variant: "destructive",
      });
      setLeadResults([]);
    } finally {
      setLeadLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Encontre empresas e profissionais ideais para o seu negócio.
        </p>
      </div>

      <StatsCards />

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts" className="gap-2">
            <Building2 className="h-4 w-4" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2">
            <Users className="h-4 w-4" />
            Leads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <AccountSearchForm
            onSearch={(f) => handleAccountSearch(f, 1)}
            isLoading={accountLoading}
          />
          {(accountSearched || accountResults.length > 0) && (
            <>
              <ResultsTable results={accountResults} isLoading={accountLoading} />
              <SearchPagination
                pagination={accountPagination}
                onPageChange={(p) => handleAccountSearch(accountFilters, p)}
                isLoading={accountLoading}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="leads" className="space-y-4">
          <LeadSearchForm
            onSearch={(f) => handleLeadSearch(f, 1)}
            isLoading={leadLoading}
          />
          {(leadSearched || leadResults.length > 0) && (
            <>
              <LeadResultsTable results={leadResults} isLoading={leadLoading} />
              <SearchPagination
                pagination={leadPagination}
                onPageChange={(p) => handleLeadSearch(leadFilters, p)}
                isLoading={leadLoading}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
