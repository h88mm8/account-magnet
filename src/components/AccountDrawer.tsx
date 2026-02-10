import { Building2, MapPin, Users, Factory, DollarSign, BookmarkPlus, Bookmark, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { AccountResult } from "@/lib/api/unipile";

const FALLBACK = "Não informado";

type Props = {
  account: AccountResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: boolean;
  onSave: () => void;
  showSaveButton?: boolean;
};

export function AccountDrawer({ account, open, onOpenChange, saved, onSave, showSaveButton = true }: Props) {
  if (!account) return null;

  const displayName = account.name || "Empresa desconhecida";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{displayName}</SheetTitle>
        </SheetHeader>

        {/* Top section – icon + identity */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-lg font-bold text-foreground leading-tight truncate">{displayName}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Factory className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{account.industry || FALLBACK}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{account.location || FALLBACK}</span>
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
          </div>
        </div>

        <Separator />

        {/* Details section */}
        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Informações da empresa
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Factory className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Setor</p>
                  <p className="text-sm font-medium text-foreground">{account.industry || FALLBACK}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Localização</p>
                  <p className="text-sm font-medium text-foreground">{account.location || FALLBACK}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Funcionários</p>
                  <p className="text-sm font-medium text-foreground">{account.employeeCount || FALLBACK}</p>
                </div>
              </div>
              {account.revenue && (
                <div className="flex items-start gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Faturamento</p>
                    <p className="text-sm font-medium text-foreground">{account.revenue}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {account.linkedinUrl && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Links
                </h3>
                <a
                  href={account.linkedinUrl}
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
