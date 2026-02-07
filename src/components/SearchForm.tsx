import { useState } from "react";
import { Search, Building2, MapPin, Users, DollarSign, Factory } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";

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
  { value: "", label: "Qualquer" },
  { value: "B", label: "1-10" },
  { value: "C", label: "11-50" },
  { value: "D", label: "51-200" },
  { value: "E", label: "201-500" },
  { value: "F", label: "501-1000" },
  { value: "G", label: "1001-5000" },
  { value: "H", label: "5001-10000" },
  { value: "I", label: "10000+" },
];

const revenueRanges = [
  { value: "", label: "Qualquer" },
  { value: "1", label: "< $1M" },
  { value: "2", label: "$1M - $10M" },
  { value: "3", label: "$10M - $50M" },
  { value: "4", label: "$50M - $100M" },
  { value: "5", label: "$100M - $500M" },
  { value: "6", label: "$500M - $1B" },
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
    setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Keywords */}
        <div className="space-y-2 lg:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Search className="h-4 w-4 text-primary" />
            Palavras-chave
          </label>
          <Input
            placeholder="Ex: SaaS, tecnologia, fintech..."
            value={filters.keywords}
            onChange={(e) => update("keywords", e.target.value)}
          />
        </div>

        {/* Location */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            Localização
          </label>
          <Input
            placeholder="Ex: São Paulo, Brasil..."
            value={filters.location}
            onChange={(e) => update("location", e.target.value)}
          />
        </div>

        {/* Industry */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Factory className="h-4 w-4 text-primary" />
            Setor
          </label>
          <Input
            placeholder="Ex: Software, Healthcare..."
            value={filters.industry}
            onChange={(e) => update("industry", e.target.value)}
          />
        </div>

        {/* Company Size */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="h-4 w-4 text-primary" />
            Tamanho da empresa
          </label>
          <Select value={filters.companySize} onValueChange={(v) => update("companySize", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {companySizes.map((s) => (
                <SelectItem key={s.value} value={s.value || "any"}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Revenue */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <DollarSign className="h-4 w-4 text-primary" />
            Faturamento
          </label>
          <Select value={filters.revenue} onValueChange={(v) => update("revenue", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {revenueRanges.map((r) => (
                <SelectItem key={r.value} value={r.value || "any"}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={isLoading} size="lg" className="gap-2 px-8">
          <Search className="h-4 w-4" />
          {isLoading ? "Buscando..." : "Buscar Accounts"}
        </Button>
      </div>
    </motion.form>
  );
}
