import { User, MapPin, Briefcase, Building2, BookmarkPlus, Bookmark, MessageSquare, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { LeadResult } from "@/lib/api/unipile";

const FALLBACK = "Não informado";

type Props = {
  lead: LeadResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: boolean;
  onSave: () => void;
  showSaveButton?: boolean;
  savedListCount?: number;
};

export function LeadDrawer({ lead, open, onOpenChange, saved, onSave, showSaveButton = true, savedListCount = 0 }: Props) {
  if (!lead) return null;

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Desconhecido";
  const initials = [lead.firstName?.[0], lead.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{fullName}</SheetTitle>
        </SheetHeader>

        {/* Top section – avatar + identity */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 text-lg">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-lg font-bold text-foreground leading-tight truncate">{fullName}</h2>
              <p className="text-sm text-muted-foreground truncate">{lead.title || FALLBACK}</p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{lead.company || FALLBACK}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{lead.location || FALLBACK}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex items-center gap-2">
            {showSaveButton && (
              <Button
                variant={saved ? "secondary" : "default"}
                size="sm"
                className="gap-1.5 flex-1"
                onClick={onSave}
                disabled={saved}
              >
                {saved ? (
                  <><Bookmark className="h-4 w-4 fill-current" /> Salvo</>
                ) : (
                  <><BookmarkPlus className="h-4 w-4" /> Salvar em lista</>
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 flex-1" disabled>
              <MessageSquare className="h-4 w-4" />
              Enviar mensagem
            </Button>
          </div>

          {saved && savedListCount > 0 && (
            <div className="mt-3">
              <Badge variant="secondary" className="text-xs">
                <Bookmark className="h-3 w-3 mr-1 fill-current" />
                {savedListCount === 1 ? "Em 1 lista" : `Em ${savedListCount} listas`}
              </Badge>
            </div>
          )}
        </div>

        <Separator />

        {/* Details section */}
        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Informações profissionais
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{lead.title || FALLBACK}</p>
                  <p className="text-xs text-muted-foreground">{lead.company || FALLBACK}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{lead.location || FALLBACK}</p>
                </div>
              </div>
            </div>
          </div>

          {lead.linkedinUrl && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Links
                </h3>
                <a
                  href={lead.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver perfil no LinkedIn
                </a>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
