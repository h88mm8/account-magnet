import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type WhatsAppStatus = "disconnected" | "pending" | "connected";

interface WhatsAppConnection {
  status: WhatsAppStatus;
  unipile_account_id: string | null;
  connected_at: string | null;
}

export function useWhatsAppConnection() {
  const { user } = useAuth();
  const [status, setStatus] = useState<WhatsAppStatus>("disconnected");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Fetch initial status
  useEffect(() => {
    if (!user) {
      setStatus("disconnected");
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      const { data } = await supabase
        .from("whatsapp_connections")
        .select("status")
        .eq("user_id", user.id)
        .single();

      setStatus((data?.status as WhatsAppStatus) || "disconnected");
      setLoading(false);
    };

    fetchStatus();

    // Listen for realtime updates
    const channel = supabase
      .channel(`whatsapp-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_connections",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.status as WhatsAppStatus;
          if (newStatus) {
            setStatus(newStatus);
            if (newStatus === "connected") {
              setConnecting(false);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const connect = useCallback(async (): Promise<string | null> => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "connect" },
      });

      if (error || data?.error) {
        console.error("WhatsApp connect error:", error || data?.error);
        setConnecting(false);
        return null;
      }

      setStatus("pending");
      return data?.url || null;
    } catch (err) {
      console.error("WhatsApp connect error:", err);
      setConnecting(false);
      return null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "disconnect" },
      });
      setStatus("disconnected");
    } catch (err) {
      console.error("WhatsApp disconnect error:", err);
    }
  }, []);

  return { status, loading, connecting, connect, disconnect };
}
