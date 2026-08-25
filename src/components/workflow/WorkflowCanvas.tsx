import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { WorkflowNodeCard } from "./WorkflowNode";
import { flowActions, useFlowState, type WFNode } from "@/lib/workflow-store";

const nodeTypes = { workflow: WorkflowNodeCard };

function CanvasInner({
  interactive = true,
  focusNodeId,
}: {
  interactive?: boolean;
  focusNodeId?: string | null;
}) {
  const s = useFlowState();
  const { fitView, setCenter } = useReactFlow();

  useEffect(() => {
    if (!focusNodeId) return;
    const node = s.nodes.find((n) => n.id === focusNodeId);
    if (node) setCenter(node.position.x + 120, node.position.y + 60, { zoom: 1.2, duration: 700 });
  }, [focusNodeId, s.nodes, setCenter]);

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.nodes.length]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => flowActions.setNodes(applyNodeChanges(changes, s.nodes) as WFNode[]),
    [s.nodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => flowActions.setEdges(applyEdgeChanges(changes, s.edges)),
    [s.edges],
  );
  const onConnect = useCallback(
    (c: Connection) => {
      const handle = c.sourceHandle ?? undefined;
      const label = handle === "true" ? "TRUE" : handle === "false" ? "FALSE" : handle === "approved" ? "APPROVED" : handle === "rejected" ? "REJECTED" : undefined;
      flowActions.setEdges(addEdge({ ...c, label, type: "smoothstep" }, s.edges));
    },
    [s.edges],
  );

  const edges: Edge[] = useMemo(
    () =>
      s.edges.map((e) => {
        const running = s.execution.activeEdges.includes(e.id);
        const done = running && !s.execution.running;
        return {
          ...e,
          className: s.verifying ? "scanning" : running ? (done ? "done" : "running") : "",
          labelStyle: { fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: "var(--surface-2)" },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 6,
          style: { stroke: "color-mix(in oklab, var(--foreground) 22%, transparent)" },
        };
      }),
    [s.edges, s.execution.activeEdges, s.execution.running, s.verifying],
  );

  return (
    <ReactFlow
      nodes={s.nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={interactive ? onNodesChange : undefined}
      onEdgesChange={interactive ? onEdgesChange : undefined}
      onConnect={interactive ? onConnect : undefined}
      onEdgeDoubleClick={interactive ? (_, edge) => flowActions.deleteEdge(edge.id) : undefined}
      deleteKeyCode={interactive ? ["Backspace", "Delete"] : null}
      edgesFocusable={interactive}
      edgesReconnectable={interactive}
      elementsSelectable={interactive}
      onNodeClick={(_, node) => interactive && flowActions.setSelected(node.id)}
      onPaneClick={() => flowActions.setSelected(null)}
      fitView
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
      className="bg-transparent"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="rgba(255,255,255,0.07)" />
      <Controls className="!rounded-xl !border !border-border !bg-surface-2/90 !shadow-none [&>button]:!border-border [&>button]:!bg-transparent [&>button]:!text-foreground" />
      <MiniMap
        pannable
        zoomable
        className="!rounded-xl !border !border-border !bg-surface/90"
        maskColor="rgba(0,0,0,0.55)"
        nodeColor={() => "var(--primary)"}
      />
    </ReactFlow>
  );
}

export function WorkflowCanvas(props: { interactive?: boolean; focusNodeId?: string | null }) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
