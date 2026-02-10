import { supabase } from "@/integrations/supabase/client";
import { normalizeAccount, normalizeLead } from "@/lib/normalize";

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
  revenue?: string;
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
  profilePictureUrl?: string;
  email?: string;
  phoneNumber?: string;
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

  return {
    ...data,
    items: (data.items || []).map((item: Record<string, unknown>) => normalizeAccount(item)),
  };
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

  return {
    ...data,
    items: (data.items || []).map((item: Record<string, unknown>) => normalizeLead(item)),
  };
}
