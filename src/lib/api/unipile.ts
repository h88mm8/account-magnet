import { supabase } from "@/integrations/supabase/client";
import { normalizeAccount, normalizeLead } from "@/lib/normalize";
import type { ResolvedFilterItem } from "@/components/FilterAutocomplete";

// ── Account types ────────────────────────────────────────────────────

export type AccountSearchFilters = {
  keywords?: string;
  revenue?: string | string[];
  /** Resolved location items with LinkedIn geo IDs */
  location?: ResolvedFilterItem[];
  /** Resolved industry items with LinkedIn IDs (optional, falls back to catalog IDs) */
  industry?: ResolvedFilterItem[] | string | string[];
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
  /** Resolved industry items with LinkedIn IDs (optional, falls back to catalog IDs) */
  industry?: ResolvedFilterItem[] | string[];
  /** Resolved location items with LinkedIn geo IDs */
  location?: ResolvedFilterItem[];
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

/** Build a human-readable fallback string from resolved location items */
function buildLocationFallback(location?: ResolvedFilterItem[]): string {
  if (!location || location.length === 0) return "";
  return location.map((l) => l.label).join(", ");
}

/** Serialize resolved items to send to the edge function */
function serializeResolvedItems(items?: ResolvedFilterItem[] | string | string[]): { id: string; text: string; type: string }[] | undefined {
  if (!items) return undefined;
  // If it's an array of resolved items (objects with id + label)
  if (Array.isArray(items) && items.length > 0 && typeof items[0] === "object" && "id" in items[0]) {
    return (items as ResolvedFilterItem[]).map((item) => ({
      id: item.id,
      text: item.label,
      type: item.type,
    }));
  }
  // If it's a string or string[] (legacy catalog IDs), pass through
  return undefined;
}

// ── API calls ────────────────────────────────────────────────────────

export async function searchAccounts(
  filters: AccountSearchFilters,
  cursor?: string | null,
  limit?: number
): Promise<CursorSearchResponse<AccountResult>> {
  const resolvedLocation = serializeResolvedItems(filters.location);
  const resolvedIndustry = serializeResolvedItems(filters.industry);

  const body = cursor
    ? { cursor, ...(limit ? { limit } : {}) }
    : {
        keywords: filters.keywords,
        revenue: filters.revenue,
        companySize: filters.companySize,
        // Send resolved items as structured objects
        ...(resolvedLocation ? { locationResolved: resolvedLocation } : {}),
        ...(resolvedIndustry
          ? { industryResolved: resolvedIndustry }
          : filters.industry
          ? { industry: filters.industry }
          : {}),
        searchType: "accounts",
        ...(limit ? { limit } : {}),
      };

  const { data, error } = await supabase.functions.invoke("unipile-search", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao buscar empresas");
  }

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

export async function searchLeads(
  filters: LeadSearchFilters,
  cursor?: string | null,
  limit?: number
): Promise<CursorSearchResponse<LeadResult>> {
  const resolvedLocation = serializeResolvedItems(filters.location);
  const resolvedIndustry = serializeResolvedItems(filters.industry);

  const body = cursor
    ? { cursor, ...(limit ? { limit } : {}) }
    : {
        keywords: filters.keywords,
        seniority: filters.seniority,
        jobFunction: filters.jobFunction,
        companySize: filters.companySize,
        yearsOfExperience: filters.yearsOfExperience,
        yearsAtCurrentCompany: filters.yearsAtCurrentCompany,
        // Send resolved items as structured objects
        ...(resolvedLocation ? { locationResolved: resolvedLocation } : {}),
        ...(resolvedIndustry
          ? { industryResolved: resolvedIndustry }
          : filters.industry
          ? { industry: filters.industry }
          : {}),
        searchType: "leads",
        ...(limit ? { limit } : {}),
      };

  const { data, error } = await supabase.functions.invoke("unipile-search", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao buscar leads");
  }

  const locationFallback = buildLocationFallback(filters.location);

  return {
    items: (data.items || []).map((item: Record<string, unknown>) => {
      const normalized = normalizeLead(item);
      if (!normalized.location && locationFallback) {
        normalized.location = locationFallback;
      }
      return normalized;
    }),
    cursor: data.cursor || null,
    paging: data.paging || { start: 0, count: 0, total: null },
  };
}
