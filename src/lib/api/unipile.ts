import { supabase } from "@/integrations/supabase/client";

// ── Account types ────────────────────────────────────────────────────

export type AccountSearchFilters = {
  keywords?: string;
  revenue?: string | string[];
  location?: string | string[];
  industry?: string | string[];
  companySize?: string | string[];
};

export type AccountResult = {
  name: string;
  industry: string;
  location: string;
  employeeCount: string;
  linkedinUrl: string;
};

// ── Lead types ───────────────────────────────────────────────────────

export type LeadSearchFilters = {
  keywords?: string;
  seniority?: string[];
  jobFunction?: string[];
  industry?: string[];
  location?: string[];
  companySize?: string[];
  yearsOfExperience?: string[];
  yearsAtCurrentCompany?: string[];
};

export type LeadResult = {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  location: string;
  linkedinUrl: string;
};

// ── Pagination ───────────────────────────────────────────────────────

export type PaginationInfo = {
  page: number;
  hasMore: boolean;
  totalEstimate: number | null;
};

export type SearchResponse<T> = {
  items: T[];
  pagination: PaginationInfo;
};

// ── API calls ────────────────────────────────────────────────────────

export async function searchAccounts(
  filters: AccountSearchFilters,
  page = 1
): Promise<SearchResponse<AccountResult>> {
  const { data, error } = await supabase.functions.invoke("unipile-search", {
    body: { ...filters, searchType: "accounts", page },
  });

  if (error) {
    throw new Error(error.message || "Erro ao buscar empresas");
  }

  return data;
}

export async function searchLeads(
  filters: LeadSearchFilters,
  page = 1
): Promise<SearchResponse<LeadResult>> {
  const { data, error } = await supabase.functions.invoke("unipile-search", {
    body: { ...filters, searchType: "leads", page },
  });

  if (error) {
    throw new Error(error.message || "Erro ao buscar leads");
  }

  return data;
}
