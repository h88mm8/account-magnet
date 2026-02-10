import { useState, useEffect } from "react";
import { List, Trash2, Pencil, Search, ChevronRight, Building2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useProspectLists, type ProspectListItem } from "@/hooks/useProspectLists";

export default function Lists() {
  const { lists, loading, deleteList, renameList, getListItems, removeItem } = useProspectLists();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listItems, setListItems] = useState<ProspectListItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (selectedListId) {
      setItemsLoading(true);
      getListItems(selectedListId).then((items) => {
        setListItems(items);
        setItemsLoading(false);
      });
    }
  }, [selectedListId, getListItems]);

  const selectedList = lists.find((l) => l.id === selectedListId);

  const filteredItems = listItems.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.company?.toLowerCase().includes(q)) ||
      (item.industry?.toLowerCase().includes(q)) ||
      (item.location?.toLowerCase().includes(q)) ||
      (item.title?.toLowerCase().includes(q))
    );
  });

  const handleRename = async (listId: string) => {
    if (editName.trim()) {
      await renameList(listId, editName.trim());
    }
    setEditingId(null);
  };

  const handleRemoveItem = async (itemId: string) => {
    await removeItem(itemId);
    setListItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  if (selectedList) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedListId(null); setSearchQuery(""); }}>
            ← Voltar
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{selectedList.name}</h1>
            <p className="text-sm text-muted-foreground">
              {selectedList.item_count ?? 0} itens · Criada em {new Date(selectedList.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar na lista..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {itemsLoading ? (
          <Card className="flex items-center justify-center p-16">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
          </Card>
        ) : filteredItems.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-16">
            <List className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhum item nesta lista.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden border border-border shadow-none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cargo / Setor</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Localização</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} className="group">
                    <TableCell>
                      {item.item_type === "lead" ? (
                        <Badge variant="secondary" className="gap-1 text-xs"><User className="h-3 w-3" />Lead</Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-xs"><Building2 className="h-3 w-3" />Empresa</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.title || item.industry || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.company || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.location || "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Listas de Prospecção</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie suas listas de empresas e contatos salvos.
        </p>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center p-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
        </Card>
      ) : lists.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border border-border p-16 shadow-none">
          <List className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma lista criada ainda.</p>
          <p className="text-xs text-muted-foreground">Salve itens a partir de Discover, Empresas ou Contatos.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {lists.map((list) => (
            <Card
              key={list.id}
              className="flex items-center justify-between border border-border p-4 shadow-none transition-colors hover:bg-accent/30 cursor-pointer"
              onClick={() => setSelectedListId(list.id)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <List className="h-4 w-4 text-primary" />
                </div>
                <div>
                  {editingId === list.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRename(list.id)}
                      onKeyDown={(e) => e.key === "Enter" && handleRename(list.id)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="h-7 text-sm"
                    />
                  ) : (
                    <p className="text-sm font-medium text-foreground">{list.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {list.item_count ?? 0} itens · {new Date(list.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(list.id);
                    setEditName(list.name);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
                      <AlertDialogDescription>
                        A lista "{list.name}" e todos seus itens serão removidos permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteList(list.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
