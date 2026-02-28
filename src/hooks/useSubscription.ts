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
    { amount: 500, price: "R$ 49", priceId: "price_1T5m8ORwW8qJ8nV6r43cr4dh" },
    { amount: 1000, price: "R$ 89", priceId: "price_1T5m9RRwW8qJ8nV6sDTxrJ9e" },
    { amount: 5000, price: "R$ 399", priceId: "price_1T5mA2RwW8qJ8nV6tichJPUM" },
    { amount: 10000, price: "R$ 699", priceId: "price_1T5mATRwW8qJ8nV67fO2QRnx" },
  ],
  email: [
    { amount: 1000, price: "R$ 49", priceId: "price_1T5mCERwW8qJ8nV6GMTlt4dP" },
    { amount: 10000, price: "R$ 299", priceId: "price_1T5mCaRwW8qJ8nV6FzrJlAJy" },
    { amount: 50000, price: "R$ 999", priceId: "price_1T5mD1RwW8qJ8nV6PChzg4lV" },
  ],
} as const;

export const CHANNEL_LICENSES = {
  linkedin: { price: "R$ 39/mês", priceId: "price_1T5mECRwW8qJ8nV61HObhpyy" },
  whatsapp: { price: "R$ 39/mês", priceId: "price_1T5mDtRwW8qJ8nV6SyIUVVdK" },
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

export async function subscribeLicense(priceId: string, channel: string) {
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: { priceId, mode: "subscription", channel },
  });
  if (error) throw error;
  if (data?.url) window.open(data.url, "_blank");
}

export async function openCustomerPortal() {
  const { data, error } = await supabase.functions.invoke("customer-portal");
  if (error) throw error;
  if (data?.url) window.open(data.url, "_blank");
}
