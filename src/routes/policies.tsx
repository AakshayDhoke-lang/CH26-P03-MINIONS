import { createFileRoute } from "@tanstack/react-router";
import { FileCode2, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageIntro } from "@/components/common/PageIntro";
import { Button } from "@/components/ui/button";
import { POLICIES } from "@/lib/mock-data";
export const Route=createFileRoute('/policies')({component:PoliciesPage});
function PoliciesPage(){return <AppShell><PageIntro eyebrow="Policy Engine" title="Define what a valid workflow is allowed to do." description="Authorization and business rules are referenced during static verification before a workflow can be marked safe." actions={<Button><Plus className="h-4 w-4"/> New Policy</Button>}/><div className="grid gap-4 xl:grid-cols-3">{POLICIES.map(p=><div key={p.id} className="rounded-2xl border bg-card/70 p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-ai/10 text-ai"><FileCode2 className="h-4 w-4"/></span><h2 className="mt-4 text-lg font-semibold">{p.name}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{p.description}</p><div className="mt-4 space-y-2">{p.rules.map((r,i)=><div key={i} className="flex items-center justify-between rounded-xl border bg-surface/40 px-3 py-2.5 text-xs"><span className="text-muted-foreground">{r.range}</span><span className="font-semibold text-primary">{r.role}</span></div>)}</div></div>)}</div></AppShell>}
