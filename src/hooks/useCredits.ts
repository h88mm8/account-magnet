import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCredits() {
  const { user } = useAuth();

  const { data: separatedCredits, isLoading, refetch } = useQuery({
    queryKey: ["user-credits-separated", user?.id],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_credits_separated" as any)
        .select("leads_balance, email_balance, phone_balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return {
        leads: (data as any)?.leads_balance ?? 50,
        email: (data as any)?.email_balance ?? 0,
        phone: (data as any)?.phone_balance ?? 0,
      };
    },
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["credit-transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Backward compatibility
  const balance = (separatedCredits?.leads ?? 0) + (separatedCredits?.email ?? 0) + (separatedCredits?.phone ?? 0);

  return {
    balance,
    leads: separatedCredits?.leads ?? 50,
    email: separatedCredits?.email ?? 0,
    phone: separatedCredits?.phone ?? 0,
    isLoading,
    transactions,
    txLoading,
    refetch,
  };
}
