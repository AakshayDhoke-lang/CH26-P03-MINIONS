import type { WorkflowIR } from "./workflow-ir";
import { completeNodeConfig, isCommunicationIntent } from "./node-contracts";

const ALLOWED_TYPES = new Set(["trigger","action","condition","approval","api","webhook","database","notification","delay","join","end"]);
const BRANCHES = new Set(["DEFAULT","TRUE","FALSE","APPROVED","REJECTED","TIMEOUT"]);

const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {});
const arr = (v: unknown): any[] => Array.isArray(v) ? v : v == null ? [] : [v];
const text = (v: unknown, fallback = "") => v == null ? fallback : typeof v === "string" ? v.trim() : typeof v === "number" || typeof v === "boolean" ? String(v) : fallback;
const first = (...vals: unknown[]) => vals.find(v => v !== undefined && v !== null && !(typeof v === "string" && !v.trim()));
const slug = (v: unknown, fallback = "node") => {
  const s = text(v, fallback).toLowerCase().replace(/[^a-z0-9_-]+/g,"_").replace(/^_+|_+$/g,"");
  return s || fallback;
};
const title = (s: string) => s.replace(/[_-]+/g," ").replace(/\b\w/g,m=>m.toUpperCase()).trim();

function primitiveConfig(raw: unknown): Record<string,string|number|boolean> {
  const source = obj(raw);
  const out: Record<string,string|number|boolean> = {};
  for (const [k,v] of Object.entries(source)) {
    if (["string","number","boolean"].includes(typeof v)) out[k] = v as any;
    else if (v != null) out[k] = JSON.stringify(v);
  }
  return out;
}

function inferType(raw: Record<string, any>, id: string, name: string): WorkflowIR["nodes"][number]["type"] {
  const declared = text(first(raw.type, raw.kind, raw.nodeType, raw.category)).toLowerCase();
  const aliases: Record<string,string> = { start:"trigger", event:"trigger", input:"trigger", task:"action", step:"action", decision:"condition", if:"condition", human_approval:"approval", human:"approval", http:"api", request:"api", db:"database", storage:"database", email:"notification", notify:"notification", message:"notification", wait:"delay", timer:"delay", join:"join", merge:"join", barrier:"join", synchronize:"join", stop:"end", finish:"end", terminal:"end", output:"end" };
  const mapped = aliases[declared] || declared;
  const hay = `${id} ${name} ${text(raw.description)} ${JSON.stringify(raw.config || raw.parameters || {})}`.toLowerCase();
  // Do not let a generic model-declared action/task hide an obvious specialized node.
  // Small models often emit {type:"action", name:"Notify Accounts"}; normalize that
  // to the behaviorally correct node before coverage/verification/execution.
  if (mapped === "action") {
    if (/\b(join|merge|barrier|synchroni[sz]e|wait for (?:all|both))/i.test(hay)) return "join";
    if (isCommunicationIntent(hay)) return "notification";
    if (/\b(webhook|callback)\b/.test(hay)) return "webhook";
    if (/\b(api|http|endpoint|rest)\b/.test(hay)) return "api";
    if (/\b(database|firestore|sql|persist|store|save record)\b/.test(hay)) return "database";
    if (/\b(wait|delay|pause|timeout)\b/.test(hay)) return "delay";
  }
  if (ALLOWED_TYPES.has(mapped)) return mapped as any;
  if (/\b(start|trigger|schedule|webhook received|when )/.test(hay)) return "trigger";
  if (/\b(if|condition|decision|check whether|is .+\?|threshold|compare)/.test(hay)) return "condition";
  if (/\b(approval|approve|review|authorize|permission)/.test(hay)) return "approval";
  if (/\b(webhook|callback)/.test(hay)) return "webhook";
  if (/\b(api|http|endpoint|rest)/.test(hay)) return "api";
  if (/\b(database|firestore|sql|persist|store|save record)/.test(hay)) return "database";
  if (isCommunicationIntent(hay)) return "notification";
  if (/\b(wait|delay|pause|timeout)/.test(hay)) return "delay";
  if (/\b(join|merge|barrier|synchroni[sz]e|wait for (?:all|both))/i.test(hay)) return "join";
  if (/\b(end|finish|complete|done|terminate|stop)/.test(hay)) return "end";
  return "action";
}

