import { User, Building2, MapPin, Briefcase, Users, BookmarkPlus, Bookmark, Factory } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type LeadMiniCardData = {
  type: "lead" | "account";
  name: string;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  industry?: string | null;
  headcount?: string | null;
  linkedinUrl?: string | null;
};

type Props = {
  data: LeadMiniCardData;
  saved?: boolean;
  onSave?: () => void;
  showSaveButton?: boolean;
  children: React.ReactNode;
};

const FALLBACK = "Não informado";

export function LeadMiniCard({ data, saved, onSave, showSaveButton = true, children }: Props) {
  const isLead = data.type === "lead";

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-72 p-0" side="right" align="start">
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              {isLead ? (
                <User className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Building2 className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-foreground truncate">{data.name}</p>
                {saved && <Bookmark className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />}
              </div>
              {isLead && (
                <p className="text-xs text-muted-foreground truncate">
                  {data.title || FALLBACK}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-2">
            {isLead && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Briefcase className="h-3 w-3 shrink-0" />
                <span className="truncate">{data.company || FALLBACK}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{data.location || FALLBACK}</span>
            </div>
            {(data.industry || !isLead) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Factory className="h-3 w-3 shrink-0" />
                <span className="truncate">{data.industry || FALLBACK}</span>
              </div>
            )}
            {(data.headcount || !isLead) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3 shrink-0" />
                <span className="truncate">{data.headcount || FALLBACK}</span>
              </div>
            )}
          </div>

          {/* Save button */}
          {showSaveButton && onSave && (
            <>
              <Separator />
              <Button
                variant={saved ? "secondary" : "default"}
                size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={(e) => { e.stopPropagation(); onSave(); }}
                disabled={saved}
              >
                {saved ? (
                  <><Bookmark className="h-3.5 w-3.5 fill-current" /> Já salvo em lista</>
                ) : (
                  <><BookmarkPlus className="h-3.5 w-3.5" /> Salvar em lista</>
                )}
              </Button>
            </>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
