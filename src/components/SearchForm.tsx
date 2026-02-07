import { useState } from "react";
import { Search, MapPin, Users, DollarSign, Factory, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

type SearchFilters = {
  keywords: string;
  revenue: string;
  location: string;
  industry: string;
  companySize: string;
};

type Props = {
  onSearch: (filters: SearchFilters) => void;
  isLoading: boolean;
};

const companySizes = [
  { value: "any", label: "Qualquer" },
  { value: "B", label: "1-10" },
  { value: "C", label: "11-50" },
  { value: "D", label: "51-200" },
  { value: "E", label: "201-500" },
  { value: "F", label: "501-1.000" },
  { value: "G", label: "1.001-5.000" },
  { value: "H", label: "5.001-10.000" },
  { value: "I", label: "10.000+" },
];

const revenueRanges = [
  { value: "any", label: "Qualquer" },
  { value: "1", label: "< $1M" },
  { value: "2", label: "$1M – $10M" },
  { value: "3", label: "$10M – $50M" },
  { value: "4", label: "$50M – $100M" },
  { value: "5", label: "$100M – $500M" },
  { value: "6", label: "$500M – $1B" },
  { value: "7", label: "> $1B" },
];

export function SearchForm({ onSearch, isLoading }: Props) {
  const [filters, setFilters] = useState<SearchFilters>({
    keywords: "",
    revenue: "",
    location: "",
    industry: "",
    companySize: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const update = (key: keyof SearchFilters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value === "any" ? "" : value }));

  return (
    <Card className="border border-border shadow-none">
      <CardContent className="p-5">
        <form onSubmit={handleSubmit}>
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empresas por palavra-chave..."
              value={filters.keywords}
              onChange={(e) => update("keywords", e.target.value)}
              className="h-11 border-border bg-background pl-10 text-sm"
            />
          </div>

          {/* Filters row */}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[160px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3 w-3" />
                Localização
              </label>
              <Input
                placeholder="Ex: São Paulo"
                value={filters.location}
                onChange={(e) => update("location", e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="min-w-[140px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Factory className="h-3 w-3" />
                Setor
              </label>
              <Input
                placeholder="Ex: Software"
                value={filters.industry}
                onChange={(e) => update("industry", e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="min-w-[140px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="h-3 w-3" />
                Tamanho
              </label>
              <Select value={filters.companySize || "any"} onValueChange={(v) => update("companySize", v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Qualquer" />
                </SelectTrigger>
                <SelectContent>
                  {companySizes.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[140px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                Faturamento
              </label>
              <Select value={filters.revenue || "any"} onValueChange={(v) => update("revenue", v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Qualquer" />
                </SelectTrigger>
                <SelectContent>
                  {revenueRanges.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={isLoading} className="h-9 gap-2 px-5">
              <Search className="h-3.5 w-3.5" />
              {isLoading ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
