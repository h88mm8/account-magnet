import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SeparatedCredits {
  leads: number;
  email: number;
  phone: number;
}

export interface ChannelLicenses {
  linkedin: { active: boolean; expires_at: string | null };
  whatsapp: { active: boolean; expires_at: string | null };
}

export interface SubscriptionState {
  credits: SeparatedCredits;
  licenses: ChannelLicenses;
}

// Stripe product/price mapping
export const CREDIT_PACKAGES = {
  leads: [
    { amount: 500, price: "R$ 49", priceId: "price_1T59QORwW8qJ8nV68dJWv29N" },
    { amount: 1000, price: "R$ 89", priceId: "price_1T59QnRwW8qJ8nV6EMgeZh5d" },
    { amount: 5000, price: "R$ 399", priceId: "price_1T59aURwW8qJ8nV6F8bqrTCj" },
    { amount: 10000, price: "R$ 699", priceId: "price_1T59aqRwW8qJ8nV6hxCkXHoK" },
  ],
  email: [
    { amount: 1000, price: "R$ 49", priceId: "price_1T59b2RwW8qJ8nV6DXbbJSAY" },
    { amount: 10000, price: "R$ 299", priceId: "price_1T59bHRwW8qJ8nV6GRbFCmT6" },
    { amount: 50000, price: "R$ 999", priceId: "price_1T59bYRwW8qJ8nV6iqRC9m2c" },
  ],
} as const;

export const CHANNEL_LICENSES = {
  linkedin: { price: "R$ 39/mês", priceId: "price_1T59bmRwW8qJ8nV6mretS07k" },
  whatsapp: { price: "R$ 39/mês", priceId: "price_1T59byRwW8qJ8nV6TedKVN5y" },
} as const;

export function useSubscription() {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery<SubscriptionState>({
    queryKey: ["subscription-state", user?.id],
    enabled: !!user,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      return data as SubscriptionState;
    },
  });

  const defaultState: SubscriptionState = {
    credits: { leads: 50, email: 0, phone: 0 },
    licenses: {
      linkedin: { active: false, expires_at: null },
      whatsapp: { active: false, expires_at: null },
    },
  };

  return {
    credits: data?.credits ?? defaultState.credits,
    licenses: data?.licenses ?? defaultState.licenses,
    isLoading,
    refetch,
  };
}

export async function buyCredits(priceId: string) {
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: { priceId, mode: "payment" },
  });
  if (error) throw error;
  if (data?.url) window.open(data.url, "_blank");
}

export async function subscribeLicense(priceId: string) {
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: { priceId, mode: "subscription" },
  });
  if (error) throw error;
  if (data?.url) window.open(data.url, "_blank");
}

export async function openCustomerPortal() {
  const { data, error } = await supabase.functions.invoke("customer-portal");
  if (error) throw error;
  if (data?.url) window.open(data.url, "_blank");
}
