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

export const industries: FilterOption[] = [
  { value: "1", label: "Defesa e Espaço" },
  { value: "3", label: "Hardware" },
  { value: "4", label: "Software" },
  { value: "5", label: "Telecomunicações" },
  { value: "6", label: "Redes" },
  { value: "7", label: "Semicondutores" },
  { value: "8", label: "Eng. Mecânica/Industrial" },
  { value: "11", label: "Biotecnologia" },
  { value: "12", label: "Saúde" },
  { value: "13", label: "Alimentos e Bebidas" },
  { value: "14", label: "Marketing e Publicidade" },
  { value: "17", label: "Automotivo" },
  { value: "27", label: "Varejo" },
  { value: "28", label: "Bens de Consumo" },
  { value: "29", label: "Cosméticos" },
  { value: "31", label: "Agricultura" },
  { value: "41", label: "Bancos" },
  { value: "42", label: "Seguros" },
  { value: "43", label: "Serviços Financeiros" },
  { value: "44", label: "Governo" },
  { value: "47", label: "Contabilidade" },
  { value: "48", label: "Construção" },
  { value: "51", label: "Logística" },
  { value: "67", label: "Educação" },
  { value: "68", label: "E-Learning" },
  { value: "69", label: "Jurídico" },
  { value: "80", label: "Imobiliário" },
  { value: "94", label: "Consultoria de Gestão" },
  { value: "96", label: "TI e Consultoria" },
  { value: "104", label: "Mineração e Metais" },
  { value: "110", label: "Óleo e Energia" },
  { value: "116", label: "Farmacêutica" },
  { value: "118", label: "Renováveis e Meio Ambiente" },
  { value: "129", label: "Recursos Humanos" },
  { value: "137", label: "Recrutamento" },
  { value: "147", label: "Transporte" },
  { value: "3248", label: "Engenharia Robótica" },
];

// Locations use LinkedIn geo URN numeric IDs
// value = LinkedIn geo ID, label = display name
export const locations: FilterOption[] = [
  // Países
  { value: "106057199", label: "Brasil" },
  { value: "103644278", label: "Estados Unidos" },
  { value: "100364837", label: "Portugal" },
  { value: "101165590", label: "Reino Unido" },
  { value: "101174742", label: "Canadá" },
  { value: "100506914", label: "Alemanha" },
  { value: "105015875", label: "França" },
  { value: "103350119", label: "Espanha" },
  { value: "103464439", label: "México" },
  { value: "104738515", label: "Argentina" },
  { value: "104379274", label: "Colômbia" },
  { value: "100446943", label: "Chile" },

  // Brasil — Estados
  { value: "100364838", label: "São Paulo (Estado)" },
  { value: "103806429", label: "Rio de Janeiro (Estado)" },
  { value: "100501801", label: "Minas Gerais" },
  { value: "106209057", label: "Paraná" },
  { value: "106380113", label: "Santa Catarina" },
  { value: "105959875", label: "Rio Grande do Sul" },
  { value: "103537801", label: "Bahia" },
  { value: "104212806", label: "Distrito Federal" },
  { value: "101937022", label: "Ceará" },
  { value: "104570964", label: "Pernambuco" },
  { value: "102225773", label: "Goiás" },
  { value: "104276157", label: "Pará" },
  { value: "104585960", label: "Maranhão" },
  { value: "105765702", label: "Amazonas" },
  { value: "103482498", label: "Espírito Santo" },
  { value: "102713658", label: "Mato Grosso" },
  { value: "106367697", label: "Mato Grosso do Sul" },
  { value: "104148498", label: "Rio Grande do Norte" },
  { value: "103110384", label: "Paraíba" },
  { value: "103795836", label: "Alagoas" },
  { value: "101444498", label: "Piauí" },
  { value: "103375837", label: "Sergipe" },
  { value: "105207156", label: "Rondônia" },
  { value: "103323778", label: "Tocantins" },
  { value: "102031079", label: "Acre" },
  { value: "100829985", label: "Amapá" },
  { value: "102713980", label: "Roraima" },

  // Brasil — Cidades principais
  { value: "100364837", label: "São Paulo (Cidade)" },
  { value: "103806428", label: "Rio de Janeiro (Cidade)" },
  { value: "103730545", label: "Belo Horizonte" },
  { value: "102713165", label: "Curitiba" },
  { value: "106381429", label: "Porto Alegre" },
  { value: "103049748", label: "Brasília" },
  { value: "101325669", label: "Salvador" },
  { value: "101117052", label: "Recife" },
  { value: "104617901", label: "Fortaleza" },
  { value: "106546498", label: "Florianópolis" },
  { value: "101111856", label: "Campinas" },
  { value: "103571309", label: "Goiânia" },
  { value: "103194625", label: "Manaus" },
  { value: "104071687", label: "Belém" },
  { value: "103169498", label: "Vitória" },
  { value: "103591973", label: "Joinville" },
  { value: "105468703", label: "Ribeirão Preto" },
  { value: "102947539", label: "São José dos Campos" },
  { value: "106229424", label: "Santos" },
  { value: "106267302", label: "Sorocaba" },
];

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
