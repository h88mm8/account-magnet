import { supabase } from "@/integrations/supabase/client";
import type { AccountResult, LeadResult } from "@/lib/api/unipile";

// ── Apollo-specific filter types ─────────────────────────────────────

export type ApolloPersonFilters = {
  q_keywords?: string;
  person_titles?: string[];
  person_locations?: string[];
  person_seniorities?: string[];
  organization_locations?: string[];
  organization_num_employees_ranges?: string[];
};

export type ApolloCompanyFilters = {
  q_organization_name?: string;
  q_organization_keyword_tags?: string[];
  organization_locations?: string[];
  organization_num_employees_ranges?: string[];
};

export type ApolloPagination = {
  page: number;
  total_pages: number;
  total_entries: number;
  per_page: number;
};

export type ApolloSearchResponse<T> = {
  items: T[];
  pagination: ApolloPagination;
};

// ── Catalog data ────────────────────────────────────────────────────

export const apolloSeniorities = [
  { value: "owner", label: "Proprietário" },
  { value: "founder", label: "Fundador" },
  { value: "c_suite", label: "C-Level" },
  { value: "partner", label: "Sócio" },
  { value: "vp", label: "VP" },
  { value: "head", label: "Head" },
  { value: "director", label: "Diretor" },
  { value: "manager", label: "Gerente" },
  { value: "senior", label: "Sênior" },
  { value: "entry", label: "Júnior" },
  { value: "intern", label: "Estagiário" },
];

export const apolloEmployeeRanges = [
  { value: "1,10", label: "1-10" },
  { value: "11,20", label: "11-20" },
  { value: "21,50", label: "21-50" },
  { value: "51,100", label: "51-100" },
  { value: "101,200", label: "101-200" },
  { value: "201,500", label: "201-500" },
  { value: "501,1000", label: "501-1.000" },
  { value: "1001,5000", label: "1.001-5.000" },
  { value: "5001,10000", label: "5.001-10.000" },
  { value: "10001,", label: "10.000+" },
];

// ── API calls ───────────────────────────────────────────────────────

export async function searchApolloPersons(
  filters: ApolloPersonFilters,
  page = 1,
  perPage = 25
): Promise<ApolloSearchResponse<LeadResult>> {
  const { data, error } = await supabase.functions.invoke("apollo-search", {
    body: {
      searchType: "people",
      page,
      per_page: perPage,
      ...filters,
    },
  });

  if (error) throw new Error(error.message || "Erro ao buscar pessoas no Apollo");
  if (data?.error) throw new Error(data.error);

  return {
    items: data.items || [],
    pagination: data.pagination || { page: 1, total_pages: 0, total_entries: 0, per_page: perPage },
  };
}

export async function searchApolloCompanies(
  filters: ApolloCompanyFilters,
  page = 1,
  perPage = 25
): Promise<ApolloSearchResponse<AccountResult>> {
  const { data, error } = await supabase.functions.invoke("apollo-search", {
    body: {
      searchType: "companies",
      page,
      per_page: perPage,
      ...filters,
    },
  });

  if (error) throw new Error(error.message || "Erro ao buscar empresas no Apollo");
  if (data?.error) throw new Error(data.error);

  return {
    items: data.items || [],
    pagination: data.pagination || { page: 1, total_pages: 0, total_entries: 0, per_page: perPage },
  };
}
