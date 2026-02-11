// Shared filter option catalogs for Accounts & Leads
// IDs match LinkedIn Sales Navigator geo URNs exactly

export type FilterOption = {
  value: string;
  label: string;
};

// ── Shared filters (Accounts + Leads) ────────────────────────────────

export const companySizes: FilterOption[] = [
  { value: "B", label: "1-10" },
  { value: "C", label: "11-50" },
  { value: "D", label: "51-200" },
  { value: "E", label: "201-500" },
  { value: "F", label: "501-1.000" },
  { value: "G", label: "1.001-5.000" },
  { value: "H", label: "5.001-10.000" },
  { value: "I", label: "10.000+" },
];

// Industries and Locations are resolved dynamically via FilterAutocomplete + unipile-lookup.
// No fixed catalogs — all options come from LinkedIn/Unipile search endpoint.

export const revenueRanges: FilterOption[] = [
  { value: "1", label: "< $1M" },
  { value: "2", label: "$1M – $10M" },
  { value: "3", label: "$10M – $50M" },
  { value: "4", label: "$50M – $100M" },
  { value: "5", label: "$100M – $500M" },
  { value: "6", label: "$500M – $1B" },
  { value: "7", label: "> $1B" },
];

// ── Lead-only filters ────────────────────────────────────────────────

export const seniorityLevels: FilterOption[] = [
  { value: "1", label: "Não remunerado" },
  { value: "2", label: "Estágio" },
  { value: "3", label: "Júnior" },
  { value: "4", label: "Sênior" },
  { value: "5", label: "Gerente" },
  { value: "6", label: "Diretor" },
  { value: "7", label: "VP" },
  { value: "8", label: "C-Level" },
  { value: "9", label: "Proprietário" },
  { value: "10", label: "Sócio" },
];

export const jobFunctions: FilterOption[] = [
  { value: "1", label: "Contabilidade" },
  { value: "2", label: "Administrativo" },
  { value: "3", label: "Artes e Design" },
  { value: "4", label: "Desenvolvimento de Negócios" },
  { value: "5", label: "Serviços Sociais" },
  { value: "6", label: "Consultoria" },
  { value: "7", label: "Educação" },
  { value: "8", label: "Engenharia" },
  { value: "9", label: "Empreendedorismo" },
  { value: "10", label: "Finanças" },
  { value: "11", label: "Saúde" },
  { value: "12", label: "Recursos Humanos" },
  { value: "13", label: "TI" },
  { value: "14", label: "Jurídico" },
  { value: "15", label: "Marketing" },
  { value: "16", label: "Mídia e Comunicação" },
  { value: "17", label: "Militar e Segurança" },
  { value: "18", label: "Operações" },
  { value: "19", label: "Gestão de Produtos" },
  { value: "20", label: "Gestão de Projetos" },
  { value: "21", label: "Compras" },
  { value: "22", label: "Qualidade" },
  { value: "23", label: "Imobiliário" },
  { value: "24", label: "Pesquisa" },
  { value: "25", label: "Vendas" },
  { value: "26", label: "Suporte" },
];

export const yearsOfExperience: FilterOption[] = [
  { value: "1", label: "< 1 ano" },
  { value: "2", label: "1-2 anos" },
  { value: "3", label: "3-5 anos" },
  { value: "4", label: "6-10 anos" },
  { value: "5", label: "10+ anos" },
];

export const yearsAtCurrentCompany: FilterOption[] = [
  { value: "1", label: "< 1 ano" },
  { value: "2", label: "1-2 anos" },
  { value: "3", label: "3-5 anos" },
  { value: "4", label: "6-10 anos" },
  { value: "5", label: "10+ anos" },
];

// ── Filter metadata (multi-select flag) ──────────────────────────────

export const FILTER_META = {
  // Accounts
  companySize: { multiSelect: true, label: "Tamanho" },
  revenue: { multiSelect: true, label: "Faturamento" },
  industry: { multiSelect: true, label: "Setor" },
  location: { multiSelect: true, label: "Localização" },
  // Leads
  seniority: { multiSelect: true, label: "Senioridade" },
  jobFunction: { multiSelect: true, label: "Função" },
  yearsOfExperience: { multiSelect: true, label: "Experiência" },
  yearsAtCurrentCompany: { multiSelect: true, label: "Tempo na empresa" },
} as const;
