import { useState } from "react";
import { User, MapPin, Briefcase, BookmarkPlus, Bookmark } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SaveToListModal } from "@/components/SaveToListModal";
import { useProspectLists } from "@/hooks/useProspectLists";
import { useAuth } from "@/contexts/AuthContext";
import type { LeadResult } from "@/lib/api/unipile";

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
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cargo</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Localização</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((item, index) => {
                const fullName = [item.firstName, item.lastName].filter(Boolean).join(" ") || "Desconhecido";
                const saved = isItemSaved("lead", item.linkedinUrl, fullName);
                return (
                  <TableRow key={index} className="group border-b border-border transition-colors hover:bg-accent/50">
                    <TableCell className="pl-5">
                      <Checkbox checked={selected.has(index)} onCheckedChange={() => toggleSelect(index)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground">{fullName}</span>
                          {saved && <Bookmark className="h-3.5 w-3.5 fill-primary text-primary" />}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.title ? (
                        <Badge variant="secondary" className="font-normal text-xs">{item.title}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.company ? (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Briefcase className="h-3 w-3" />{item.company}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.location ? (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />{item.location}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100"
                          onClick={() => { setSingleSaveIndex(index); setModalOpen(true); }}
                        >
                          <BookmarkPlus className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

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
