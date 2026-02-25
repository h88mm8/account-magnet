import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export type ProspectList = {
  id: string;
  name: string;
  description: string | null;
  list_type: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
};

export type ProspectListItem = {
  id: string;
  list_id: string;
  item_type: string;
  external_id: string | null;
  provider_id: string | null;
  name: string;
  title: string | null;
  company: string | null;
  industry: string | null;
  location: string | null;
  linkedin_url: string | null;
  headcount: string | null;
  email: string | null;
  phone: string | null;
  enrichment_source: string | null;
  enrichment_status: string | null;
  email_checked_at: string | null;
  phone_checked_at: string | null;
  link_clicks_count: number;
  created_at: string;
};

export function useProspectLists() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedItemKeys, setSavedItemKeys] = useState<Set<string>>(new Set());

  const invalidateMetrics = () => {
    queryClient.invalidateQueries({ queryKey: ["real-metrics"] });
    queryClient.invalidateQueries({ queryKey: ["monthly-chart-data"] });
    queryClient.invalidateQueries({ queryKey: ["industry-chart-data"] });
  };

  const fetchLists = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("prospect_lists")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching lists:", error);
    } else if (data) {
      // Get item counts
      const listsWithCounts = await Promise.all(
        data.map(async (list) => {
          const { count } = await supabase
            .from("prospect_list_items")
            .select("*", { count: "exact", head: true })
            .eq("list_id", list.id);
          return { ...list, item_count: count ?? 0 };
        })
      );
      setLists(listsWithCounts);
    }
    setLoading(false);
  }, [user]);

  const fetchSavedItemKeys = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("prospect_list_items")
      .select("linkedin_url, name, item_type");
    if (data) {
      const keys = new Set(data.map((d) => `${d.item_type}:${d.linkedin_url || d.name}`));
      setSavedItemKeys(keys);
    }
  }, [user]);

  useEffect(() => {
    fetchLists();
    fetchSavedItemKeys();
  }, [fetchLists, fetchSavedItemKeys]);

  const createList = async (name: string, listType: string = "mixed", description?: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("prospect_lists")
      .insert({ user_id: user.id, name, list_type: listType, description: description || null })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return null;
    }
    await fetchLists();
    invalidateMetrics();
    return data;
  };

  const deleteList = async (listId: string) => {
    const { error } = await supabase.from("prospect_lists").delete().eq("id", listId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lista excluída" });
      await fetchLists();
      await fetchSavedItemKeys();
      invalidateMetrics();
    }
  };

  const renameList = async (listId: string, name: string) => {
    const { error } = await supabase.from("prospect_lists").update({ name }).eq("id", listId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      await fetchLists();
    }
  };

  const addItemsToList = async (
    listId: string,
    items: Array<{
      item_type: "account" | "lead";
      name: string;
      title?: string;
      company?: string;
      industry?: string;
      location?: string;
      linkedin_url?: string;
      headcount?: string;
      email?: string;
      phone?: string;
      provider_id?: string;
    }>
  ) => {
    if (!user) return;
    const rows = items.map((item) => {
      let email = item.email;
      let phone = item.phone;

      // Protect against email stored in phone field
      if (phone && phone.includes("@")) {
        console.warn(`[save-to-list] Phone contains '@', moving to email: ${phone}`);
        if (!email) {
          email = phone;
        }
        phone = undefined;
      }

      return {
        list_id: listId,
        user_id: user.id,
        ...item,
        email,
        phone,
      };
    });
    console.log("[save-to-list] Items being saved:", JSON.stringify(rows.map(r => ({
      name: r.name, linkedin_url: r.linkedin_url, company: r.company, email: r.email, phone: r.phone, provider_id: r.provider_id,
    })), null, 2));
    const { data: inserted, error } = await supabase
      .from("prospect_list_items")
      .insert(rows)
      .select();
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${items.length} item(s) salvo(s) na lista!` });
      await fetchLists();
      await fetchSavedItemKeys();
      invalidateMetrics();

      // Auto-enrich basic profile data via Apify LinkedIn scraper
      if (inserted && inserted.length > 0) {
        const enrichItems = inserted
          .filter((row: Record<string, unknown>) => row.linkedin_url)
          .map((row: Record<string, unknown>) => ({
            itemId: row.id as string,
            linkedinUrl: row.linkedin_url as string,
          }));

        if (enrichItems.length > 0) {
          // Fire-and-forget — don't block the UI
          supabase.functions
            .invoke("enrich-profile-basic", { body: { items: enrichItems } })
            .then((res) => {
              if (res.data?.enriched > 0) {
                console.log(`[auto-enrich] ${res.data.enriched}/${enrichItems.length} profiles enriched`);
              }
            })
            .catch((err) => console.warn("[auto-enrich] error:", err));
        }
      }
    }
  };

  const getListItems = useCallback(async (listId: string) => {
    const { data, error } = await supabase
      .from("prospect_list_items")
      .select("*")
      .eq("list_id", listId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return [];
    }
    return data as ProspectListItem[];
  }, []);

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("prospect_list_items").delete().eq("id", itemId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      await fetchLists();
      await fetchSavedItemKeys();
      invalidateMetrics();
    }
  };

  const isItemSaved = (itemType: string, linkedinUrl?: string, name?: string) => {
    return savedItemKeys.has(`${itemType}:${linkedinUrl || name || ""}`);
  };

  return {
    lists,
    loading,
    fetchLists,
    createList,
    deleteList,
    renameList,
    addItemsToList,
    getListItems,
    removeItem,
    isItemSaved,
    fetchSavedItemKeys,
  };
}
