import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, CheckCircle2, FileText, Play, ShieldCheck, Workflow } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { DASHBOARD_STATS, RECENT_EXECUTIONS, RECENT_WORKFLOWS } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/dashboard")({ component: Index });

const process = [
  ["User Request", "Natural input"],
  ["Intent & Entities", "Local LLM parse"],
  ["Workflow IR", "Typed graph"],
  ["Verification", "Static analysis"],
  ["Human Review", "Manual edits"],
  ["Execution", "Safe runtime"],
] as const;

function Index() {
  const stats = DASHBOARD_STATS.slice(0, 4);
  const metricIcons = [FileText, ShieldCheck, Workflow, Activity];

  return (
    <AppShell>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, index) => {
          const Icon = metricIcons[index] ?? Activity;
          return (
            <div key={s.label} className="phase2-card flex min-h-[96px] items-center gap-[13px] rounded-[10px] p-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#e3f0f4] text-[#307a8b]"><Icon className="h-5 w-5" /></span>
              <div><span className="block text-[10px] text-muted-foreground">{s.label}</span><strong className="my-[3px] block text-[20px] font-semibold">{s.value}</strong><small className="block text-[10px] text-muted-foreground">FlowForge workspace</small></div>
            </div>
          );
        })}
      </section>

      <section className="mt-[18px] grid gap-[18px] xl:grid-cols-[1.05fr_1.4fr]">
        <div className="phase2-card rounded-[10px] p-4">
          <div className="mb-[13px] flex items-start justify-between gap-3">
            <div><h2 className="m-0 text-[14px] font-semibold">Natural Language Request</h2><p className="mt-1 text-[10px] leading-[1.4] text-muted-foreground">Describe the policy exactly as a business user would.</p></div>
            <Workflow className="h-[19px] w-[19px] text-[#3d8e9b]" />
          </div>
          <div className="rounded-lg border border-[#d7e1e8] bg-[#fbfcfd] p-3 text-[12px] leading-6 text-[#526777]">
            Build reliable workflows from plain-language requirements, then inspect, verify, edit, and execute them using the v5 understanding engine.
          </div>
          <Button className="mt-2.5 w-full" asChild><Link to="/compiler"><Workflow className="h-4 w-4" /> Generate & Verify Workflow</Link></Button>
          <div className="mt-2 flex items-center gap-1.5 text-[9px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> v5 understanding, verification and execution behavior remains unchanged.</div>
        </div>

        <div className="phase2-card min-h-[282px] rounded-[10px] p-4">
          <div className="mb-[13px]"><h2 className="m-0 text-[14px] font-semibold">Workflow Compilation Process</h2><p className="mt-1 text-[10px] leading-[1.4] text-muted-foreground">AI proposes structure; deterministic checks decide validity.</p></div>
          <div className="phase2-process-track relative grid grid-cols-6 gap-1 px-1 pb-5 pt-[38px]">
            {process.map(([name, note], i) => <div key={name} className="relative z-[1] text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-[#d5e4e8] bg-[#e9f2f5] text-[12px] font-extrabold text-[#347b87]">{i + 1}</div><b className="mt-3 block text-[9px]">{name}</b><span className="mt-1 block text-[8px] leading-[1.3] text-muted-foreground">{note}</span></div>)}
          </div>
          <div className="border-t border-dashed border-[#d4e0e4] pt-3 text-center text-[9px] font-semibold text-[#466b72]">Security · Policy Checks · Explainability · Audit Trail</div>
        </div>
      </section>

      <section className="mt-[18px] grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_315px]">
        <div className="phase2-card rounded-[10px] p-4">
          <div className="mb-3 flex items-start justify-between gap-4"><div><h2 className="m-0 text-[14px] font-semibold">Recent Workflows</h2><p className="mt-1 text-[10px] text-muted-foreground">Continue building or inspect verified automations.</p></div><Button variant="outline" size="sm" asChild><Link to="/library">View Library <ArrowRight className="h-3.5 w-3.5" /></Link></Button></div>
          <div className="space-y-2">{RECENT_WORKFLOWS.slice(0, 5).map((w) => <div key={w.id} className="flex items-center gap-4 rounded-lg border border-[#e0e6eb] bg-[#fbfcfd] p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#e3f0f4] text-[#307a8b]"><Workflow className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold">{w.name}</div><div className="truncate text-[10px] text-muted-foreground">{w.description}</div></div><StatusBadge status={w.status} /><div className="hidden text-right text-[9px] text-muted-foreground md:block"><div>{w.nodes} nodes</div><div>{w.successRate}% success</div></div></div>)}</div>
        </div>

        <aside className="phase2-card rounded-[10px] p-4">
          <div className="mb-3"><h2 className="m-0 text-[14px] font-semibold">Compiler Diagnostics</h2><p className="mt-1 text-[10px] text-muted-foreground">Latest execution and verification activity.</p></div>
          <div className="space-y-2.5">{RECENT_EXECUTIONS.slice(0, 5).map((ex) => <div key={ex.id} className="flex items-center gap-3 rounded-lg border border-[#e0e6eb] bg-[#fbfcfd] p-2.5"><span className={`grid h-8 w-8 place-items-center rounded-full ${ex.status === "Completed" ? "bg-[#edf8f4] text-[#33765e]" : ex.status === "Failed" ? "bg-[#fff4f4] text-[#a74747]" : "bg-[#fffbf1] text-[#886c34]"}`}>{ex.status === "Completed" ? <CheckCircle2 className="h-4 w-4" /> : ex.status === "Failed" ? <ShieldCheck className="h-4 w-4" /> : <Play className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold">{ex.workflow}</div><div className="text-[9px] text-muted-foreground">{ex.id} · {ex.startedAt}</div></div><div className="text-[9px] text-muted-foreground">{ex.duration}</div></div>)}</div>
        </aside>
      </section>
    </AppShell>
  );
}
