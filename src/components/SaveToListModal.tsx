import { useState } from "react";
import { Plus, List } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ProspectList } from "@/hooks/useProspectLists";

type SaveItem = {
  item_type: "account" | "lead";
  name: string;
  title?: string;
  company?: string;
  industry?: string;
  location?: string;
  linkedin_url?: string;
  headcount?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SaveItem[];
  lists: ProspectList[];
  onSave: (listId: string, items: SaveItem[]) => Promise<void>;
  onCreateList: (name: string, listType: string) => Promise<{ id: string } | null>;
};

export function SaveToListModal({ open, onOpenChange, items, lists, onSave, onCreateList }: Props) {
  const [mode, setMode] = useState<"select" | "create">("select");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [newListName, setNewListName] = useState("");
  const [saving, setSaving] = useState(false);

  const itemType = items[0]?.item_type; // "lead" | "account"
  const listType = itemType === "lead" ? "lead" : itemType === "account" ? "account" : "mixed";

  // Filter lists to only show compatible ones
  const compatibleLists = lists.filter((l) => l.list_type === listType || l.list_type === "mixed");

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === "create" && newListName.trim()) {
        const list = await onCreateList(newListName.trim(), listType);
        if (list) {
          await onSave(list.id, items);
        }
      } else if (mode === "select" && selectedListId) {
        await onSave(selectedListId, items);
      }
      onOpenChange(false);
      setNewListName("");
      setSelectedListId("");
      setMode("select");
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    (mode === "create" && newListName.trim().length > 0) ||
    (mode === "select" && selectedListId.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <List className="h-5 w-5 text-primary" />
            Salvar {items.length} item(s) em lista
          </DialogTitle>
          <DialogDescription>
            Selecione uma lista existente ou crie uma nova.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            <Button
              variant={mode === "select" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("select")}
            >
              Lista existente
            </Button>
            <Button
              variant={mode === "create" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("create")}
              className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova lista
            </Button>
          </div>

          {mode === "create" ? (
            <div className="space-y-2">
              <Label>Nome da lista</Label>
              <Input
                placeholder="Ex: Leads Q1 2026"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-2">
              {compatibleLists.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma lista compatível ({listType === "lead" ? "de leads" : "de empresas"}). Crie uma nova.
                </p>
              ) : (
                <RadioGroup value={selectedListId} onValueChange={setSelectedListId}>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {compatibleLists.map((list) => (
                      <label
                        key={list.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50 has-[input:checked]:border-primary has-[input:checked]:bg-primary/5"
                      >
                        <RadioGroupItem value={list.id} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{list.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {list.item_count ?? 0} itens
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
