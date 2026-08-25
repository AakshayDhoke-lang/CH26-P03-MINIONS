import type { WorkflowIR } from "./workflow-ir";
import { buildRequirementContract } from "./requirement-contract";

export interface RequirementPlanAction {
  id: string;
  intent: string;
  label: string;
  required: boolean;
}
export interface RequirementPlanOrder { before: string; after: string; source: string; }
export interface RequirementPlanDecision {
  id: string;
  expression: string;
  outcomes: string[];
  source: string;
}
export interface RequirementPlanParallelGroup {
  id: string;
  actions: string[];
  requiresJoin: boolean;
  source: string;
}
export interface RequirementPlan {
  actions: RequirementPlanAction[];
  ordering: RequirementPlanOrder[];
  decisions: RequirementPlanDecision[];
  parallelGroups: RequirementPlanParallelGroup[];
}

const STOP = new Set(["the","a","an","to","it","of","on","in","for","and","then","if","is","are","was","were","be","when","otherwise","else","their","them","this","that"]);
const words=(s:string)=>String(s||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(x=>x.length>2&&!STOP.has(x));
const clean=(s:string)=>String(s||"").replace(/\s+/g," ").replace(/^[,;:.\s]+|[,;:.\s]+$/g,"").trim();
const title=(s:string)=>clean(s).replace(/\b\w/g,m=>m.toUpperCase());

function similarity(a:string,b:string){
  const aa=words(a),bb=words(b); if(!aa.length||!bb.length)return 0;
  const overlap=aa.filter(x=>bb.includes(x)).length;
  const recall=overlap/aa.length, precision=overlap/bb.length;
  return recall*0.75+precision*0.25;
}

/** Build a compact deterministic requirement plan from the user text.
 * The LLM is asked to return the same structure, but this keeps verification
 * grounded even when a small local model omits plan metadata.
 */
export function buildRequirementPlan(prompt:string):RequirementPlan{
  const contract=buildRequirementContract(prompt);
  const actions=contract.requiredActions.map((intent,index)=>({id:`A${index+1}`,intent:clean(intent),label:title(intent),required:true}));
  const findId=(phrase:string)=>{
    const scored=actions.map(a=>({a,score:similarity(phrase,a.intent)})).sort((x,y)=>y.score-x.score);
    return scored[0]?.score>=0.42?scored[0].a.id:undefined;
  };
  const ordering=contract.mustFollow.map(o=>({before:findId(o.before)||o.before,after:findId(o.after)||o.after,source:o.source}));
  const decisions=[...new Set(contract.branches.filter(b=>["TRUE","FALSE"].includes(b.branch)).map(b=>b.anchor))].map((expr,index)=>({id:`D${index+1}`,expression:expr,outcomes:["TRUE","FALSE"],source:contract.branches.find(b=>b.anchor===expr)?.source||expr}));
  const parallelGroups:RequirementPlanParallelGroup[]=[];
  if(contract.explicitParallel){
    const ids=actions.map(a=>a.id);
    if(ids.length>1)parallelGroups.push({id:"P1",actions:ids,requiresJoin:/\b(after (?:both|all)|once (?:both|all)|when (?:both|all)|wait for (?:both|all))\b/i.test(prompt),source:prompt});
  }
  return {actions,ordering,decisions,parallelGroups};
}

/** Attach stable requirement identities to graph nodes when the model did not.
 * Exact model-provided mappings win; deterministic semantic matching is only a fallback.
 */
export function attachRequirementMappings(prompt:string,ir:WorkflowIR):WorkflowIR{
  const plan=ir.requirementPlan?.actions?.length?ir.requirementPlan:buildRequirementPlan(prompt);
  const used=new Set<string>();
  const nodes=ir.nodes.map(n=>{
    if(n.requirementActionId){used.add(n.requirementActionId);return n;}
    if(["trigger","condition","approval","join","end"].includes(n.type))return n;
    const scored=plan.actions.filter(a=>!used.has(a.id)).map(a=>({a,score:similarity(a.intent,`${n.name} ${n.description} ${Object.values(n.config||{}).join(" ")}`)})).sort((x,y)=>y.score-x.score);
    if(scored[0]?.score>=0.42){used.add(scored[0].a.id);return {...n,requirementActionId:scored[0].a.id};}
    return n;
  });
  return {...ir,requirementPlan:plan,nodes};
}

export function requirementPlanProblems(prompt:string,ir:WorkflowIR):string[]{
  const plan=ir.requirementPlan?.actions?.length?ir.requirementPlan:buildRequirementPlan(prompt);
  const byReq=new Map(ir.nodes.filter(n=>n.requirementActionId).map(n=>[n.requirementActionId!,n]));
  const problems:string[]=[];
  for(const action of plan.actions.filter(a=>a.required)) if(!byReq.has(action.id)) problems.push(`Missing required action ${action.id}: ${action.label}`);
  const out=new Map<string,string[]>(); for(const n of ir.nodes)out.set(n.id,[]); for(const e of ir.edges)out.get(e.source)?.push(e.target);
  const path=(a:string,b:string)=>{const seen=new Set<string>(),q=[a];while(q.length){const x=q.shift()!;if(x===b&&x!==a)return true;if(seen.has(x))continue;seen.add(x);for(const y of out.get(x)||[])q.push(y);}return false;};
  for(const o of plan.ordering){
    const before=byReq.get(o.before),after=byReq.get(o.after); if(!before||!after||before.id===after.id)continue;
    if(!path(before.id,after.id))problems.push(`Required order violated: ${before.name} must occur before ${after.name}`);
  }
  return [...new Set(problems)];
}
