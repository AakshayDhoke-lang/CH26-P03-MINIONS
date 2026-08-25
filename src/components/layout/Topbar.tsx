import { Link, useRouterState } from "@tanstack/react-router";
import { Play, Save, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { flowActions, useFlowState } from "@/lib/workflow-store";
import { toast } from "sonner";

const pageCopy: Record<string, [string, string]> = {
  "/dashboard": ["Workflow Intelligence", "Compile natural-language policies into deterministic, verifiable workflow graphs."],
  "/compiler": ["Create Verified Workflow", "Describe a process in natural language and compile it into a verified workflow."],
  "/studio": ["Workflow Studio", "Inspect and edit the workflow visually without changing the v5 workflow engine."],
  "/verification": ["Workflow Verification", "Review deterministic checks, diagnostics, and workflow validity."],
  "/executions": ["Workflow Executions", "Run and inspect workflow execution activity."],
  "/library": ["Workflow Library", "Browse saved and reusable workflow definitions."],
};

export function Topbar() {
  const s = useFlowState();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const copy = Object.entries(pageCopy).find(([route]) => pathname.startsWith(route))?.[1] ?? [s.workflowName, "FlowForge AI workspace"];

  return (
    <header className="phase2-topbar flex min-h-[102px] items-center justify-between gap-6 border-b px-7 py-[22px]">
      <div className="min-w-0">
        <h1 className="m-0 text-[22px] font-semibold tracking-normal text-foreground">{copy[0]}</h1>
        <p className="mt-[5px] text-[12px] text-muted-foreground">{copy[1]}</p>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="phase2-search hidden h-[43px] w-[280px] items-center gap-2 rounded-[9px] border bg-white px-3 text-[#7d8a98] xl:flex">
          <Search className="h-[17px] w-[17px]" />
          <input className="w-full border-0 bg-transparent text-[12px] outline-none" placeholder="Search workflows, requests…" />
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.success("Workflow saved", { description: `${s.workflowName} · ${s.version}` })}>
          <Save className="h-4 w-4" /> Save
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/compiler"><Sparkles className="h-4 w-4" /> Create with AI</Link>
        </Button>
        <Button size="sm" asChild onClick={() => flowActions.resetExecution()}>
          <Link to="/executions"><Play className="h-4 w-4" /> Run Workflow</Link>
        </Button>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e8f6f6] text-xs font-extrabold text-[#2b6371]">FF</span>
      </div>
    </header>
  );
}
