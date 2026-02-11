import { useState } from "react";
import { Search, MapPin, Users, DollarSign, Factory, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MultiSelect } from "@/components/MultiSelect";
import {
  companySizes,
  revenueRanges,
  industries,
  locations,
} from "@/lib/filter-catalogs";
import type { AccountSearchFilters } from "@/lib/api/unipile";

type Props = {
  onSearch: (filters: AccountSearchFilters) => void;
  onClear?: () => void;
  isLoading: boolean;
  hasResults?: boolean;
};

export function AccountSearchForm({ onSearch, onClear, isLoading, hasResults }: Props) {
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState<string[]>([]);
  const [industry, setIndustry] = useState<string[]>([]);
  const [companySize, setCompanySize] = useState<string[]>([]);
  const [revenue, setRevenue] = useState<string[]>([]);

  // Envia o texto (ex: "Minas Gerais") e o backend resolve para o ID correto
  const locationOptions = locations.map((l) => ({ value: l.label, label: l.label }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      keywords: keywords || undefined,
      location: location.length ? location : undefined,
      industry: industry.length ? industry : undefined,
      companySize: companySize.length ? companySize : undefined,
      revenue: revenue.length ? revenue : undefined,
    });
  };

  const handleClear = () => {
    setKeywords("");
    setLocation([]);
    setIndustry([]);
    setCompanySize([]);
    setRevenue([]);
    onClear?.();
  };

  return (
    <Card className="border border-border shadow-none">
      <CardContent className="p-5">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empresas por palavra-chave..."
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="h-11 border-border bg-background pl-10 text-sm"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[160px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3 w-3" />
                Localização
              </label>
              <MultiSelect
                options={locationOptions}
                value={location}
                onChange={setLocation}
                placeholder="Qualquer"
              />
            </div>

            <div className="min-w-[160px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Factory className="h-3 w-3" />
                Setor
              </label>
              <MultiSelect
                options={industries}
                value={industry}
                onChange={setIndustry}
                placeholder="Qualquer"
              />
            </div>

            <div className="min-w-[140px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="h-3 w-3" />
                Tamanho
              </label>
              <MultiSelect
                options={companySizes}
                value={companySize}
                onChange={setCompanySize}
                placeholder="Qualquer"
              />
            </div>

            <div className="min-w-[140px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                Faturamento
              </label>
              <MultiSelect
                options={revenueRanges}
                value={revenue}
                onChange={setRevenue}
                placeholder="Qualquer"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isLoading} className="h-9 gap-2 px-5">
                <Search className="h-3.5 w-3.5" />
                {isLoading ? "Buscando..." : "Buscar"}
              </Button>
              {hasResults && (
                <Button type="button" variant="ghost" size="sm" onClick={handleClear} className="h-9 gap-1.5 text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
