import { useState } from "react";
import { MessageCircle, Loader2, CheckCircle2, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import { useToast } from "@/hooks/use-toast";

export function WhatsAppConnectModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { status, connecting, connect } = useWhatsAppConnection();
  const { toast } = useToast();
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  const handleConnect = async () => {
    const url = await connect();
    if (url) {
      setAuthUrl(url);
      window.open(url, "_blank", "width=500,height=700");
    } else {
      toast({
        title: "Erro ao conectar",
        description: "Não foi possível iniciar a conexão. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const isConnected = status === "connected";
  const isPending = status === "pending" || connecting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription>
            Conecte seu WhatsApp para enviar mensagens diretamente aos leads.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {isConnected ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm font-medium text-foreground">WhatsApp conectado!</p>
              <p className="text-xs text-muted-foreground text-center">
                Você já pode enviar mensagens diretamente aos seus leads.
              </p>
            </div>
          ) : isPending ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
              </div>
              <p className="text-sm font-medium text-foreground">Aguardando conexão...</p>
              <p className="text-xs text-muted-foreground text-center">
                Escaneie o QR Code na janela que foi aberta para conectar seu WhatsApp.
              </p>
              {authUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => window.open(authUrl, "_blank", "width=500,height=700")}
                >
                  <ExternalLink className="h-3 w-3" />
                  Reabrir janela de conexão
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <MessageCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Ao conectar, uma janela será aberta para que você escaneie o QR Code com seu WhatsApp.
              </p>
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4" />
                )}
                Conectar WhatsApp
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WhatsAppButton({ phone }: { phone: string | null }) {
  const { status } = useWhatsAppConnection();
  const [showModal, setShowModal] = useState(false);

  if (!phone) return null;

  const handleClick = () => {
    if (status !== "connected") {
      setShowModal(true);
      return;
    }

    // Format phone number (remove non-digits, ensure country code)
    const cleanPhone = phone.replace(/\D/g, "");
    const whatsappUrl = `https://wa.me/${cleanPhone}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
        onClick={handleClick}
      >
        <MessageCircle className="h-3 w-3" />
        WhatsApp
      </Button>
      <WhatsAppConnectModal open={showModal} onOpenChange={setShowModal} />
    </>
  );
}
