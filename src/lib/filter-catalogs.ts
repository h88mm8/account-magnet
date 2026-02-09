// Shared filter option catalogs for Accounts & Leads
// IDs match LinkedIn Sales Navigator exactly

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

export const locations: FilterOption[] = [
  { value: "brasil", label: "Brasil" },
  { value: "sao_paulo", label: "São Paulo" },
  { value: "rio_de_janeiro", label: "Rio de Janeiro" },
  { value: "minas_gerais", label: "Minas Gerais" },
  { value: "parana", label: "Paraná" },
  { value: "santa_catarina", label: "Santa Catarina" },
  { value: "rio_grande_do_sul", label: "Rio Grande do Sul" },
  { value: "bahia", label: "Bahia" },
  { value: "distrito_federal", label: "Distrito Federal" },
  { value: "ceara", label: "Ceará" },
  { value: "pernambuco", label: "Pernambuco" },
  { value: "goias", label: "Goiás" },
  { value: "estados_unidos", label: "Estados Unidos" },
  { value: "portugal", label: "Portugal" },
  { value: "reino_unido", label: "Reino Unido" },
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
