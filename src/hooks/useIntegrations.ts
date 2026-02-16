import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type IntegrationStatus = "disconnected" | "pending" | "connected" | "expired";
export type IntegrationProvider = "linkedin" | "email";

interface Integration {
  status: IntegrationStatus;
  unipile_account_id: string | null;
  provider_email: string | null;
  connected_at: string | null;
}

export function useIntegration(provider: IntegrationProvider) {
  const { user } = useAuth();
  const [status, setStatus] = useState<IntegrationStatus>("disconnected");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!user) {
      setStatus("disconnected");
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      const { data } = await supabase
        .from("user_integrations")
        .select("status")
        .eq("user_id", user.id)
        .eq("provider", provider)
        .single();

      setStatus((data?.status as IntegrationStatus) || "disconnected");
      setLoading(false);
    };

    fetchStatus();

    // Listen for realtime updates
    const channel = supabase
      .channel(`integration-${provider}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_integrations",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row?.provider === provider) {
            const newStatus = row.status as IntegrationStatus;
            if (newStatus) {
              setStatus(newStatus);
              if (newStatus === "connected") {
                setConnecting(false);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, provider]);

  const connect = useCallback(async (): Promise<string | null> => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-account", {
        body: { action: "connect", provider },
      });

      if (error || data?.error) {
        console.error(`${provider} connect error:`, error || data?.error);
        setConnecting(false);
        return null;
      }

      setStatus("pending");
      return data?.url || null;
    } catch (err) {
      console.error(`${provider} connect error:`, err);
      setConnecting(false);
      return null;
    }
  }, [provider]);

  const disconnect = useCallback(async () => {
    try {
      await supabase.functions.invoke("connect-account", {
        body: { action: "disconnect", provider },
      });
      setStatus("disconnected");
    } catch (err) {
      console.error(`${provider} disconnect error:`, err);
    }
  }, [provider]);

  return { status, loading, connecting, connect, disconnect };
}

/** Check if a user has an active integration for a provider */
export async function checkIntegration(userId: string, provider: IntegrationProvider): Promise<boolean> {
  const { data } = await supabase
    .from("user_integrations")
    .select("status")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("status", "connected")
    .single();
  return !!data;
}
