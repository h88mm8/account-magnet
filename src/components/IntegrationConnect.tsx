import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { IntegrationStatus } from "@/hooks/useIntegrations";

interface IntegrationConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBgClass: string;
  buttonClass: string;
  status: IntegrationStatus;
  connecting: boolean;
  onConnect: () => Promise<string | null>;
}

export function IntegrationConnectModal({
  open,
  onOpenChange,
  provider,
  title,
  description,
  icon,
  iconBgClass,
  buttonClass,
  status,
  connecting,
  onConnect,
}: IntegrationConnectModalProps) {
  const { toast } = useToast();
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (authUrl && status === "pending") {
      setExpired(false);
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      expiryTimer.current = setTimeout(() => setExpired(true), 10 * 60 * 1000);
    }
    return () => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, [authUrl, status]);

  useEffect(() => {
    if (status === "connected") {
      setExpired(false);
      setAuthUrl(null);
    }
  }, [status]);

  const handleConnect = async () => {
    setExpired(false);
    const url = await onConnect();
    if (url) {
      setAuthUrl(url);
      window.open(url, "_blank", "width=600,height=700");
    } else {
      toast({
        title: "Erro ao conectar",
        description: "Não foi possível iniciar a conexão. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleRetry = async () => {
    setExpired(false);
    setAuthUrl(null);
    const url = await onConnect();
    if (url) {
      setAuthUrl(url);
      window.open(url, "_blank", "width=600,height=700");
    } else {
      toast({
        title: "Erro ao gerar novo link",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    }
  };

  const isConnected = status === "connected";
  const isPending = (status === "pending" || connecting) && !expired;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {isConnected ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm font-medium text-foreground">Conectado com sucesso!</p>
              <p className="text-xs text-muted-foreground text-center">
                Sua conta está pronta para uso em campanhas.
              </p>
            </div>
          ) : expired ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <RefreshCw className="h-8 w-8 text-red-600" />
              </div>
              <p className="text-sm font-medium text-foreground">Link expirado</p>
              <p className="text-xs text-muted-foreground text-center">
                O tempo para conectar expirou. Gere um novo link.
              </p>
              <Button onClick={handleRetry} disabled={connecting} className={`gap-2 ${buttonClass}`}>
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Gerar novo link
              </Button>
            </div>
          ) : isPending ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
              </div>
              <p className="text-sm font-medium text-foreground">Aguardando conexão...</p>
              <p className="text-xs text-muted-foreground text-center">
                Complete a autenticação na janela que foi aberta.
              </p>
              <div className="flex gap-2">
                {authUrl && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                    onClick={() => window.open(authUrl, "_blank", "width=600,height=700")}>
                    <ExternalLink className="h-3 w-3" />
                    Reabrir janela
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                  onClick={handleRetry} disabled={connecting}>
                  <RefreshCw className="h-3 w-3" />
                  Novo link
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className={`flex h-16 w-16 items-center justify-center rounded-full ${iconBgClass}`}>
                {icon}
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Ao conectar, uma janela será aberta para autenticar sua conta.
              </p>
              <Button onClick={handleConnect} disabled={connecting} className={`gap-2 ${buttonClass}`}>
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
                Conectar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
