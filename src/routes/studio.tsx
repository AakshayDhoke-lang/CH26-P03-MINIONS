import { createFileRoute, Link } from "@tanstack/react-router";
import { Braces, CheckCircle2, CirclePlus, Play, ShieldCheck, Workflow } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { NodeConfiguration } from "@/components/workflow/NodeConfiguration";
import { buildIR, flowActions, useFlowState } from "@/lib/workflow-store";
import type { NodeKind } from "@/lib/types";

export const Route = createFileRoute("/studio")({ component: StudioPage });
const nodeItems: { kind: NodeKind; label: string }[] = [{kind:'trigger',label:'Trigger'},{kind:'action',label:'Action'},{kind:'condition',label:'Condition'},{kind:'approval',label:'Approval'},{kind:'api',label:'API'},{kind:'webhook',label:'Webhook'},{kind:'database',label:'Database'},{kind:'notification',label:'Notification'},{kind:'delay',label:'Delay'},{kind:'join',label:'Join'}];

function StudioPage(){const s=useFlowState(); const ir=JSON.stringify(buildIR(s),null,2); return <AppShell padded={false}>
  <div className="flex h-[calc(100vh-62px)] min-h-0 flex-col">
    <div className="flex items-center gap-3 border-b bg-card/40 px-5 py-3"><div><div className="text-[10px] font-bold tracking-widest text-primary uppercase">Workflow Studio</div><div className="text-sm font-semibold">{s.workflowName}</div></div><div className="ml-auto flex gap-2"><Button variant="outline" size="sm" asChild><Link to="/verification"><ShieldCheck className="h-4 w-4"/> Verify</Link></Button><Button size="sm" asChild className="bg-primary text-primary-foreground"><Link to="/executions"><Play className="h-4 w-4"/> Run</Link></Button></div></div>
    <Tabs defaultValue="visual" className="flex min-h-0 flex-1 flex-col"><div className="border-b px-5"><TabsList className="bg-transparent"><TabsTrigger value="visual"><Workflow className="h-3.5 w-3.5"/> Visual</TabsTrigger><TabsTrigger value="ir"><Braces className="h-3.5 w-3.5"/> IR</TabsTrigger></TabsList></div>
      <TabsContent value="visual" className="m-0 min-h-0 flex-1"><div className="flex h-full min-h-0"><aside className="w-[190px] shrink-0 border-r bg-card/45 p-3"><div className="mb-3 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Add nodes</div><div className="space-y-1.5">{nodeItems.map(x=><button key={x.kind} onClick={()=>flowActions.addNode(x.kind,x.label)} className="flex w-full items-center gap-2 rounded-lg border bg-surface/45 px-3 py-2 text-left text-xs font-medium transition hover:border-primary/40 hover:bg-primary/5"><CirclePlus className="h-3.5 w-3.5 text-primary"/>{x.label}</button>)}</div><div className="mt-5 rounded-xl border bg-success/5 p-3 text-[10px] leading-5 text-muted-foreground"><div className="mb-1 flex items-center gap-1 font-bold text-success"><CheckCircle2 className="h-3 w-3"/> Interactive canvas</div>Drag nodes, create edges, edit configuration and verify the same graph.</div></aside><div className="min-w-0 flex-1"><WorkflowCanvas /></div>{s.selectedNodeId && <NodeConfiguration/>}</div></TabsContent>
      <TabsContent value="ir" className="m-0 flex-1 overflow-auto p-6"><div className="mx-auto max-w-5xl"><div className="mb-3 text-sm font-semibold">Workflow Intermediate Representation</div><pre className="overflow-auto rounded-2xl border bg-background/70 p-5 font-mono text-xs leading-6 text-primary/90">{ir}</pre></div></TabsContent>
    </Tabs>
  </div>
</AppShell>}
