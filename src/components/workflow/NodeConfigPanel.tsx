import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useProspectLists } from "@/hooks/useProspectLists";

interface NodeConfigPanelProps {
  nodeId: string;
  nodeType: string;
  config: Record<string, any>;
  onUpdate: (config: Record<string, any>) => void;
  onClose: () => void;
}

const VARIABLES = [
  { label: "Primeiro Nome", token: "{{FIRST_NAME}}" },
  { label: "Sobrenome", token: "{{LAST_NAME}}" },
  { label: "Nome Completo", token: "{{NAME}}" },
  { label: "Email", token: "{{EMAIL}}" },
  { label: "Empresa", token: "{{COMPANY}}" },
  { label: "Cargo", token: "{{POSITION}}" },
];

export function NodeConfigPanel({ nodeId, nodeType, config, onUpdate, onClose }: NodeConfigPanelProps) {
  const [local, setLocal] = useState<Record<string, any>>(config);
  const { lists } = useProspectLists();

  useEffect(() => { setLocal(config); }, [config, nodeId]);

  const update = (key: string, value: any) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    onUpdate(next);
  };

  const insertVar = (field: string, token: string) => {
    update(field, (local[field] || "") + token);
  };

  return (
    <div className="w-80 border-l border-border bg-card p-4 overflow-y-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">Configurar Nó</h3>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {nodeType === "send_email" && (
        <>
          <div>
            <Label className="text-xs">Assunto</Label>
            <Input value={local.subject || ""} onChange={(e) => update("subject", e.target.value)} placeholder="Assunto do email" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Corpo</Label>
            <Textarea value={local.body || ""} onChange={(e) => update("body", e.target.value)} placeholder="Corpo do email (HTML ou texto)" className="mt-1 min-h-[120px]" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Variáveis</Label>
            <div className="flex flex-wrap gap-1">
              {VARIABLES.map((v) => (
                <Badge key={v.token} variant="secondary" className="cursor-pointer text-xs hover:bg-accent" onClick={() => insertVar("body", v.token)}>
                  {v.label}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {nodeType === "send_linkedin" && (
        <>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={local.linkedin_type || "message"} onValueChange={(v) => update("linkedin_type", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="message">Mensagem</SelectItem>
                <SelectItem value="invite">Convite de Conexão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea value={local.message || ""} onChange={(e) => update("message", e.target.value)} placeholder="Mensagem LinkedIn" className="mt-1 min-h-[100px]" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Variáveis</Label>
            <div className="flex flex-wrap gap-1">
              {VARIABLES.map((v) => (
                <Badge key={v.token} variant="secondary" className="cursor-pointer text-xs hover:bg-accent" onClick={() => insertVar("message", v.token)}>
                  {v.label}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {nodeType === "send_whatsapp" && (
        <>
          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea value={local.message || ""} onChange={(e) => update("message", e.target.value)} placeholder="Mensagem WhatsApp" className="mt-1 min-h-[100px]" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Variáveis</Label>
            <div className="flex flex-wrap gap-1">
              {VARIABLES.map((v) => (
                <Badge key={v.token} variant="secondary" className="cursor-pointer text-xs hover:bg-accent" onClick={() => insertVar("message", v.token)}>
                  {v.label}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {nodeType === "wait" && (
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs">Dias</Label>
            <Input type="number" min={0} value={local.days || 0} onChange={(e) => update("days", parseInt(e.target.value) || 0)} className="mt-1" />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Horas</Label>
            <Input type="number" min={0} max={23} value={local.hours || 0} onChange={(e) => update("hours", parseInt(e.target.value) || 0)} className="mt-1" />
          </div>
        </div>
      )}

      {nodeType === "condition" && (
        <>
          <div>
            <Label className="text-xs">Canal</Label>
            <Select value={local.channel || "email"} onValueChange={(v) => {
              const resetType = v === "site" ? "page_visit" : "replied";
              const next = { ...local, channel: v, event_type: resetType };
              setLocal(next);
              onUpdate(next);
            }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="site">Tracking Web</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {local.channel !== "site" ? (
            <>
              <div>
                <Label className="text-xs">Evento</Label>
                <Select value={local.event_type || "replied"} onValueChange={(v) => update("event_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replied">Respondeu?</SelectItem>
                    <SelectItem value="delivered">Entregue?</SelectItem>
                    <SelectItem value="accepted">Aceitou conexão?</SelectItem>
                    <SelectItem value="sent">Enviado?</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Período de verificação (horas)</Label>
                <Input type="number" min={1} value={local.lookback_hours || 48} onChange={(e) => update("lookback_hours", parseInt(e.target.value) || 48)} className="mt-1" />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label className="text-xs">Condição Web</Label>
                <Select value={local.event_type || "page_visit"} onValueChange={(v) => update("event_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="page_visit">Visitou página</SelectItem>
                    <SelectItem value="scroll_depth">Scroll acima de X%</SelectItem>
                    <SelectItem value="cta_click">Clicou em CTA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {local.event_type === "page_visit" && (
                <>
                  <div>
                    <Label className="text-xs">URL contém</Label>
                    <Input value={local.url_contains || ""} onChange={(e) => update("url_contains", e.target.value)} placeholder="/pricing" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Mínimo de visitas</Label>
                    <Input type="number" min={1} value={local.min_count || 1} onChange={(e) => update("min_count", parseInt(e.target.value) || 1)} className="mt-1" />
                  </div>
                </>
              )}

              {local.event_type === "scroll_depth" && (
                <div>
                  <Label className="text-xs">Scroll mínimo (%)</Label>
                  <Input type="number" min={1} max={100} value={local.min_scroll || 50} onChange={(e) => update("min_scroll", parseInt(e.target.value) || 50)} className="mt-1" />
                </div>
              )}

              {local.event_type === "cta_click" && (
                <div>
                  <Label className="text-xs">ID do CTA</Label>
                  <Input value={local.cta_id || ""} onChange={(e) => update("cta_id", e.target.value)} placeholder="hero-demo" className="mt-1" />
                </div>
              )}

              <div>
                <Label className="text-xs">Período de verificação (horas)</Label>
                <Input type="number" min={1} value={local.lookback_hours || 48} onChange={(e) => update("lookback_hours", parseInt(e.target.value) || 48)} className="mt-1" />
              </div>
            </>
          )}
        </>
      )}

      {nodeType === "action" && (
        <>
          <div>
            <Label className="text-xs">Ação</Label>
            <Select value={local.action || "add_to_list"} onValueChange={(v) => update("action", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="add_to_list">Adicionar à lista</SelectItem>
                <SelectItem value="remove_from_list">Remover da lista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(local.action === "add_to_list" || local.action === "remove_from_list") && (
            <div>
              <Label className="text-xs">Lista</Label>
              <Select value={local.list_id || ""} onValueChange={(v) => update("list_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione uma lista" /></SelectTrigger>
                <SelectContent>
                  {(lists || []).map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}
    </div>
  );
}
