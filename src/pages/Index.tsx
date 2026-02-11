import { useState, useCallback, useRef } from "react";
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
} from "@/lib/api/unipile";
import { useToast } from "@/hooks/use-toast";

type CursorState = {
  /** All accumulated items for display on the current logical page */
  allItems: unknown[];
  /** Cursor history: cursors[i] = cursor to fetch page i+2 (index 0 = cursor after page 1) */
  cursors: (string | null)[];
  /** Current logical page (1-based) */
  page: number;
  /** Total count from API */
  totalCount: number | null;
  /** Items per logical page */
  perPage: number;
};

const DEFAULT_PER_PAGE = 25;

const Index = () => {
  const { toast } = useToast();

  // ── Accounts ──
  const [accountItems, setAccountItems] = useState<AccountResult[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountSearched, setAccountSearched] = useState(false);
  const [accountFilters, setAccountFilters] = useState<AccountSearchFilters>({});
  const accountCursorRef = useRef<{
    cursors: (string | null)[];
    page: number;
    totalCount: number | null;
    perPage: number;
    latestCursor: string | null;
  }>({ cursors: [], page: 1, totalCount: null, perPage: DEFAULT_PER_PAGE, latestCursor: null });

  // ── Leads ──
  const [leadItems, setLeadItems] = useState<LeadResult[]>([]);
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadSearched, setLeadSearched] = useState(false);
  const [leadFilters, setLeadFilters] = useState<LeadSearchFilters>({});
  const leadCursorRef = useRef<{
    cursors: (string | null)[];
    page: number;
    totalCount: number | null;
    perPage: number;
    latestCursor: string | null;
  }>({ cursors: [], page: 1, totalCount: null, perPage: DEFAULT_PER_PAGE, latestCursor: null });

  // ── Account search ──
  const handleAccountSearch = useCallback(async (filters: AccountSearchFilters, cursor?: string | null, page = 1) => {
    setAccountLoading(true);
    setAccountSearched(true);
    setAccountFilters(filters);
    try {
      const data = await searchAccounts(filters, cursor);
      setAccountItems(data.items);
      accountCursorRef.current = {
        ...accountCursorRef.current,
        page,
        totalCount: data.paging.total,
        latestCursor: data.cursor,
      };
      // Store cursor for this page
      if (data.cursor) {
        accountCursorRef.current.cursors[page - 1] = data.cursor;
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Erro na busca",
        description: error instanceof Error ? error.message : "Falha ao buscar empresas",
        variant: "destructive",
      });
      setAccountItems([]);
    } finally {
      setAccountLoading(false);
    }
  }, [toast]);

  const handleAccountPageChange = useCallback((direction: "next" | "prev") => {
    const ref = accountCursorRef.current;
    if (direction === "next" && ref.latestCursor) {
      handleAccountSearch(accountFilters, ref.latestCursor, ref.page + 1);
    } else if (direction === "prev" && ref.page > 1) {
      const prevPage = ref.page - 1;
      if (prevPage === 1) {
        // Re-run original search
        handleAccountSearch(accountFilters, undefined, 1);
      } else {
        // Use stored cursor for previous page
        const prevCursor = ref.cursors[prevPage - 2] || null;
        handleAccountSearch(accountFilters, prevCursor, prevPage);
      }
    }
  }, [accountFilters, handleAccountSearch]);

  // ── Lead search ──
  const handleLeadSearch = useCallback(async (filters: LeadSearchFilters, cursor?: string | null, page = 1) => {
    setLeadLoading(true);
    setLeadSearched(true);
    setLeadFilters(filters);
    try {
      const data = await searchLeads(filters, cursor);
      setLeadItems(data.items);
      leadCursorRef.current = {
        ...leadCursorRef.current,
        page,
        totalCount: data.paging.total,
        latestCursor: data.cursor,
      };
      if (data.cursor) {
        leadCursorRef.current.cursors[page - 1] = data.cursor;
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Erro na busca",
        description: error instanceof Error ? error.message : "Falha ao buscar leads",
        variant: "destructive",
      });
      setLeadItems([]);
    } finally {
      setLeadLoading(false);
    }
  }, [toast]);

  const handleLeadPageChange = useCallback((direction: "next" | "prev") => {
    const ref = leadCursorRef.current;
    if (direction === "next" && ref.latestCursor) {
      handleLeadSearch(leadFilters, ref.latestCursor, ref.page + 1);
    } else if (direction === "prev" && ref.page > 1) {
      const prevPage = ref.page - 1;
      if (prevPage === 1) {
        handleLeadSearch(leadFilters, undefined, 1);
      } else {
        const prevCursor = ref.cursors[prevPage - 2] || null;
        handleLeadSearch(leadFilters, prevCursor, prevPage);
      }
    }
  }, [leadFilters, handleLeadSearch]);

  // Force re-render for ref-based state
  const acRef = accountCursorRef.current;
  const ldRef = leadCursorRef.current;

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
            onSearch={(f) => {
              accountCursorRef.current = { cursors: [], page: 1, totalCount: null, perPage: accountCursorRef.current.perPage, latestCursor: null };
              handleAccountSearch(f, undefined, 1);
            }}
            isLoading={accountLoading}
          />
          {(accountSearched || accountItems.length > 0) && (
            <>
              {/* Total count header */}
              {acRef.totalCount != null && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {acRef.totalCount.toLocaleString("pt-BR")}
                  </span>{" "}
                  empresas encontradas
                </p>
              )}
              <ResultsTable results={accountItems} isLoading={accountLoading} />
              <SearchPagination
                page={acRef.page}
                hasMore={!!acRef.latestCursor}
                totalCount={acRef.totalCount}
                perPage={acRef.perPage}
                onPageChange={handleAccountPageChange}
                onPerPageChange={(n) => {
                  accountCursorRef.current.perPage = n;
                }}
                isLoading={accountLoading}
                entityLabel="empresas"
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="leads" className="space-y-4">
          <LeadSearchForm
            onSearch={(f) => {
              leadCursorRef.current = { cursors: [], page: 1, totalCount: null, perPage: leadCursorRef.current.perPage, latestCursor: null };
              handleLeadSearch(f, undefined, 1);
            }}
            isLoading={leadLoading}
          />
          {(leadSearched || leadItems.length > 0) && (
            <>
              {ldRef.totalCount != null && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {ldRef.totalCount.toLocaleString("pt-BR")}
                  </span>{" "}
                  profissionais encontrados
                </p>
              )}
              <LeadResultsTable results={leadItems} isLoading={leadLoading} />
              <SearchPagination
                page={ldRef.page}
                hasMore={!!ldRef.latestCursor}
                totalCount={ldRef.totalCount}
                perPage={ldRef.perPage}
                onPageChange={handleLeadPageChange}
                onPerPageChange={(n) => {
                  leadCursorRef.current.perPage = n;
                }}
                isLoading={leadLoading}
                entityLabel="profissionais"
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
