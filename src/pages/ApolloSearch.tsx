import { useState, useCallback } from "react";
import { Search, Users, Building2, MapPin, Briefcase, Award, Factory, Download, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadResultsTable } from "@/components/LeadResultsTable";
import { ResultsTable } from "@/components/ResultsTable";
import { useToast } from "@/hooks/use-toast";
import {
  searchApolloPersons,
  searchApolloCompanies,
  apolloSeniorities,
  apolloEmployeeRanges,
  type ApolloPersonFilters,
  type ApolloCompanyFilters,
  type ApolloPagination,
} from "@/lib/api/apollo";
import type { LeadResult, AccountResult } from "@/lib/api/unipile";

const PER_PAGE = 25;

const ApolloSearch = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"people" | "companies">("people");

  // People state
  const [pKeywords, setPKeywords] = useState("");
  const [pTitles, setPTitles] = useState("");
  const [pLocations, setPLocations] = useState("");
  const [pSeniority, setPSeniority] = useState("");
  const [pOrgLocations, setPOrgLocations] = useState("");
  const [pEmployees, setPEmployees] = useState("");
  const [pResults, setPResults] = useState<LeadResult[]>([]);
  const [pPagination, setPPagination] = useState<ApolloPagination | null>(null);
  const [pLoading, setPLoading] = useState(false);
  const [pSearched, setPSearched] = useState(false);

  // Company state
  const [cName, setCName] = useState("");
  const [cKeywords, setCKeywords] = useState("");
  const [cLocations, setCLocations] = useState("");
  const [cEmployees, setCEmployees] = useState("");
  const [cResults, setCResults] = useState<AccountResult[]>([]);
  const [cPagination, setCPagination] = useState<ApolloPagination | null>(null);
  const [cLoading, setCLoading] = useState(false);
  const [cSearched, setCSearched] = useState(false);

  // ── People search ──
  const handlePeopleSearch = useCallback(async (page = 1) => {
    setPLoading(true);
    setPSearched(true);
    try {
      const filters: ApolloPersonFilters = {};
      if (pKeywords.trim()) filters.q_keywords = pKeywords.trim();
      if (pTitles.trim()) filters.person_titles = pTitles.split(",").map((s) => s.trim()).filter(Boolean);
      if (pLocations.trim()) filters.person_locations = pLocations.split(",").map((s) => s.trim()).filter(Boolean);
      if (pSeniority) filters.person_seniorities = [pSeniority];
      if (pOrgLocations.trim()) filters.organization_locations = pOrgLocations.split(",").map((s) => s.trim()).filter(Boolean);
      if (pEmployees) filters.organization_num_employees_ranges = [pEmployees];

      const data = await searchApolloPersons(filters, page, PER_PAGE);
      setPResults(data.items);
      setPPagination(data.pagination);
    } catch (err) {
      toast({ title: "Erro na busca Apollo", description: err instanceof Error ? err.message : "Falha", variant: "destructive" });
      setPResults([]);
    } finally {
      setPLoading(false);
    }
  }, [pKeywords, pTitles, pLocations, pSeniority, pOrgLocations, pEmployees, toast]);

  // ── Company search ──
  const handleCompanySearch = useCallback(async (page = 1) => {
    setCLoading(true);
    setCSearched(true);
    try {
      const filters: ApolloCompanyFilters = {};
      if (cName.trim()) filters.q_organization_name = cName.trim();
      if (cKeywords.trim()) filters.q_organization_keyword_tags = cKeywords.split(",").map((s) => s.trim()).filter(Boolean);
      if (cLocations.trim()) filters.organization_locations = cLocations.split(",").map((s) => s.trim()).filter(Boolean);
      if (cEmployees) filters.organization_num_employees_ranges = [cEmployees];

      const data = await searchApolloCompanies(filters, page, PER_PAGE);
      setCResults(data.items);
      setCPagination(data.pagination);
    } catch (err) {
      toast({ title: "Erro na busca Apollo", description: err instanceof Error ? err.message : "Falha", variant: "destructive" });
      setCResults([]);
    } finally {
      setCLoading(false);
    }
  }, [cName, cKeywords, cLocations, cEmployees, toast]);

  const clearPeople = () => {
    setPKeywords(""); setPTitles(""); setPLocations(""); setPSeniority(""); setPOrgLocations(""); setPEmployees("");
    setPResults([]); setPSearched(false); setPPagination(null);
  };
  const clearCompanies = () => {
    setCName(""); setCKeywords(""); setCLocations(""); setCEmployees("");
    setCResults([]); setCSearched(false); setCPagination(null);
  };

  const handleExportPeople = () => {
    if (!pResults.length) return;
    const headers = ["Nome", "Cargo", "Empresa", "Localização", "LinkedIn"];
    const rows = pResults.map((r) => [
      `${r.firstName || ""} ${r.lastName || ""}`.trim(),
      r.title || "", r.company || "", r.location || "", r.linkedinUrl || "",
    ]);
    downloadCsv([headers, ...rows], "apollo-contatos.csv");
  };

  const handleExportCompanies = () => {
    if (!cResults.length) return;
    const headers = ["Empresa", "Setor", "Localização", "Funcionários", "LinkedIn"];
    const rows = cResults.map((r) => [
      r.name || "", r.industry || "", r.location || "", r.employeeCount || "", r.linkedinUrl || "",
    ]);
    downloadCsv([headers, ...rows], "apollo-empresas.csv");
  };

  const downloadCsv = (data: string[][], filename: string) => {
    const csv = data.map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-foreground">Busca Apollo</h1>
            <Badge variant="secondary" className="text-xs">API</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Encontre leads e empresas diretamente pelo Apollo. Resultados podem ser salvos nas mesmas listas.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "people" | "companies")}>
        <TabsList>
          <TabsTrigger value="people" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Pessoas
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Empresas
          </TabsTrigger>
        </TabsList>

        {/* ── People Tab ── */}
        <TabsContent value="people" className="space-y-6">
          <Card className="border border-border shadow-none">
            <CardContent className="p-5">
              <form onSubmit={(e) => { e.preventDefault(); handlePeopleSearch(1); }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Palavra-chave (ex: marketing, developer...)"
                    value={pKeywords}
                    onChange={(e) => setPKeywords(e.target.value)}
                    className="h-11 border-border bg-background pl-10 text-sm"
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="min-w-[180px] flex-1 space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Briefcase className="h-3 w-3" />
                      Cargos (separados por vírgula)
                    </label>
                    <Input
                      placeholder="Ex: CEO, CTO, Diretor"
                      value={pTitles}
                      onChange={(e) => setPTitles(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="min-w-[180px] flex-1 space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      Localização da pessoa
                    </label>
                    <Input
                      placeholder="Ex: São Paulo, Brazil"
                      value={pLocations}
                      onChange={(e) => setPLocations(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="min-w-[140px] flex-1 space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Award className="h-3 w-3" />
                      Senioridade
                    </label>
                    <Select value={pSeniority || "any"} onValueChange={(v) => setPSeniority(v === "any" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Qualquer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Qualquer</SelectItem>
                        {apolloSeniorities.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="min-w-[180px] flex-1 space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Factory className="h-3 w-3" />
                      Localização da empresa
                    </label>
                    <Input
                      placeholder="Ex: Brazil, United States"
                      value={pOrgLocations}
                      onChange={(e) => setPOrgLocations(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="min-w-[140px] flex-1 space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Users className="h-3 w-3" />
                      Nº Funcionários
                    </label>
                    <Select value={pEmployees || "any"} onValueChange={(v) => setPEmployees(v === "any" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Qualquer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Qualquer</SelectItem>
                        {apolloEmployeeRanges.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={pLoading} className="h-9 gap-2 px-5">
                      <Search className="h-3.5 w-3.5" />
                      {pLoading ? "Buscando..." : "Buscar"}
                    </Button>
                    {pSearched && (
                      <Button type="button" variant="ghost" size="sm" onClick={clearPeople} className="h-9 gap-1.5 text-muted-foreground">
                        <X className="h-3.5 w-3.5" /> Limpar
                      </Button>
                    )}
                    {pResults.length > 0 && (
                      <Button type="button" variant="outline" size="sm" onClick={handleExportPeople} className="h-9 gap-1.5">
                        <Download className="h-3.5 w-3.5" /> CSV
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {(pSearched || pResults.length > 0) && (
            <>
              <LeadResultsTable results={pResults} isLoading={pLoading} />
              {pPagination && pPagination.total_pages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Página {pPagination.page} de {pPagination.total_pages} ({pPagination.total_entries.toLocaleString()} resultados)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm"
                      disabled={pPagination.page <= 1 || pLoading}
                      onClick={() => handlePeopleSearch(pPagination!.page - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      disabled={pPagination.page >= pPagination.total_pages || pLoading}
                      onClick={() => handlePeopleSearch(pPagination!.page + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Companies Tab ── */}
        <TabsContent value="companies" className="space-y-6">
          <Card className="border border-border shadow-none">
            <CardContent className="p-5">
              <form onSubmit={(e) => { e.preventDefault(); handleCompanySearch(1); }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Nome da empresa..."
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    className="h-11 border-border bg-background pl-10 text-sm"
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="min-w-[180px] flex-1 space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Factory className="h-3 w-3" />
                      Tags/Palavras-chave (vírgula)
                    </label>
                    <Input
                      placeholder="Ex: SaaS, fintech, e-commerce"
                      value={cKeywords}
                      onChange={(e) => setCKeywords(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="min-w-[180px] flex-1 space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      Localização
                    </label>
                    <Input
                      placeholder="Ex: São Paulo, Brazil"
                      value={cLocations}
                      onChange={(e) => setCLocations(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="min-w-[140px] flex-1 space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Users className="h-3 w-3" />
                      Nº Funcionários
                    </label>
                    <Select value={cEmployees || "any"} onValueChange={(v) => setCEmployees(v === "any" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Qualquer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Qualquer</SelectItem>
                        {apolloEmployeeRanges.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={cLoading} className="h-9 gap-2 px-5">
                      <Search className="h-3.5 w-3.5" />
                      {cLoading ? "Buscando..." : "Buscar"}
                    </Button>
                    {cSearched && (
                      <Button type="button" variant="ghost" size="sm" onClick={clearCompanies} className="h-9 gap-1.5 text-muted-foreground">
                        <X className="h-3.5 w-3.5" /> Limpar
                      </Button>
                    )}
                    {cResults.length > 0 && (
                      <Button type="button" variant="outline" size="sm" onClick={handleExportCompanies} className="h-9 gap-1.5">
                        <Download className="h-3.5 w-3.5" /> CSV
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {(cSearched || cResults.length > 0) && (
            <>
              <ResultsTable results={cResults} isLoading={cLoading} />
              {cPagination && cPagination.total_pages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Página {cPagination.page} de {cPagination.total_pages} ({cPagination.total_entries.toLocaleString()} resultados)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm"
                      disabled={cPagination.page <= 1 || cLoading}
                      onClick={() => handleCompanySearch(cPagination!.page - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      disabled={cPagination.page >= cPagination.total_pages || cLoading}
                      onClick={() => handleCompanySearch(cPagination!.page + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApolloSearch;
