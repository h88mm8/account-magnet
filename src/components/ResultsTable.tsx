import { useState } from "react";
import { Building2, MapPin, Users, BookmarkPlus, Bookmark, Factory, MoreHorizontal } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SaveToListModal } from "@/components/SaveToListModal";
import { AccountDrawer } from "@/components/AccountDrawer";
import { useProspectLists } from "@/hooks/useProspectLists";
import { useAuth } from "@/contexts/AuthContext";
import type { AccountResult } from "@/lib/api/unipile";

const FALLBACK = "Não informado";

type Props = {
  results: AccountResult[];
  isLoading: boolean;
};

export function ResultsTable({ results, isLoading }: Props) {
  const { user } = useAuth();
  const { lists, addItemsToList, createList, isItemSaved } = useProspectLists();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [singleSaveIndex, setSingleSaveIndex] = useState<number | null>(null);
  const [drawerAccount, setDrawerAccount] = useState<AccountResult | null>(null);
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
    return indices.map((i) => ({
      item_type: "account" as const,
      name: results[i].name || "Empresa desconhecida",
      industry: results[i].industry,
      location: results[i].location,
      headcount: results[i].employeeCount,
      linkedin_url: results[i].linkedinUrl,
    }));
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
        <Building2 className="h-10 w-10 text-muted-foreground/30" />
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
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Setor</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Localização</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Funcionários</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((item, index) => {
                const saved = isItemSaved("account", item.linkedinUrl, item.name);
                const displayName = item.name || "Empresa desconhecida";
                return (
                  <TableRow
                    key={index}
                    className="group border-b border-border transition-colors hover:bg-accent/50 cursor-pointer"
                    onClick={() => { setDrawerAccount(item); setDrawerOpen(true); }}
                  >
                    <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(index)} onCheckedChange={() => toggleSelect(index)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground">{displayName}</span>
                          {saved && <Bookmark className="h-3.5 w-3.5 fill-primary text-primary" />}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Factory className="h-3 w-3 shrink-0" />
                        {item.industry || FALLBACK}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {item.location || FALLBACK}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="h-3 w-3 shrink-0" />
                        {item.employeeCount || FALLBACK}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100">
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
                            <DropdownMenuItem onClick={() => { setDrawerAccount(item); setDrawerOpen(true); }}>
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

      {/* Account Drawer */}
      <AccountDrawer
        account={drawerAccount}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        saved={drawerAccount ? isItemSaved("account", drawerAccount.linkedinUrl, drawerAccount.name) : false}
        onSave={() => {
          const idx = drawerAccount ? results.indexOf(drawerAccount) : -1;
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
