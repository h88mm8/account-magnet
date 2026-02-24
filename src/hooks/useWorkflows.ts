import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  trigger_type: string;
  trigger_list_id: string | null;
  status: string;
  schedule_days: string[];
  schedule_start_time: string;
  schedule_end_time: string;
  schedule_timezone: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowNode {
  id: string;
  workflow_id: string;
  type: string;
  config: Record<string, any>;
  next_node_id: string | null;
  true_node_id: string | null;
  false_node_id: string | null;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  contact_id: string;
  user_id: string;
  current_node_id: string | null;
  status: string;
  next_run_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

export function useWorkflows() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflows" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Workflow[];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });
}

export function useWorkflowNodes(workflowId: string | null) {
  return useQuery({
    queryKey: ["workflow_nodes", workflowId],
    queryFn: async () => {
      if (!workflowId) return [];
      const { data, error } = await supabase
        .from("workflow_nodes" as any)
        .select("*")
        .eq("workflow_id", workflowId);
      if (error) throw error;
      return (data || []) as unknown as WorkflowNode[];
    },
    enabled: !!workflowId,
  });
}

export function useWorkflowExecutions(workflowId: string | null) {
  return useQuery({
    queryKey: ["workflow_executions", workflowId],
    queryFn: async () => {
      if (!workflowId) return [];
      const { data, error } = await supabase
        .from("workflow_executions" as any)
        .select("*, prospect_list_items(name, email, company)")
        .eq("workflow_id", workflowId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as (WorkflowExecution & { prospect_list_items: any })[];
    },
    enabled: !!workflowId,
    refetchInterval: 10000,
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { name: string; trigger_type: string; trigger_list_id?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("workflows" as any)
        .insert({ ...input, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;

      // Create default start node
      await supabase.from("workflow_nodes" as any).insert({
        workflow_id: (data as any).id,
        type: "start",
        config: {},
        position_x: 250,
        position_y: 50,
      } as any);

      return data as unknown as Workflow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast({ title: "Workflow criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Workflow> & { id: string }) => {
      const { error } = await supabase
        .from("workflows" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workflows" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast({ title: "Workflow removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useSaveWorkflowNodes() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ workflowId, nodes }: { workflowId: string; nodes: Omit<WorkflowNode, "created_at">[] }) => {
      // Delete existing nodes and re-insert
      await supabase.from("workflow_nodes" as any).delete().eq("workflow_id", workflowId);

      // Insert nodes without references first
      const nodesWithoutRefs = nodes.map((n) => ({
        id: n.id,
        workflow_id: workflowId,
        type: n.type,
        config: n.config,
        position_x: n.position_x,
        position_y: n.position_y,
        next_node_id: null,
        true_node_id: null,
        false_node_id: null,
      }));

      const { error: insertErr } = await supabase.from("workflow_nodes" as any).insert(nodesWithoutRefs as any);
      if (insertErr) throw insertErr;

      // Update references
      for (const n of nodes) {
        if (n.next_node_id || n.true_node_id || n.false_node_id) {
          await supabase
            .from("workflow_nodes" as any)
            .update({
              next_node_id: n.next_node_id,
              true_node_id: n.true_node_id,
              false_node_id: n.false_node_id,
            } as any)
            .eq("id", n.id);
        }
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["workflow_nodes", vars.workflowId] });
      toast({ title: "Workflow salvo" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });
}
