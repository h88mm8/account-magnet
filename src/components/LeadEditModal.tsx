import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ProspectListItem } from "@/hooks/useProspectLists";

type Props = {
  item: ProspectListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: ProspectListItem) => void;
};

export function LeadEditModal({ item, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [extraEmails, setExtraEmails] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  const [linkedinUrl, setLinkedinUrl] = useState("");

  useEffect(() => {
    if (item && open) {
      setName(item.name || "");
      setCompany(item.company || "");
      setTitle(item.title || "");
      setEmail(item.email || "");
      setPhone(item.phone || "");
      setLinkedinUrl(item.linkedin_url || "");

      const raw = (item as any).raw_data as Record<string, unknown> | null;
      setExtraEmails(Array.isArray(raw?.extra_emails) ? (raw.extra_emails as string[]) : []);
      setExtraPhones(Array.isArray(raw?.extra_phones) ? (raw.extra_phones as string[]) : []);
    }
  }, [item, open]);

  if (!item) return null;

  const addExtraEmail = () => setExtraEmails((prev) => [...prev, ""]);
  const removeExtraEmail = (idx: number) => setExtraEmails((prev) => prev.filter((_, i) => i !== idx));
  const updateExtraEmail = (idx: number, val: string) =>
    setExtraEmails((prev) => prev.map((e, i) => (i === idx ? val : e)));

  const addExtraPhone = () => setExtraPhones((prev) => [...prev, ""]);
  const removeExtraPhone = (idx: number) => setExtraPhones((prev) => prev.filter((_, i) => i !== idx));
  const updateExtraPhone = (idx: number, val: string) =>
    setExtraPhones((prev) => prev.map((p, i) => (i === idx ? val : p)));

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const currentRaw = ((item as any).raw_data as Record<string, unknown>) || {};
      const updatedRaw = {
        ...currentRaw,
        extra_emails: extraEmails.filter((e) => e.trim()),
        extra_phones: extraPhones.filter((p) => p.trim()),
        last_manual_edit: new Date().toISOString(),
        edit_history: [
          ...((currentRaw.edit_history as any[]) || []),
          {
            edited_at: new Date().toISOString(),
            fields_changed: getChangedFields(),
          },
        ],
      };

      const { error } = await supabase
        .from("prospect_list_items")
        .update({
          name: name.trim(),
          company: company.trim() || null,
          title: title.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          raw_data: updatedRaw as any,
        })
        .eq("id", item.id);

      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      } else {
        const updated: ProspectListItem = {
          ...item,
          name: name.trim(),
          company: company.trim() || null,
          title: title.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
        };
        onSaved(updated);
        onOpenChange(false);
        toast({ title: "Contato atualizado com sucesso!" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro inesperado", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getChangedFields = () => {
    const changed: string[] = [];
    if (name.trim() !== (item.name || "")) changed.push("name");
    if (company.trim() !== (item.company || "")) changed.push("company");
    if (title.trim() !== (item.title || "")) changed.push("title");
    if (email.trim() !== (item.email || "")) changed.push("email");
    if (phone.trim() !== (item.phone || "")) changed.push("phone");
    if (linkedinUrl.trim() !== (item.linkedin_url || "")) changed.push("linkedin_url");
    return changed;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar contato</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome *</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-company">Empresa</Label>
              <Input id="edit-company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Cargo</Label>
              <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* Primary email */}
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email principal</Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>

          {/* Extra emails */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Emails adicionais</Label>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={addExtraEmail}>
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </div>
            {extraEmails.map((em, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={em}
                  onChange={(e) => updateExtraEmail(idx, e.target.value)}
                  placeholder="outro@email.com"
                  className="h-8 text-sm"
                />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeExtraEmail(idx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          {/* Primary phone */}
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Telefone principal</Label>
            <Input id="edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 99999-0000" />
          </div>

          {/* Extra phones */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Telefones adicionais</Label>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={addExtraPhone}>
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </div>
            {extraPhones.map((ph, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={ph}
                  onChange={(e) => updateExtraPhone(idx, e.target.value)}
                  placeholder="+55 11 99999-0000"
                  className="h-8 text-sm"
                />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeExtraPhone(idx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="edit-linkedin">LinkedIn</Label>
            <Input id="edit-linkedin" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
