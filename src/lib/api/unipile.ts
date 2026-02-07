import { supabase } from "@/integrations/supabase/client";

export type AccountSearchFilters = {
  keywords?: string;
  revenue?: string;
  location?: string;
  industry?: string;
  companySize?: string;
  accountId: string;
};

export type AccountResult = {
  type: string;
  id: string;
  name?: string;
  industry?: string;
  location?: string;
  employeeCount?: string;
  description?: string;
  linkedinUrl?: string;
  raw?: Record<string, unknown>;
};

export type SearchResponse = {
  object: string;
  items: AccountResult[];
  cursor?: string;
};

export async function searchAccounts(filters: AccountSearchFilters): Promise<SearchResponse> {
  const { data, error } = await supabase.functions.invoke("unipile-search", {
    body: filters,
  });

  if (error) {
    throw new Error(error.message || "Erro ao buscar leads");
  }

  return data;
}
