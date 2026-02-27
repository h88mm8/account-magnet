import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Send, AlertTriangle, CheckCircle, Link2, Users, Mail, Linkedin, MessageSquare } from "lucide-react";
import { detectUrlInContent, CHANNEL_LABELS } from "@/lib/campaign-utils";

interface SendConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  campaignName: string;
  channel: string;
  totalContacts: number;
  messageContent: string;
  hasAutoCta: boolean;
  senderEmail?: string;
  subject?: string;
}

const CHANNEL_ICONS: Record<string, any> = {
  email: Mail,
  linkedin: Linkedin,
  whatsapp: MessageSquare,
};

export function SendConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  campaignName,
  channel,
  totalContacts,
  messageContent,
  hasAutoCta,
  senderEmail,
  subject,
}: SendConfirmationDialogProps) {
  const hasUrl = detectUrlInContent(messageContent);
  const ChannelIcon = CHANNEL_ICONS[channel] || Mail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-primary" />
            Confirmar envio da campanha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Campaign summary */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Campanha</span>
              <span className="font-medium text-foreground truncate max-w-[200px]">{campaignName}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Canal</span>
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <ChannelIcon className="h-3.5 w-3.5" />
                {CHANNEL_LABELS[channel] || channel}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Destinatários estimados</span>
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {totalContacts.toLocaleString("pt-BR")}
              </span>
            </div>
            {channel === "email" && subject && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Assunto</span>
                  <span className="font-medium text-foreground truncate max-w-[200px]">{subject}</span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Link detectado</span>
              <span className="flex items-center gap-1.5">
                {hasUrl ? (
                  <><Link2 className="h-3.5 w-3.5 text-primary" /><span className="text-foreground font-medium">Sim</span></>
                ) : (
                  <span className="text-muted-foreground">Não</span>
                )}
              </span>
            </div>
            {channel === "email" && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Botão CTA automático</span>
                  <span className="flex items-center gap-1.5">
                    {hasAutoCta ? (
                      <><CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-500" /><span className="text-foreground font-medium">Ativo</span></>
                    ) : (
                      <span className="text-muted-foreground">Desativado</span>
                    )}
                  </span>
                </div>
              </>
            )}
            {senderEmail && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Remetente</span>
                  <span className="font-medium text-foreground truncate max-w-[200px]">{senderEmail}</span>
                </div>
              </>
            )}
          </div>

          {/* Warning */}
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Após confirmar, os envios serão iniciados imediatamente e não poderão ser desfeitos.
              Verifique os dados acima antes de prosseguir.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={isSubmitting} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {isSubmitting ? "Enviando..." : "Confirmar envio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
