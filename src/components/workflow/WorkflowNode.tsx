import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { NODE_META, STATUS_META } from "./nodeMeta";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "@/lib/types";

export function WorkflowNodeCard({ data, selected }: NodeProps & { data: WorkflowNodeData }) {
  const meta = NODE_META[data.kind];
  const status = STATUS_META[data.status ?? "idle"];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "relative w-[236px] rounded-2xl border bg-card/90 p-3 backdrop-blur transition-all",
        "shadow-[0_10px_40px_-24px_rgba(0,0,0,0.9)]",
        selected && "ring-2 ring-primary/60",
        data.status === "running" && "border-primary/60 pulse-ring",
        data.status === "completed" && "border-success/50",
        data.status === "paused" && "border-warning/60",
        data.status === "failed" && "border-danger/60",
        data.issue && "border-danger/70 shadow-[0_0_0_1px_var(--danger)]",
        data.scanning && "border-ai/70 shadow-[0_0_26px_-6px_var(--ai)]",
      )}
    >
      {data.kind !== "trigger" && (
        <Handle type="target" position={Position.Top} className="!h-2.5 !w-2.5 !border-0 !bg-primary" />
      )}

      <div className="flex items-start gap-2.5">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl border", meta.tint, meta.color)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            {meta.label}
          </div>
          <div className="truncate text-[13.5px] font-semibold">{data.name}</div>
          {data.subtitle && (
            <div className="truncate text-[11px] text-muted-foreground">{data.subtitle}</div>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
            status.cls,
          )}
        >
          {data.status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
          {status.label}
        </span>
        {data.issue && (
          <span className="inline-flex items-center gap-1 rounded-md bg-danger/15 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
            <AlertTriangle className="h-3 w-3" /> {data.issue}
          </span>
        )}
      </div>

      {data.kind === "condition" ? (
        <>
          <Handle id="true" type="source" position={Position.Bottom} style={{ left: "28%" }} className="!h-2.5 !w-2.5 !border-0 !bg-success" />
          <Handle id="false" type="source" position={Position.Bottom} style={{ left: "72%" }} className="!h-2.5 !w-2.5 !border-0 !bg-warning" />
          <span className="pointer-events-none absolute -bottom-4 left-[16%] text-[9px] font-bold text-success">TRUE</span>
          <span className="pointer-events-none absolute -bottom-4 left-[62%] text-[9px] font-bold text-warning">FALSE</span>
        </>
      ) : data.kind === "approval" ? (
        <>
          <Handle id="approved" type="source" position={Position.Bottom} style={{ left: "28%" }} className="!h-2.5 !w-2.5 !border-0 !bg-success" />
          <Handle id="rejected" type="source" position={Position.Bottom} style={{ left: "72%" }} className="!h-2.5 !w-2.5 !border-0 !bg-danger" />
          <span className="pointer-events-none absolute -bottom-4 left-[10%] text-[9px] font-bold text-success">APPROVED</span>
          <span className="pointer-events-none absolute -bottom-4 left-[60%] text-[9px] font-bold text-danger">REJECTED</span>
        </>
      ) : (
        data.kind !== "end" && <Handle type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !border-0 !bg-primary" />
      )}
    </div>
  );
}
