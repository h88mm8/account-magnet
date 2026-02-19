import { useState } from "react";
import { MousePointerClick, ExternalLink, Building2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type EngagedLead = {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  linkedin_url: string | null;
  link_clicks_count: number;
  last_click_at: string | null;
};

async function fetchEngagedLeads(): Promise<EngagedLead[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get leads with clicks
  const { data: leads } = await supabase
    .from("prospect_list_items")
    .select("id, name, company, title, linkedin_url, link_clicks_count")
    .eq("user_id", user.id)
    .gt("link_clicks_count", 0)
    .order("link_clicks_count", { ascending: false })
    .limit(50);

  if (!leads || leads.length === 0) return [];

  // Get last click date for each lead
  const leadIds = leads.map((l) => l.id);
  const { data: clicks } = await supabase
    .from("link_clicks")
    .select("lead_id, clicked_at")
    .in("lead_id", leadIds)
    .eq("is_unique", true)
    .order("clicked_at", { ascending: false });

  const lastClickMap: Record<string, string> = {};
  if (clicks) {
    for (const c of clicks) {
      if (!lastClickMap[c.lead_id]) {
        lastClickMap[c.lead_id] = c.clicked_at;
      }
    }
  }

  return leads.map((l) => ({
    id: l.id,
    name: l.name,
    company: l.company,
    title: l.title,
    linkedin_url: l.linkedin_url,
    link_clicks_count: l.link_clicks_count,
    last_click_at: lastClickMap[l.id] || null,
  }));
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EngagedLeadsModal({ open, onOpenChange }: Props) {
  const { data: leads, isLoading } = useQuery({
    queryKey: ["engaged-leads-detail"],
    queryFn: fetchEngagedLeads,
    enabled: open,
  });

  const getInitials = (name: string) =>
    name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MousePointerClick className="h-5 w-5 text-primary" />
            Leads engajados
            {leads && leads.length > 0 && (
              <Badge variant="secondary" className="ml-1">{leads.length}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : !leads || leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MousePointerClick className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">Nenhum lead engajado ainda</p>
              <p className="text-xs text-muted-foreground mt-1">
                Envie mensagens com links via WhatsApp, LinkedIn ou Email para ver dados aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {leads.map((lead, i) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent/30 transition-colors"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {getInitials(lead.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                      {lead.linkedin_url && (
                        <a
                          href={lead.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-primary shrink-0"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {lead.title && <span className="truncate">{lead.title}</span>}
                      {lead.company && (
                        <>
                          {lead.title && <span>·</span>}
                          <span className="flex items-center gap-1 truncate">
                            <Building2 className="h-3 w-3 shrink-0" />
                            {lead.company}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 text-sm font-bold text-primary justify-end">
                      <MousePointerClick className="h-3.5 w-3.5" />
                      {lead.link_clicks_count}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDate(lead.last_click_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