function synthesizedNode(ref:string, description:string): WorkflowIR["nodes"][number] {
  const name=title(ref);
  const type=inferType({},ref,name);
  return {id:ref,type,name,description,config:completeNodeConfig(type,name,description,{Inferred:"true"})};
}

function normalizeBranch(v: unknown, sourceType?: string): WorkflowIR["edges"][number]["branch"] {
  const b = text(v,"DEFAULT").toUpperCase().replace(/[\s-]+/g,"_");
  const map: Record<string,string> = {
    YES:"TRUE", NO:"FALSE", THEN:"TRUE", ELSE:"FALSE", PASS:"TRUE", FAIL:"FALSE",
    SUCCESS:"TRUE", FAILURE:"FALSE", POSITIVE:"TRUE", NEGATIVE:"FALSE",
    APPROVE:"APPROVED", ACCEPTED:"APPROVED", ACCEPT:"APPROVED", ALLOW:"APPROVED",
    DENIED:"REJECTED", DENY:"REJECTED", REJECT:"REJECTED", DECLINED:"REJECTED",
    EXPIRED:"TIMEOUT", TIMED_OUT:"TIMEOUT", NEXT:"DEFAULT", ALWAYS:"DEFAULT", NORMAL:"DEFAULT", NONE:"DEFAULT"
  };
  let out = map[b] || b;
  // Only decision nodes own semantic outcome branches. Human-readable action names
  // and success/failure prose on ordinary nodes are canonicalized to DEFAULT.
  if (sourceType === "condition") return (["TRUE","FALSE"].includes(out) ? out : "DEFAULT") as any;
  if (sourceType === "approval") {
    if (["APPROVED","REJECTED","TIMEOUT"].includes(out)) return out as any;
    if (/yes|true|success|approve/i.test(b)) return "APPROVED";
    if (/no|false|fail|reject/i.test(b)) return "REJECTED";
    return "DEFAULT";
  }
  return "DEFAULT";
}

function normalizeAmbiguity(v: unknown): WorkflowIR["ambiguities"][number] | null {
  if (typeof v === "string") return { text:v, reason:"Model flagged this requirement as ambiguous", requiresUserInput:true };
  const r = obj(v);
  const t = text(first(r.text,r.term,r.field,r.issue,r.ambiguity,r.requirement));
  if (!t) return null;
  return { text:t, reason:text(first(r.reason,r.description,r.message,r.why),"More user detail is required"), requiresUserInput:Boolean(first(r.requiresUserInput,r.requires_user_input,r.needsInput,r.needs_input,true)) };
}

