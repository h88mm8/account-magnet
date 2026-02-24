import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Play, Pause, Trash2, Pencil, GitBranch, Loader2,
} from "lucide-react";
import {
  useWorkflows, useCreateWorkflow, useUpdateWorkflow, useDeleteWorkflow,
  useWorkflowExecutions, type Workflow,
} from "@/hooks/useWorkflows";
import { useProspectLists } from "@/hooks/useProspectLists";
import { WorkflowEditor } from "@/components/workflow/WorkflowEditor";

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  paused: { label: "Pausado", variant: "secondary" },
  draft: { label: "Rascunho", variant: "outline" },
};

const triggerLabels: Record<string, string> = {
  added_to_list: "Adicionado à lista",
  manual: "Manual",
  webhook: "Webhook",
};

export default function Workflows() {
  const { data: workflows, isLoading } = useWorkflows();
  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const { lists } = useProspectLists();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [detailWorkflow, setDetailWorkflow] = useState<Workflow | null>(null);

  // Create form
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("manual");
  const [newListId, setNewListId] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const wf = await createWorkflow.mutateAsync({
      name: newName,
      trigger_type: newTrigger,
      trigger_list_id: newTrigger === "added_to_list" ? newListId : undefined,
    });
    setCreateOpen(false);
    setNewName("");
    setNewTrigger("manual");
    setNewListId("");
    if (wf) setEditingWorkflow(wf);
  };

  const toggleStatus = (wf: Workflow) => {
    const next = wf.status === "active" ? "paused" : "active";
    updateWorkflow.mutate({ id: wf.id, status: next });
  };

  // If editing a workflow, show the editor full-screen
  if (editingWorkflow) {
    return (
      <WorkflowEditor
        workflowId={editingWorkflow.id}
        workflowName={editingWorkflow.name}
        onBack={() => setEditingWorkflow(null)}
      />
    );
  }

  // Detail view with executions
  if (detailWorkflow) {
    return <WorkflowDetail workflow={detailWorkflow} onBack={() => setDetailWorkflow(null)} />;
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
          <p className="text-sm text-muted-foreground">Automações baseadas em comportamento</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Workflow
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !workflows?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <GitBranch className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">Nenhum workflow criado</p>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>Criar primeiro workflow</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => {
            const st = statusBadge[wf.status] || statusBadge.draft;
            return (
              <Card key={wf.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailWorkflow(wf)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold truncate">{wf.name}</CardTitle>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">
                    Trigger: {triggerLabels[wf.trigger_type] || wf.trigger_type}
                  </p>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingWorkflow(wf)} title="Editar fluxo">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleStatus(wf)} title={wf.status === "active" ? "Pausar" : "Ativar"}>
                      {wf.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteId(wf.id)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Workflow</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Sequência de prospecção" className="mt-1" />
            </div>
            <div>
              <Label>Trigger</Label>
              <Select value={newTrigger} onValueChange={setNewTrigger}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="added_to_list">Adicionado à lista</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newTrigger === "added_to_list" && (
              <div>
                <Label>Lista</Label>
                <Select value={newListId} onValueChange={setNewListId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(lists || []).map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createWorkflow.isPending || !newName.trim()}>
              {createWorkflow.isPending ? "Criando..." : "Criar e editar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir workflow?</AlertDialogTitle>
            <AlertDialogDescription>Todas as execuções e histórico serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => { if (deleteId) deleteWorkflow.mutate(deleteId); setDeleteId(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ──────────────────────────────────────────────
// Workflow detail / executions view
// ──────────────────────────────────────────────
function WorkflowDetail({ workflow, onBack }: { workflow: Workflow; onBack: () => void }) {
  const { data: executions, isLoading } = useWorkflowExecutions(workflow.id);

  const statusColors: Record<string, string> = {
    running: "text-primary",
    completed: "text-success",
    failed: "text-destructive",
    paused: "text-muted-foreground",
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>← Voltar</Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{workflow.name}</h1>
          <p className="text-xs text-muted-foreground">Execuções do workflow</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {["running", "completed", "failed", "paused"].map((st) => {
          const count = executions?.filter((e) => e.status === st).length || 0;
          return (
            <Card key={st}>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground capitalize">{st === "running" ? "Em execução" : st === "completed" ? "Concluídos" : st === "failed" ? "Falhas" : "Pausados"}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Executions table */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Execuções recentes</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !executions?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma execução ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2">Contato</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Tentativas</th>
                    <th className="text-left py-2">Próximo</th>
                    <th className="text-left py-2">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((exec) => (
                    <tr key={exec.id} className="border-b border-border/50">
                      <td className="py-2">
                        <span className="font-medium text-foreground">
                          {(exec as any).prospect_list_items?.name || "—"}
                        </span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {(exec as any).prospect_list_items?.company || ""}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={statusColors[exec.status] || ""}>
                          {exec.status === "running" ? "Executando" : exec.status === "completed" ? "Concluído" : exec.status === "failed" ? "Falha" : exec.status}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">{exec.retry_count}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {exec.next_run_at ? new Date(exec.next_run_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}
                      </td>
                      <td className="py-2 text-xs text-destructive max-w-[200px] truncate">{exec.error_message || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
