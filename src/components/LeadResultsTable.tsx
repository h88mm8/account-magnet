import { useState } from "react";
import { User, MapPin, Building2, BookmarkPlus, Bookmark, MoreHorizontal } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SaveToListModal } from "@/components/SaveToListModal";
import { LeadDrawer } from "@/components/LeadDrawer";
import { useProspectLists } from "@/hooks/useProspectLists";
import { useAuth } from "@/contexts/AuthContext";
import type { LeadResult } from "@/lib/api/unipile";

const FALLBACK = "Não informado";

type Props = {
  results: LeadResult[];
  isLoading: boolean;
};

export function LeadResultsTable({ results, isLoading }: Props) {
  const { user } = useAuth();
  const { lists, addItemsToList, createList, isItemSaved } = useProspectLists();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [singleSaveIndex, setSingleSaveIndex] = useState<number | null>(null);
  const [drawerLead, setDrawerLead] = useState<LeadResult | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((_, i) => i)));
    }
  };

  const getItemsToSave = () => {
    const indices = singleSaveIndex !== null ? [singleSaveIndex] : Array.from(selected);
    return indices.map((i) => {
      const r = results[i];
      return {
        item_type: "lead" as const,
        name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "Desconhecido",
        title: r.title,
        company: r.company,
        location: r.location,
        linkedin_url: r.linkedinUrl,
      };
    });
  };

  const getFullName = (item: LeadResult) =>
    [item.firstName, item.lastName].filter(Boolean).join(" ") || "Desconhecido";

  const getInitials = (item: LeadResult) =>
    [item.firstName?.[0], item.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  const openDrawer = (lead: LeadResult) => {
    setDrawerLead(lead);
    setDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="flex flex-col items-center justify-center gap-4 border border-border p-16 shadow-none">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Buscando leads...</p>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 border border-border p-16 shadow-none">
        <User className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhum resultado. Ajuste seus filtros e tente novamente.</p>
      </Card>
    );
  }

  const drawerFullName = drawerLead ? getFullName(drawerLead) : "";
  const drawerSaved = drawerLead ? isItemSaved("lead", drawerLead.linkedinUrl, drawerFullName) : false;

  return (
    <>
      <Card className="overflow-hidden border border-border shadow-none">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{results.length}</span> resultados
          </p>
          <div className="flex gap-2">
            {selected.size > 0 && user && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => { setSingleSaveIndex(null); setModalOpen(true); }}
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                Salvar {selected.size} em lista
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="w-10 pl-5">
                  <Checkbox checked={selected.size === results.length && results.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lead</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Localização</TableHead>
                <TableHead className="w-24 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((item, index) => {
                const fullName = getFullName(item);
                const initials = getInitials(item);
                const saved = isItemSaved("lead", item.linkedinUrl, fullName);

                return (
                  <TableRow
                    key={index}
                    className="group border-b border-border transition-colors hover:bg-accent/50 cursor-pointer"
                    onClick={() => openDrawer(item)}
                  >
                    <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(index)} onCheckedChange={() => toggleSelect(index)} />
                    </TableCell>

                    {/* Lead: Avatar + Name + Title */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground truncate">{fullName}</span>
                            {saved && <Bookmark className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{item.title || FALLBACK}</p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Company */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.company || FALLBACK}</span>
                      </div>
                    </TableCell>

                    {/* Location */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.location || FALLBACK}</span>
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {user && (
                          <Button
                            variant={saved ? "ghost" : "outline"}
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => { setSingleSaveIndex(index); setModalOpen(true); }}
                            disabled={saved}
                          >
                            {saved ? (
                              <Bookmark className="h-3.5 w-3.5 fill-primary text-primary" />
                            ) : (
                              <><BookmarkPlus className="h-3.5 w-3.5" /> Salvar</>
                            )}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.linkedinUrl && (
                              <DropdownMenuItem asChild>
                                <a href={item.linkedinUrl} target="_blank" rel="noopener noreferrer">
                                  Ver no LinkedIn
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openDrawer(item)}>
                              Ver detalhes
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Lead Drawer */}
      <LeadDrawer
        lead={drawerLead}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        saved={drawerSaved}
        onSave={() => {
          const idx = drawerLead ? results.indexOf(drawerLead) : -1;
          if (idx >= 0) {
            setSingleSaveIndex(idx);
            setModalOpen(true);
          }
        }}
        showSaveButton={!!user}
      />

      <SaveToListModal
        open={modalOpen}
        onOpenChange={(v) => { setModalOpen(v); if (!v) setSingleSaveIndex(null); }}
        items={getItemsToSave()}
        lists={lists}
        onSave={addItemsToList}
        onCreateList={createList}
      />
    </>
  );
}