export interface NormalizationReport { warnings: string[]; synthesizedNodeIds: string[]; sourceShape: string; }
export function normalizeWorkflowIR(rawInput: unknown): { ir: WorkflowIR; report: NormalizationReport } {
  const raw = obj(rawInput);
  const warnings: string[] = [];
  const synthesizedNodeIds: string[] = [];

  const workflowName = text(first(raw.workflowName,raw.workflow_name,raw.name,raw.title,raw.workflow?.name,raw.workflow?.title),"Generated Workflow");
  const purpose = text(first(raw.purpose,raw.goal,raw.objective,raw.intent,raw.workflow?.purpose,raw.description),`Execute ${workflowName}`);
  const summary = text(first(raw.summary,raw.overview,raw.workflowSummary,raw.workflow_summary),purpose);
  const triggerDescription = text(first(raw.triggerDescription,raw.trigger_description,raw.trigger?.description,raw.trigger?.name,raw.trigger,raw.startCondition,raw.start_condition),"Workflow trigger");

  const rawNodes = arr(first(raw.nodes,raw.steps,raw.stages,raw.tasks,raw.workflow?.nodes,raw.workflow?.steps));
  const nodes: WorkflowIR["nodes"] = [];
  const used = new Set<string>();
  const reserve = (candidate:string) => { let id=slug(candidate); let i=2; while(used.has(id)) id=`${slug(candidate)}_${i++}`; used.add(id); return id; };

  rawNodes.forEach((item,index)=>{
    const r = typeof item === "string" ? { name:item } : obj(item);
    const name = text(first(r.name,r.label,r.title,r.step,r.action,r.operation,r.description),`Step ${index+1}`);
    const proposed = text(first(r.id,r.key,r.nodeId,r.node_id,r.slug), slug(name,`step_${index+1}`));
    const id = reserve(proposed);
    const type = inferType(r,id,name);
    let config = primitiveConfig(first(r.config,r.parameters,r.params,r.settings,r.options,r.metadata));
    const expression = first(r.expression,r.condition,r.when,r.rule,r.predicate,r.config?.Expression,r.config?.expression,r.parameters?.expression);
    const role = first(r.role,r.approver,r.actor,r.config?.Role,r.config?.role,r.parameters?.role);
    const operation = first(r.operation,r.action,r.command,r.config?.Operation,r.config?.operation,r.parameters?.operation);
    if (expression != null && !config.Expression) config.Expression = text(expression);
    if (role != null && !config.Role) config.Role = text(role);
    if (operation != null && !config.Operation) config.Operation = text(operation);
    if(type==="join"&&!config.JoinMode){
      const declared=text(first(r.type,r.kind,r.nodeType,r.category)).toLowerCase();
      const hay=`${declared} ${name} ${text(r.description)}`.toLowerCase();
      config.JoinMode=/\bmerge\b/.test(hay)?"MERGE":"BARRIER";
    }
    nodes.push({ id,type,name,description:text(first(r.description,r.subtitle,r.details,r.purpose),""),config,
      requirementActionId:text(first(r.requirementActionId,r.requirement_action_id))||undefined,
      inputs:arr(first(r.inputs,r.consumes)).map(x=>text(x)).filter(Boolean),
      outputs:arr(first(r.outputs,r.produces)).map(x=>text(x)).filter(Boolean) });
    if (id !== proposed) warnings.push(`Renamed duplicate/unsafe node id '${proposed}' to '${id}'.`);
  });

  // When no explicit nodes are provided, accept common action/step arrays.
  if (!nodes.length) {
    const actions = arr(first(raw.actions,raw.workflow?.actions));
    actions.forEach((a,index)=>{
      const name = typeof a === "string" ? a : text(first(obj(a).name,obj(a).action,obj(a).description),`Action ${index+1}`);
      const id = reserve(`action_${index+1}_${slug(name)}`);
      nodes.push({id,type:"action",name,description:"Recovered from model action list",config:{Operation:name},inputs:[],outputs:[]});
    });
  }

  const byId = () => new Map(nodes.map(n=>[n.id,n]));
  let nodeMap = byId();
  const resolveRef = (v:unknown):string => {
    const s=text(v); if (!s) return "";
    if (nodeMap.has(s)) return s;
    const ss=slug(s);
    if (nodeMap.has(ss)) return ss;
    const match=nodes.find(n=>n.name.toLowerCase()===s.toLowerCase() || slug(n.name)===ss);
    return match?.id || ss;
  };

  const rawEdges = arr(first(raw.edges,raw.connections,raw.transitions,raw.links,raw.workflow?.edges,raw.workflow?.connections));
  const edges: WorkflowIR["edges"] = [];
  for (const item of rawEdges) {
    const r=obj(item);
    let source=resolveRef(first(r.source,r.from,r.start,r.origin,r.sourceId,r.source_id));
    let target=resolveRef(first(r.target,r.to,r.end,r.destination,r.targetId,r.target_id,r.next));
    if (!source || !target) { warnings.push(`Ignored connection with missing source/target: ${JSON.stringify(r).slice(0,180)}`); continue; }
    nodeMap=byId();
    for (const ref of [source,target]) {
      if (!nodeMap.has(ref)) {
        nodes.push(synthesizedNode(ref,"Synthesized because the model referenced this node in an edge but did not define it."));
        synthesizedNodeIds.push(ref);
        warnings.push(`Synthesized missing node '${ref}' referenced by an edge.`);
        nodeMap=byId();
      }
    }
    const sourceType=nodeMap.get(source)?.type;
    edges.push({source,target,branch:normalizeBranch(first(r.branch,r.label,r.condition,r.outcome,r.result,r.path,r.handle),sourceType)});
  }

  // Accept nested branch declarations on nodes: {next}, {true/false}, {branches:{...}}
  nodeMap=byId();
  for (const original of rawNodes) {
    const r=obj(original); const source=resolveRef(first(r.id,r.key,r.nodeId,r.node_id,r.name,r.label,r.title));
    if (!source || !nodeMap.has(source)) continue;
    const sourceType=nodeMap.get(source)!.type;
    const branchObj=obj(first(r.branches,r.paths,r.outcomes));
    const candidates:[unknown,unknown][]=[
      [first(r.next,r.nextId,r.next_id),"DEFAULT"], [first(r.true,r.onTrue,r.on_true,r.yes),"TRUE"], [first(r.false,r.onFalse,r.on_false,r.no),"FALSE"],
      [first(r.approved,r.onApproved,r.on_approved),"APPROVED"], [first(r.rejected,r.onRejected,r.on_rejected),"REJECTED"], [first(r.timeout,r.onTimeout,r.on_timeout),"TIMEOUT"],
      [first(branchObj.true,branchObj.TRUE,branchObj.yes),"TRUE"], [first(branchObj.false,branchObj.FALSE,branchObj.no),"FALSE"], [first(branchObj.approved,branchObj.APPROVED),"APPROVED"], [first(branchObj.rejected,branchObj.REJECTED),"REJECTED"]
    ];
    for (const [targetRaw,branch] of candidates) {
      if (targetRaw==null) continue; const target=resolveRef(targetRaw); if(!target) continue;
      if (!nodeMap.has(target)) { nodes.push(synthesizedNode(target,"Synthesized from inline branch reference")); synthesizedNodeIds.push(target); nodeMap=byId(); }
      if (!edges.some(e=>e.source===source&&e.target===target&&e.branch===normalizeBranch(branch,sourceType))) edges.push({source,target,branch:normalizeBranch(branch,sourceType)});
    }
  }

  // If useful nodes exist but no connections, recover a sequential graph.
  if (nodes.length && !edges.length) {
    warnings.push("Model returned nodes without edges; synthesized sequential connections.");
    for (let i=0;i<nodes.length-1;i++) edges.push({source:nodes[i].id,target:nodes[i+1].id,branch:"DEFAULT"});
  }

  // Enrich functional nodes with safe logical defaults. No real endpoint,
  // address, credential, or business rule is invented here.
  for (const n of nodes) n.config=completeNodeConfig(n.type,n.name,n.description,Object.fromEntries(Object.entries(n.config||{}).map(([k,v])=>[k,String(v)])));

  // Ensure a trigger exists; preserve the model's first step rather than failing.
  if (!nodes.some(n=>n.type==="trigger")) {
    const id=reserve("start"); nodes.unshift({id,type:"trigger",name:"Start",description:triggerDescription,config:{Inferred:true,Event:triggerDescription}}); synthesizedNodeIds.push(id); warnings.push("Synthesized missing trigger node.");
    const targets=new Set(edges.map(e=>e.target)); const firstEntry=nodes.slice(1).find(n=>!targets.has(n.id)) || nodes[1]; if(firstEntry) edges.unshift({source:id,target:firstEntry.id,branch:"DEFAULT"});
  }

  // Do not manufacture END nodes just to satisfy a schema. Final action-like nodes
  // may legally terminate a path. Unsafe dead ends (condition/approval/delay/trigger)
  // are intentionally left visible for deterministic + semantic verification.

  // Convert obvious condition/approval default branches only when labels are usable.
  nodeMap=byId();
  for (const edge of edges) edge.branch=normalizeBranch(edge.branch,nodeMap.get(edge.source)?.type);

  const actors = arr(first(raw.actors,raw.roles,raw.participants,raw.workflow?.actors)).map(v=>text(typeof v==="string"?v:first(obj(v).name,obj(v).role,obj(v).label))).filter(Boolean);
  const inputs = arr(first(raw.inputs,raw.variables,raw.fields,raw.workflow?.inputs)).map((v,index)=>{
    if(typeof v==="string") return {name:slug(v,`input_${index+1}`),type:"string" as const,description:v,required:true};
    const r=obj(v); const typ=text(first(r.type,r.dataType,r.data_type),"string").toLowerCase();
    return {name:slug(first(r.name,r.id,r.field),`input_${index+1}`),type:(["string","number","boolean","date","object"].includes(typ)?typ:"string") as any,description:text(first(r.description,r.label),""),required:Boolean(first(r.required,r.isRequired,r.is_required,true)),allowedValues:arr(first(r.allowedValues,r.allowed_values,r.enum,r.options)).filter(x=>["string","number","boolean"].includes(typeof x))};
  });
  const ambiguities=arr(first(raw.ambiguities,raw.ambiguity,raw.uncertainties,raw.questions,raw.missingInformation,raw.missing_information)).map(normalizeAmbiguity).filter(Boolean) as WorkflowIR["ambiguities"];
  const assumptions=arr(first(raw.assumptions,raw.inferences)).map(v=>text(typeof v==="string"?v:first(obj(v).text,obj(v).description))).filter(Boolean);
  const conditions=arr(first(raw.conditions,raw.decisions)).map(v=>text(typeof v==="string"?v:first(obj(v).expression,obj(v).condition,obj(v).name))).filter(Boolean);
  const actions=arr(first(raw.actions)).map(v=>text(typeof v==="string"?v:first(obj(v).name,obj(v).action,obj(v).description))).filter(Boolean);

  const rp=obj(first(raw.requirementPlan,raw.requirement_plan));
  const requirementPlan = Object.keys(rp).length ? {
    actions: arr(rp.actions).map((a:any,i)=>{const x=obj(a);return {id:text(first(x.id,x.key),`A${i+1}`),intent:text(first(x.intent,x.action,x.label),`Action ${i+1}`),label:text(first(x.label,x.name,x.intent),`Action ${i+1}`),required:Boolean(first(x.required,true))};}),
    ordering: arr(first(rp.ordering,rp.order)).map((o:any)=>{const x=obj(o);return {before:text(x.before),after:text(x.after),source:text(x.source)}}).filter((x:any)=>x.before&&x.after),
    decisions: arr(rp.decisions).map((d:any,i)=>{const x=obj(d);return {id:text(x.id,`D${i+1}`),expression:text(first(x.expression,x.condition)),outcomes:arr(x.outcomes).map(v=>text(v)).filter(Boolean),source:text(x.source)}}).filter((x:any)=>x.expression),
    parallelGroups: arr(first(rp.parallelGroups,rp.parallel_groups)).map((g:any,i)=>{const x=obj(g);return {id:text(x.id,`P${i+1}`),actions:arr(x.actions).map(v=>text(v)).filter(Boolean),requiresJoin:Boolean(first(x.requiresJoin,x.requires_join,false)),source:text(x.source)}}),
  } : undefined;
  const ir: WorkflowIR = { workflowName,purpose,summary,triggerDescription,actors,inputs,conditions,actions,nodes,edges,ambiguities,assumptions,requirementPlan };
  return { ir, report:{warnings,synthesizedNodeIds,sourceShape:Object.keys(raw).join(", ") || "unknown"} };
}
