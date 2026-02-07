import { supabase } from "@/integrations/supabase/client";

export type AccountSearchFilters = {
  keywords?: string;
  revenue?: string;
  location?: string;
  industry?: string;
  companySize?: string;
};

export type AccountResult = {
  name: string;
  industry: string;
  location: string;
  employeeCount: string;
  linkedinUrl: string;
};

export type SearchResponse = {
  items: AccountResult[];
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
