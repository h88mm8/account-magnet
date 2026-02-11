import { supabase } from "@/integrations/supabase/client";
import { normalizeAccount, normalizeLead } from "@/lib/normalize";
import { locations as locationsCatalog } from "@/lib/filter-catalogs";

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

export type PagingInfo = {
  start: number;
  count: number;
  total: number | null;
};

export type PaginationInfo = {
  page: number;
  hasMore: boolean;
  totalEstimate: number | null;
};

export type CursorSearchResponse<T> = {
  items: T[];
  cursor: string | null;
  paging: PagingInfo;
};

// Keep legacy type for compatibility
export type SearchResponse<T> = {
  items: T[];
  pagination: PaginationInfo;
};

// ── API calls ────────────────────────────────────────────────────────

export async function searchAccounts(
  filters: AccountSearchFilters,
  cursor?: string | null,
  limit?: number
): Promise<CursorSearchResponse<AccountResult>> {
  const body = cursor
    ? { cursor, ...(limit ? { limit } : {}) }
    : { ...filters, searchType: "accounts", ...(limit ? { limit } : {}) };

  const { data, error } = await supabase.functions.invoke("unipile-search", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao buscar empresas");
  }

  // Build location fallback from applied filter labels
  const locationFallback = buildLocationFallback(filters.location);

  return {
    items: (data.items || []).map((item: Record<string, unknown>) => {
      const normalized = normalizeAccount(item);
      if (!normalized.location && locationFallback) {
        normalized.location = locationFallback;
      }
      return normalized;
    }),
    cursor: data.cursor || null,
    paging: data.paging || { start: 0, count: 0, total: null },
  };
}

function buildLocationFallback(location?: string | string[]): string {
  if (!location) return "";
  const ids = Array.isArray(location) ? location : [location];
  if (ids.length === 0) return "";
  const labels = ids
    .map((id) => {
      const found = locationsCatalog.find((l) => l.value === id);
      return found?.label || "";
    })
    .filter(Boolean);
  return labels.join(", ");
}

export async function searchLeads(
  filters: LeadSearchFilters,
  cursor?: string | null,
  limit?: number
): Promise<CursorSearchResponse<LeadResult>> {
  const body = cursor
    ? { cursor, ...(limit ? { limit } : {}) }
    : { ...filters, searchType: "leads", ...(limit ? { limit } : {}) };

  const { data, error } = await supabase.functions.invoke("unipile-search", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao buscar leads");
  }

  return {
    items: (data.items || []).map((item: Record<string, unknown>) => normalizeLead(item)),
    cursor: data.cursor || null,
    paging: data.paging || { start: 0, count: 0, total: null },
  };
}
