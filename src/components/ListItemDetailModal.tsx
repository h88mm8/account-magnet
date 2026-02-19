import { Mail, Phone, MapPin, Briefcase, Building2, Users, Factory, ExternalLink, MousePointerClick } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ProspectListItem } from "@/hooks/useProspectLists";

const FALLBACK = "Não informado";

type Props = {
  item: ProspectListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ListItemDetailModal({ item, open, onOpenChange }: Props) {
  if (!item) return null;

  const isLead = item.item_type === "lead";
  const initials = item.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{item.name}</SheetTitle>
        </SheetHeader>

        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-base">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground leading-tight truncate">{item.name}</h2>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {isLead ? "Lead" : "Empresa"}
                </Badge>
              </div>
              {isLead && item.title && (
                <p className="text-sm text-muted-foreground truncate">{item.title}</p>
              )}
              {item.company && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.company}</span>
                </div>
              )}
              {item.location && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.location}</span>
                </div>
              )}
            </div>
          </div>

          {item.link_clicks_count > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <MousePointerClick className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground">
                {item.link_clicks_count} clique{item.link_clicks_count !== 1 ? "s" : ""} em links rastreados
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* Professional / Company info */}
        <div className="p-6 space-y-5">
          {isLead ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Informações profissionais
              </h3>
              <div className="space-y-3">
                {item.title && (
                  <div className="flex items-start gap-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      {item.company && <p className="text-xs text-muted-foreground">{item.company}</p>}
                    </div>
                  </div>
                )}
                {item.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground">{item.location}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Informações da empresa
              </h3>
              <div className="space-y-3">
                {item.industry && (
                  <div className="flex items-start gap-3">
                    <Factory className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Setor</p>
                      <p className="text-sm font-medium text-foreground">{item.industry}</p>
                    </div>
                  </div>
                )}
                {item.headcount && (
                  <div className="flex items-start gap-3">
                    <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Funcionários</p>
                      <p className="text-sm font-medium text-foreground">{item.headcount}</p>
                    </div>
                  </div>
                )}
                {item.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground">{item.location}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(item.email || item.phone) && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Contato
                </h3>
                <div className="space-y-3">
                  {item.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <a
                        href={`mailto:${item.email}`}
                        className="text-sm font-medium text-foreground hover:text-primary"
                      >
                        {item.email}
                      </a>
                    </div>
                  )}
                  {item.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <a
                        href={`tel:${item.phone}`}
                        className="text-sm font-medium text-foreground hover:text-primary"
                      >
                        {item.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {item.linkedin_url && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Links
                </h3>
                <a
                  href={item.linkedin_url}
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
