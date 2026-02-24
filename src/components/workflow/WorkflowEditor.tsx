import { useState, useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Save, Plus, ArrowLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { nodeTypes } from "./WorkflowNodeTypes";
import { NodeConfigPanel } from "./NodeConfigPanel";
import { useWorkflowNodes, useSaveWorkflowNodes, type WorkflowNode } from "@/hooks/useWorkflows";

interface WorkflowEditorProps {
  workflowId: string;
  workflowName: string;
  onBack: () => void;
}

const NODE_OPTIONS = [
  { type: "send_email", label: "Enviar Email" },
  { type: "send_linkedin", label: "Enviar LinkedIn" },
  { type: "send_whatsapp", label: "Enviar WhatsApp" },
  { type: "wait", label: "Aguardar" },
  { type: "condition", label: "Condição" },
  { type: "action", label: "Ação" },
  { type: "end", label: "Fim" },
];

function dbNodesToFlow(dbNodes: WorkflowNode[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = dbNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: { x: n.position_x, y: n.position_y },
    data: { label: "", config: n.config },
  }));

  const edges: Edge[] = [];
  for (const n of dbNodes) {
    if (n.next_node_id) {
      edges.push({
        id: `${n.id}->${n.next_node_id}`,
        source: n.id,
        target: n.next_node_id,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2 },
      });
    }
    if (n.true_node_id) {
      edges.push({
        id: `${n.id}->true->${n.true_node_id}`,
        source: n.id,
        sourceHandle: "true",
        target: n.true_node_id,
        label: "Sim",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "hsl(152, 69%, 41%)", strokeWidth: 2 },
      });
    }
    if (n.false_node_id) {
      edges.push({
        id: `${n.id}->false->${n.false_node_id}`,
        source: n.id,
        sourceHandle: "false",
        target: n.false_node_id,
        label: "Não",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "hsl(0, 84%, 60%)", strokeWidth: 2 },
      });
    }
  }

  return { nodes, edges };
}

function flowToDbNodes(nodes: Node[], edges: Edge[], workflowId: string): Omit<WorkflowNode, "created_at">[] {
  const edgeMap: Record<string, { next?: string; true_next?: string; false_next?: string }> = {};

  for (const e of edges) {
    if (!edgeMap[e.source]) edgeMap[e.source] = {};
    if (e.sourceHandle === "true") {
      edgeMap[e.source].true_next = e.target;
    } else if (e.sourceHandle === "false") {
      edgeMap[e.source].false_next = e.target;
    } else {
      edgeMap[e.source].next = e.target;
    }
  }

  return nodes.map((n) => ({
    id: n.id,
    workflow_id: workflowId,
    type: n.type || "start",
    config: (n.data as any)?.config || {},
    position_x: Math.round(n.position.x),
    position_y: Math.round(n.position.y),
    next_node_id: edgeMap[n.id]?.next || null,
    true_node_id: edgeMap[n.id]?.true_next || null,
    false_node_id: edgeMap[n.id]?.false_next || null,
  }));
}

export function WorkflowEditor({ workflowId, workflowName, onBack }: WorkflowEditorProps) {
  const { data: dbNodes, isLoading } = useWorkflowNodes(workflowId);
  const saveNodes = useSaveWorkflowNodes();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Load from DB once
  useEffect(() => {
    if (dbNodes && dbNodes.length > 0 && !initialized) {
      const { nodes: flowNodes, edges: flowEdges } = dbNodesToFlow(dbNodes);
      setNodes(flowNodes);
      setEdges(flowEdges);
      setInitialized(true);
    }
  }, [dbNodes, initialized]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: {
              strokeWidth: 2,
              ...(connection.sourceHandle === "true" ? { stroke: "hsl(152, 69%, 41%)" } : {}),
              ...(connection.sourceHandle === "false" ? { stroke: "hsl(0, 84%, 60%)" } : {}),
            },
            ...(connection.sourceHandle === "true" ? { label: "Sim" } : {}),
            ...(connection.sourceHandle === "false" ? { label: "Não" } : {}),
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const addNode = useCallback(
    (type: string) => {
      const id = crypto.randomUUID();
      const maxY = nodes.reduce((max, n) => Math.max(max, n.position.y), 0);
      const newNode: Node = {
        id,
        type,
        position: { x: 250, y: maxY + 120 },
        data: { label: "", config: {} },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, setNodes]
  );

  const handleSave = useCallback(() => {
    const dbNodesOut = flowToDbNodes(nodes, edges, workflowId);
    saveNodes.mutate({ workflowId, nodes: dbNodesOut });
  }, [nodes, edges, workflowId, saveNodes]);

  const selectedNodeData = useMemo(() => nodes.find((n) => n.id === selectedNode), [nodes, selectedNode]);

  const handleNodeConfigUpdate = useCallback(
    (config: Record<string, any>) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode ? { ...n, data: { ...n.data, config } } : n
        )
      );
    },
    [selectedNode, setNodes]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.type !== "start" && node.type !== "end") {
      setSelectedNode(node.id);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
          defaultEdgeOptions={{
            style: { strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed },
          }}
        >
          <Background gap={20} size={1} className="!bg-muted/30" />
          <Controls className="!bg-card !border-border !shadow-sm [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground" />
          <MiniMap className="!bg-card !border-border" nodeStrokeColor="hsl(var(--primary))" />

          <Panel position="top-left" className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <span className="text-sm font-semibold text-foreground">{workflowName}</span>
          </Panel>

          <Panel position="top-right" className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Adicionar Nó
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {NODE_OPTIONS.map((opt) => (
                  <DropdownMenuItem key={opt.type} onClick={() => addNode(opt.type)}>
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" onClick={handleSave} disabled={saveNodes.isPending} className="gap-1.5">
              <Save className="h-4 w-4" />
              {saveNodes.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {selectedNode && selectedNodeData && (
        <NodeConfigPanel
          nodeId={selectedNode}
          nodeType={selectedNodeData.type || "start"}
          config={(selectedNodeData.data as any)?.config || {}}
          onUpdate={handleNodeConfigUpdate}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
