import { useState } from "react";
import { Search, MapPin, Users, Factory, Briefcase, Award, Clock, Building, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MultiSelect } from "@/components/MultiSelect";
import { FilterAutocomplete, type ResolvedFilterItem } from "@/components/FilterAutocomplete";
import {
  seniorityLevels,
  jobFunctions,
  companySizes,
  yearsOfExperience,
  yearsAtCurrentCompany,
} from "@/lib/filter-catalogs";
import type { LeadSearchFilters } from "@/lib/api/unipile";

type Props = {
  onSearch: (filters: LeadSearchFilters) => void;
  onClear?: () => void;
  isLoading: boolean;
  hasResults?: boolean;
};

export function LeadSearchForm({ onSearch, onClear, isLoading, hasResults }: Props) {
  const [keywords, setKeywords] = useState("");
  const [seniority, setSeniority] = useState<string[]>([]);
  const [jobFunction, setJobFunction] = useState<string[]>([]);
  const [industry, setIndustry] = useState<ResolvedFilterItem[]>([]);
  const [location, setLocation] = useState<ResolvedFilterItem[]>([]);
  const [companySize, setCompanySize] = useState<string[]>([]);
  const [experience, setExperience] = useState<string[]>([]);
  const [tenure, setTenure] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      keywords: keywords || undefined,
      seniority: seniority.length ? seniority : undefined,
      jobFunction: jobFunction.length ? jobFunction : undefined,
      industry: industry.length ? industry : undefined,
      location: location.length ? location : undefined,
      companySize: companySize.length ? companySize : undefined,
      yearsOfExperience: experience.length ? experience : undefined,
      yearsAtCurrentCompany: tenure.length ? tenure : undefined,
    });
  };

  const handleClear = () => {
    setKeywords("");
    setSeniority([]);
    setJobFunction([]);
    setIndustry([]);
    setLocation([]);
    setCompanySize([]);
    setExperience([]);
    setTenure([]);
    onClear?.();
  };

  return (
    <Card className="border border-border shadow-none">
      <CardContent className="p-5">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar pessoas por cargo, nome ou palavra-chave..."
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="h-11 border-border bg-background pl-10 text-sm"
            />
          </div>

          {/* Row 1: Core lead filters */}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[160px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Award className="h-3 w-3" />
                Senioridade
              </label>
              <MultiSelect
                options={seniorityLevels}
                value={seniority}
                onChange={setSeniority}
                placeholder="Qualquer"
              />
            </div>

            <div className="min-w-[160px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Briefcase className="h-3 w-3" />
                Função
              </label>
              <MultiSelect
                options={jobFunctions}
                value={jobFunction}
                onChange={setJobFunction}
                placeholder="Qualquer"
              />
            </div>

            <div className="min-w-[160px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Factory className="h-3 w-3" />
                Setor
              </label>
              <FilterAutocomplete
                lookupType="INDUSTRY"
                value={industry}
                onChange={setIndustry}
                placeholder="Digite o setor..."
              />
            </div>

            <div className="min-w-[160px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3 w-3" />
                Localização
              </label>
              <FilterAutocomplete
                lookupType="LOCATION"
                value={location}
                onChange={setLocation}
                placeholder="Digite país, estado ou cidade..."
              />
            </div>
          </div>

          {/* Row 2: Additional lead filters */}
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[140px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="h-3 w-3" />
                Tamanho da empresa
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
                <Clock className="h-3 w-3" />
                Experiência
              </label>
              <MultiSelect
                options={yearsOfExperience}
                value={experience}
                onChange={setExperience}
                placeholder="Qualquer"
              />
            </div>

            <div className="min-w-[140px] flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Building className="h-3 w-3" />
                Tempo na empresa
              </label>
              <MultiSelect
                options={yearsAtCurrentCompany}
                value={tenure}
                onChange={setTenure}
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
