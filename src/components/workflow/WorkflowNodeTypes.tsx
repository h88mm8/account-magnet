import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Play, Mail, Linkedin, MessageCircle, Clock,
  GitBranch, Zap, StopCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nodeStyles: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  start: { icon: Play, label: "Início", color: "text-success", bg: "bg-success/10 border-success/30" },
  send_email: { icon: Mail, label: "Enviar Email", color: "text-primary", bg: "bg-primary/10 border-primary/30" },
  send_linkedin: { icon: Linkedin, label: "Enviar LinkedIn", color: "text-blue-600", bg: "bg-blue-600/10 border-blue-600/30" },
  send_whatsapp: { icon: MessageCircle, label: "Enviar WhatsApp", color: "text-green-600", bg: "bg-green-600/10 border-green-600/30" },
  wait: { icon: Clock, label: "Aguardar", color: "text-warning", bg: "bg-warning/10 border-warning/30" },
  condition: { icon: GitBranch, label: "Condição", color: "text-purple-600", bg: "bg-purple-600/10 border-purple-600/30" },
  action: { icon: Zap, label: "Ação", color: "text-orange-600", bg: "bg-orange-600/10 border-orange-600/30" },
  end: { icon: StopCircle, label: "Fim", color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
};

function getConfigSummary(type: string, config: Record<string, any>): string {
  switch (type) {
    case "send_email":
      return config.subject ? `Assunto: ${config.subject}` : "Configure o email";
    case "send_linkedin":
      return config.linkedin_type === "invite" ? "Convite de conexão" : "Mensagem";
    case "send_whatsapp":
      return config.message ? config.message.slice(0, 40) + "..." : "Configure a mensagem";
    case "wait":
      const parts: string[] = [];
      if (config.days) parts.push(`${config.days}d`);
      if (config.hours) parts.push(`${config.hours}h`);
      return parts.length ? `Aguardar ${parts.join(" ")}` : "Configure o tempo";
    case "condition": {
      const ch = config.channel || "email";
      const evt = config.event_type || "replied";
      if (ch === "site") {
        if (evt === "page_visit" && config.url_contains) return `Web: visitou ${config.url_contains}`;
        if (evt === "scroll_depth") return `Web: scroll ≥ ${config.min_scroll || 50}%`;
        if (evt === "cta_click") return `Web: CTA ${config.cta_id || "?"}`;
        return `Web: ${evt}`;
      }
      return `${ch} → ${evt}?`;
    }
    case "action":
      return config.action === "add_to_list" ? "Adicionar à lista" : config.action === "remove_from_list" ? "Remover da lista" : "Configure a ação";
    default:
      return "";
  }
}

function BaseNode({ data, type }: NodeProps & { type: string }) {
  const style = nodeStyles[type] || nodeStyles.start;
  const Icon = style.icon;
  const config = (data as any).config || {};
  const summary = getConfigSummary(type, config);
  const isCondition = type === "condition";

  return (
    <div
      className={cn(
        "rounded-xl border-2 px-4 py-3 min-w-[180px] max-w-[220px] shadow-sm cursor-pointer transition-shadow hover:shadow-md",
        style.bg,
        "bg-card"
      )}
    >
      {type !== "start" && (
        <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-muted-foreground/40 !border-2 !border-card" />
      )}

      <div className="flex items-center gap-2 mb-1">
        <div className={cn("rounded-lg p-1.5", style.bg)}>
          <Icon className={cn("h-4 w-4", style.color)} />
        </div>
        <span className="text-sm font-semibold text-foreground">{(data as any).label || style.label}</span>
      </div>

      {summary && (
        <p className="text-xs text-muted-foreground truncate">{summary}</p>
      )}

      {isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!w-3 !h-3 !bg-success !border-2 !border-card !left-[30%]"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!w-3 !h-3 !bg-destructive !border-2 !border-card !left-[70%]"
          />
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground px-1">
            <span className="text-success font-medium">Sim</span>
            <span className="text-destructive font-medium">Não</span>
          </div>
        </>
      ) : type !== "end" ? (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-muted-foreground/40 !border-2 !border-card" />
      ) : null}
    </div>
  );
}

export const StartNode = memo((props: NodeProps) => <BaseNode {...props} type="start" />);
export const SendEmailNode = memo((props: NodeProps) => <BaseNode {...props} type="send_email" />);
export const SendLinkedInNode = memo((props: NodeProps) => <BaseNode {...props} type="send_linkedin" />);
export const SendWhatsAppNode = memo((props: NodeProps) => <BaseNode {...props} type="send_whatsapp" />);
export const WaitNode = memo((props: NodeProps) => <BaseNode {...props} type="wait" />);
export const ConditionNode = memo((props: NodeProps) => <BaseNode {...props} type="condition" />);
export const ActionNode = memo((props: NodeProps) => <BaseNode {...props} type="action" />);
export const EndNode = memo((props: NodeProps) => <BaseNode {...props} type="end" />);

export const nodeTypes = {
  start: StartNode,
  send_email: SendEmailNode,
  send_linkedin: SendLinkedInNode,
  send_whatsapp: SendWhatsAppNode,
  wait: WaitNode,
  condition: ConditionNode,
  action: ActionNode,
  end: EndNode,
};
