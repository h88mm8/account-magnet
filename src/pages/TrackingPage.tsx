import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface TrackingSettings {
  logo_url: string | null;
  background_color: string;
  button_text: string;
  button_color: string;
  button_font_color: string;
  redirect_url: string | null;
}

export default function TrackingPage() {
  const { token } = useParams<{ token: string }>();
  const [settings, setSettings] = useState<TrackingSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clicking, setClicking] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Link inválido.");
      setLoading(false);
      return;
    }

    fetch(`${SUPABASE_URL}/functions/v1/track-click?action=validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError("Este link não é válido ou expirou.");
        } else {
          setSettings(data.settings);
        }
      })
      .catch(() => setError("Erro ao carregar a página."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleClick = async () => {
    if (clicking || !token) return;
    setClicking(true);

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/track-click?action=click`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({ token }),
      });
      const data = await resp.json();
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      }
    } catch {
      // Fallback: redirect to settings URL if available
      if (settings?.redirect_url) {
        window.location.href = settings.redirect_url;
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#f8fafc" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-300 border-t-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#f8fafc" }}>
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: settings.background_color }}
    >
      <div className="flex flex-col items-center gap-8 text-center max-w-md w-full">
        {settings.logo_url && (
          <img
            src={settings.logo_url}
            alt="Logo"
            className="max-h-24 w-auto object-contain"
            loading="lazy"
          />
        )}

        <button
          onClick={handleClick}
          disabled={clicking}
          className="rounded-lg px-8 py-4 text-lg font-semibold shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-70"
          style={{
            backgroundColor: settings.button_color,
            color: settings.button_font_color,
          }}
        >
          {clicking ? "Redirecionando..." : settings.button_text}
        </button>
      </div>
    </div>
  );
}
