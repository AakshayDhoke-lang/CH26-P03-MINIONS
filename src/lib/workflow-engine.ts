import type { Edge } from "@xyflow/react";
import type { DetectedStage, NLPAnalysis, NodeKind, VerificationIssue, WorkflowNodeData } from "./types";
import type { WorkflowIR } from "./workflow-ir";
import type { WFNode } from "./workflow-store";
import { completeNodeConfig, isCommunicationIntent, nodeContractIssues } from "./node-contracts";
import { evaluateSharedStructuralRules } from "./workflow-structural-rules";
import { buildRequirementContract } from "./requirement-contract";

export interface GeneratedTestCase {
  id: string;
  name: string;
  description: string;
  inputs: Record<string, string | number | boolean | Array<string | number | boolean>>;
  approvals: Record<string, "approved" | "rejected" | "timeout">;
  nodeMocks?: Record<string, Record<string, string | number | boolean>>;
  expectedTerminal?: string;
  expectedPathIncludes: string[];
  coverageTarget?: { nodeId:string; branch:"TRUE"|"FALSE"|"APPROVED"|"REJECTED"|"TIMEOUT"|"SUCCESS"|"FAILURE"|"LOOP_REPEAT"|"LOOP_EXIT"|"PARALLEL_BRANCH"|"JOIN_REACHED"|"JOIN_CONTINUATION" };
  source?: "deterministic" | "ai" | "custom";
}

export interface PromptCompilation {
  workflowName: string;
  analysis: NLPAnalysis;
  stages: DetectedStage[];
  nodes: WFNode[];
  edges: Edge[];
  tests: GeneratedTestCase[];
  notes: string[];
}

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
const titleCase = (s: string) => s.trim().replace(/^[-,:;\s]+|[-,:;\s]+$/g, "").replace(/\b\w/g, (m) => m.toUpperCase());
const clean = (s: string) => s.replace(/\s+/g, " ").replace(/^[,.;:\s]+|[,.;:\s]+$/g, "").trim();

const actionVerbs = [
  "create","send","notify","check","verify","validate","update","delete","store","save","fetch","get","read","write","calculate","compute","generate","assign","route","forward","escalate","approve","reject","review","wait","delay","call","post","email","message","log","record","open","close","publish","archive","sync","trigger","run","execute","process","upload","download","transform","convert","extract"
];

function nodeKind(text: string): NodeKind {
  const t = text.toLowerCase();
  if (/\b(webhook|incoming request|http callback)\b/.test(t)) return "webhook";
  if (/\b(api|http|rest|endpoint|request to)\b/.test(t)) return "api";
  if (/\b(database|db|firestore|sql|record|store in|save to)\b/.test(t)) return "database";
  if (/\b(approval|approve|review by|permission|authorize)\b/.test(t)) return "approval";
  if (isCommunicationIntent(t)) return "notification";
  if (/\b(wait|delay|pause|after \d+|minutes?|hours?|days?)\b/.test(t)) return "delay";
  if (/\b(join|merge|barrier|synchroni[sz]e|wait for (?:all|both))\b/.test(t)) return "join";
  if (/\b(end|finish|complete|terminate|stop)\b/.test(t)) return "end";
  return "action";
}

function humanName(text: string, fallback = "Process Step") {
  const x = clean(text)
    .replace(/^(then|and then|and|please|system should|the system should|it should)\s+/i, "")
    .replace(/\b(if|when)\b.*$/i, "")
    .trim();
  if (!x) return fallback;
  return titleCase(x.length > 54 ? `${x.slice(0, 51)}...` : x);
}

function makeNode(id: string, kind: NodeKind, name: string, x: number, y: number, subtitle: string, config: Record<string,string> = {}): WFNode {
  return { id, type: "workflow", position: { x, y }, data: { kind, name, subtitle, status: "idle", issue: null, config } };
}
function makeEdge(source: string, target: string, label?: string, sourceHandle?: string): Edge {
  return { id: uid("edge"), source, target, label, sourceHandle, type: "smoothstep", animated: false };
}

function extractExpression(raw: string) {
  const s = clean(raw);
  const amount = s.match(/(?:amount|price|total|value|cost|score|priority|quantity|count|age|days?|hours?)?\s*(?:is\s*)?(above|over|greater than|more than|exceeds?|>=|at least|below|under|less than|fewer than|<=|equals?|is|==)\s*[₹$€£]?\s*([\d,.]+)\s*(k|lakh|lac|million)?/i);
  if (amount) {
    let value = Number(amount[2].replace(/,/g, ""));
    const unit = (amount[3] || "").toLowerCase();
    if (unit === "k") value *= 1000;
    if (unit === "lakh" || unit === "lac") value *= 100000;
    if (unit === "million") value *= 1000000;
    const opRaw = amount[1].toLowerCase();
    const op = /above|over|greater|more|exceed/.test(opRaw) ? ">" : /at least|>=/.test(opRaw) ? ">=" : /below|under|less|fewer/.test(opRaw) ? "<" : /<=/.test(opRaw) ? "<=" : "==";
    const fieldMatch = s.match(/\b(amount|price|total|value|cost|score|priority|quantity|count|age|days?|hours?)\b/i);
    const field = (fieldMatch?.[1] || "value").toLowerCase().replace(/\s+/g,"_");
    return { expression: `${field} ${op} ${value}`, field, op, value };
  }
  const eq = s.match(/\b([a-zA-Z_][\w ]{0,24})\s+(?:is|equals?|==)\s+([\w-]+)/i);
  if (eq) return { expression: `${eq[1].trim().toLowerCase().replace(/\s+/g,"_")} == ${eq[2]}`, field: eq[1].trim().toLowerCase().replace(/\s+/g,"_"), op: "==", value: eq[2] };
  return { expression: s, field: "condition", op: "custom", value: true };
}

function splitActions(text: string) {
  return clean(text).split(/\s*(?:,\s*)?(?:and then|then|and)\s+(?=(?:please\s+)?(?:create|send|notify|check|verify|validate|update|delete|store|save|fetch|get|read|write|calculate|compute|generate|assign|route|forward|escalate|approve|review|wait|delay|call|post|email|message|log|record|open|close|publish|archive|sync|run|execute|process|upload|download|transform|convert)\b)/i).map(clean).filter(Boolean);
}

function inferWorkflowName(text: string) {
  const first = clean(text.split(/[.!?\n]/)[0] || "Workflow");
  const core = first.replace(/^when\s+/i, "").replace(/^if\s+/i, "").split(/,| then /i)[0];
  return humanName(core || "Generated Workflow", "Generated Workflow").replace(/\b(Is|Are|Was|Were)\b/g, "").trim().slice(0, 42) || "Generated Workflow";
}

export function compileNaturalLanguage(input: string): PromptCompilation {
  const text = clean(input);
  const nodes: WFNode[] = [];
  const edges: Edge[] = [];
  const stages: DetectedStage[] = [];
  const actors = new Set<string>();
  const variables = new Set<string>();
  const conditions: string[] = [];
  const actions: string[] = [];
  const notes: string[] = [];
  let y = 20;

  const add = (kind: NodeKind, name: string, subtitle: string, config: Record<string,string> = {}, x=0) => {
    const id = uid(kind);
    const node = makeNode(id, kind, name, x, y, subtitle, config);
    nodes.push(node); stages.push({ id, kind, type: kind.toUpperCase(), name }); y += 135; return node;
  };
  const connect = (a: WFNode | undefined, b: WFNode, label?: string, handle?: string) => { if (!a) return; if(!label && a.data.kind === "approval") edges.push(makeEdge(a.id,b.id,"APPROVED","approved")); else if(!label && a.data.kind === "condition") edges.push(makeEdge(a.id,b.id,"TRUE","true")); else edges.push(makeEdge(a.id,b.id,label,handle)); };

  const triggerMatch = text.match(/^(?:when|whenever|once|on)\s+(.+?)(?:,|\bthen\b|\.)/i);
  const triggerText = triggerMatch?.[1] || "workflow is started";
  const trigger = add("trigger", humanName(triggerText, "Manual Trigger"), "Workflow trigger", { Event: clean(triggerText), Source: "Natural language compiler" });
  let mainTail: WFNode = trigger;

  // Remove the trigger clause from the body but preserve the remainder.
  let body = text;
  if (triggerMatch) body = clean(text.slice(triggerMatch.index! + triggerMatch[0].length));

  const sentences = body.split(/(?<=[.!?])\s+|\n+/).map(clean).filter(Boolean);
  for (const sentence of sentences.length ? sentences : [body]) {
    // Approval-result shorthand: "If approved, ..." / "If rejected, ..."
    const approvalResult = sentence.match(/^if\s+(approved|rejected|denied)\s*,?\s*(?:then\s+)?(.+)$/i);
    if (approvalResult) {
      const approval = [...nodes].reverse().find(n => n.data.kind === "approval");
      if (approval) {
        let branchTail: WFNode = approval;
        const decision = approvalResult[1].toLowerCase() === "approved" ? "APPROVED" : "REJECTED";
        for (const part of splitActions(approvalResult[2])) {
          const kind = nodeKind(part); const name = humanName(part); actions.push(name);
          const node = add(kind, name, "Derived from approval outcome", { Operation: clean(part) }, decision === "APPROVED" ? 220 : -220);
          if (branchTail.id === approval.id) connect(branchTail, node, decision, decision.toLowerCase()); else connect(branchTail, node);
          branchTail = node;
        }
        mainTail = branchTail;
        continue;
      }
    }

    const conditional = sentence.match(/^if\s+(.+?)(?:,|\bthen\b)\s*(.+?)(?:\s*(?:,|;)\s*(?:else|otherwise)\s+(.+))?$/i);
    if (conditional) {
      const condText = clean(conditional[1]); const parsed = extractExpression(condText);
      conditions.push(condText); variables.add(parsed.field);
      const cond = add("condition", humanName(condText + "?", "Condition"), "Decision branch", { Expression: parsed.expression });
      connect(mainTail, cond); mainTail = cond;
      let trueTail: WFNode = cond;
      for (const part of splitActions(conditional[2])) {
        const kind = nodeKind(part), name = humanName(part); actions.push(name);
        const role = part.match(/(?:manager|admin|finance|supervisor|owner|team lead|officer|employee|user|customer|vendor)/i)?.[0]; if(role) actors.add(titleCase(role));
        const node = add(kind, name, kind === "approval" ? "Human approval" : "Conditional action", kind === "approval" ? { Role: titleCase(role || "Approver"), "On Approval":"Continue", "On Rejection":"Requires branch" } : { Operation: clean(part) }, 220);
        if (trueTail.id === cond.id) connect(cond, node, "TRUE", "true"); else connect(trueTail, node);
        trueTail = node;
      }
      if (conditional[3]) {
        let falseTail: WFNode = cond;
        for (const part of splitActions(conditional[3])) {
          const kind = nodeKind(part), name = humanName(part); actions.push(name);
          const node = add(kind, name, "Alternative branch", { Operation: clean(part) }, -220);
          if (falseTail.id === cond.id) connect(cond, node, "FALSE", "false"); else connect(falseTail, node);
          falseTail = node;
        }
      }
      mainTail = trueTail;
      continue;
    }

    for (const part of splitActions(sentence)) {
      if (!part || part.toLowerCase() === triggerText.toLowerCase()) continue;
      const kind = nodeKind(part); const name = humanName(part); actions.push(name);
      const role = part.match(/(?:manager|admin|finance|supervisor|owner|team lead|officer|employee|user|customer|vendor|requester)/i)?.[0]; if(role) actors.add(titleCase(role));
      const config: Record<string,string> = kind === "approval"
        ? { Role: titleCase(role || "Approver"), "On Approval":"Continue", "On Rejection":"Requires branch" }
        : kind === "delay" ? { Duration: clean(part), Operation: clean(part) }
        : { Operation: clean(part) };
      const node = add(kind, name, kind === "approval" ? "Human-in-the-loop decision" : "Compiled action", config);
      connect(mainTail, node);
      mainTail = node;
    }
  }

  if (nodes.length === 1) {
    const fallback = add("action", "Process Request", "Compiler fallback", { Operation: text });
    connect(trigger, fallback); mainTail = fallback; actions.push("Process Request");
    notes.push("The instruction did not contain a clearly separable action, so a generic process node was generated for manual refinement.");
  }

  // Do not auto-add missing branch endings; verifier should discover/fix them. Add a normal end only if current main path is not already end.
  if (mainTail.data.kind !== "end") {
    const end = add("end", "END", "Workflow complete", {});
    connect(mainTail, end);
  }

  // Pull likely variables/actors from the original text.
  for (const m of text.matchAll(/\b(amount|price|total|cost|score|priority|status|quantity|count|budget|email|name|date|department)\b/gi)) variables.add(m[1].toLowerCase());
  for (const m of text.matchAll(/\b(manager|admin|finance|supervisor|owner|team lead|officer|employee|user|customer|vendor|requester)\b/gi)) actors.add(titleCase(m[1]));

  const tests = generateTests(nodes, edges, text);
  return {
    workflowName: inferWorkflowName(text),
    analysis: { trigger: triggerText, actors: [...actors], variables: [...variables], conditions, actions },
    stages, nodes, edges, tests, notes,
  };
}


export function compilationFromWorkflowIR(ir: WorkflowIR, prompt: string): PromptCompilation {
  const nodeMap = new Map(ir.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, number>();
  for (const node of ir.nodes) incoming.set(node.id, 0);
  for (const edge of ir.edges) incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);

  const triggerIds = ir.nodes.filter((node) => node.type === "trigger").map((node) => node.id);
  const levels = new Map<string, number>();
  const queue = triggerIds.map((id) => ({ id, level: 0 }));
  const seen = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current.id) && (levels.get(current.id) ?? 0) <= current.level) continue;
    seen.add(current.id);
    levels.set(current.id, Math.max(levels.get(current.id) ?? 0, current.level));
    for (const edge of ir.edges.filter((e) => e.source === current.id)) {
      if (edge.target !== current.id && current.level < ir.nodes.length + 2) queue.push({ id: edge.target, level: current.level + 1 });
    }
  }
  ir.nodes.forEach((node, index) => { if (!levels.has(node.id)) levels.set(node.id, index + 1); });

  const byLevel = new Map<number, typeof ir.nodes>();
  for (const node of ir.nodes) {
    const level = levels.get(node.id) ?? 0;
    const list = byLevel.get(level) || [];
    list.push(node);
    byLevel.set(level, list);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [level, nodesAtLevel] of byLevel) {
    const spacing = 330;
    const startX = -((nodesAtLevel.length - 1) * spacing) / 2;
    nodesAtLevel.forEach((node, index) => positions.set(node.id, { x: startX + index * spacing, y: 30 + level * 150 }));
  }

  const nodes: WFNode[] = ir.nodes.map((node) => {
    const position = positions.get(node.id) || { x: 0, y: 0 };
    // Last-line compatibility guard: communication semantics may never remain a generic Action.
    // This catches older/stale planner outputs and manually imported IR as well as current models.
    const semantic = `${node.name} ${node.description || ""}`;
    const effectiveType: NodeKind = node.type === "action" && isCommunicationIntent(semantic) ? "notification" : node.type;
    const rawConfig = Object.fromEntries(Object.entries(node.config || {}).map(([key, value]) => [key, String(value)]));
    if (node.inputs?.length) rawConfig.Consumes = node.inputs.join(", ");
    if (node.outputs?.length) rawConfig.Produces = node.outputs.join(", ");
    const config = completeNodeConfig(effectiveType, node.name, node.description || ir.purpose, rawConfig);
    const wfNode = makeNode(node.id, effectiveType, node.name, position.x, position.y, node.description || ir.purpose, config);
    if (node.requirementActionId) wfNode.data.provenance = { source:"explicit", requirementRefs:[node.requirementActionId], confidence:"high" };
    return wfNode;
  });

  const branchHandle = (branch: string) => {
    const upper = branch.toUpperCase();
    if (upper === "TRUE") return "true";
    if (upper === "FALSE") return "false";
    if (upper === "APPROVED") return "approved";
    if (upper === "REJECTED") return "rejected";
    if (upper === "TIMEOUT") return "timeout";
    return undefined;
  };
  const edges: Edge[] = ir.edges.map((edge, index) => ({
    id: `edge-ai-${index + 1}-${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    label: edge.branch === "DEFAULT" ? undefined : edge.branch,
    sourceHandle: branchHandle(edge.branch),
    type: "smoothstep",
    animated: false,
  }));

  const stages: DetectedStage[] = ir.nodes.map((node) => ({ id: node.id, kind: node.type, type: node.type.toUpperCase(), name: node.name }));
  const variables = [...new Set(ir.inputs.map((input) => input.name))];
  const analysis: NLPAnalysis = {
    trigger: ir.triggerDescription,
    actors: ir.actors,
    variables,
    conditions: ir.conditions,
    actions: ir.actions,
  };
  const notes = [
    ...(ir.requirementPlan?.actions || []).map((item) => `Requirement ${item.id}: ${item.label}`),
    ...ir.ambiguities.map((item) => `Ambiguity: ${item.text} — ${item.reason}`),
    ...ir.assumptions.map((item) => `Assumption: ${item}`),
  ];
  const tests = generateTests(nodes, edges, prompt);
  return { workflowName: ir.workflowName, analysis, stages, nodes, edges, tests, notes };
}

type Atom = { field:string; op:">"|">="|"<"|"<="|"=="|"!="; value:any };
type ExprAst = {kind:"atom";atom:Atom}|{kind:"and"|"or";left:ExprAst;right:ExprAst};
function trimOuterParens(v:string){let s=v.trim();while(s.startsWith("(")&&s.endsWith(")")){let depth=0,ok=true;for(let i=0;i<s.length;i++){if(s[i]==="(")depth++;else if(s[i]===")")depth--;if(depth===0&&i<s.length-1){ok=false;break;}}if(!ok)break;s=s.slice(1,-1).trim();}return s;}
function splitLogicalTop(expr:string, op:"AND"|"OR"){let depth=0;let quote="";const upper=expr.toUpperCase();for(let i=0;i<expr.length;i++){const ch=expr[i];if(quote){if(ch===quote&&expr[i-1]!=="\\")quote="";continue;}if(ch==="\""||ch==="'"){quote=ch;continue;}if(ch==="(")depth++;else if(ch===")")depth--;if(depth===0){const token=op==="AND"?/^(?:\s+AND\s+|\s*&&\s*)/:/^(?:\s+OR\s+|\s*\|\|\s*)/;const m=upper.slice(i).match(token);if(m)return [expr.slice(0,i).trim(),expr.slice(i+m[0].length).trim()];}}return null;}
function parseAtom(expr:string):Atom|null{const m=trimOuterParens(expr).match(/^([\w.]+)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);if(!m)return null;const raw=m[3].trim();const num=Number(raw);let value:any;if(!Number.isNaN(num)&&raw!=="")value=num;else if(/^(true|false)$/i.test(raw))value=/^true$/i.test(raw);else value=raw.replace(/^['"]|['"]$/g,"");return {field:m[1],op:m[2] as Atom["op"],value};}
function parseConditionAst(expr:string):ExprAst|null{const e=trimOuterParens(expr);const or=splitLogicalTop(e,"OR");if(or){const l=parseConditionAst(or[0]),r=parseConditionAst(or[1]);return l&&r?{kind:"or",left:l,right:r}:null;}const and=splitLogicalTop(e,"AND");if(and){const l=parseConditionAst(and[0]),r=parseConditionAst(and[1]);return l&&r?{kind:"and",left:l,right:r}:null;}const atom=parseAtom(e);return atom?{kind:"atom",atom}:null;}
function parseExpression(expr:string){const ast=parseConditionAst(expr);return ast?.kind==="atom"?ast.atom:null;}
function valuesFor(op: string, value: any) {
  if (typeof value === "number") {
    if (op === ">") return [value + Math.max(1, Math.round(Math.abs(value) * .1)||1), value];
    if (op === ">=") return [value, value - 1];
    if (op === "<") return [value-1, value];
    if (op === "<=") return [value, value + 1];
    if (op === "==") return [value, value + 1];
    if (op === "!=") return [value + 1, value];
  }
  if(typeof value==="boolean")return op==="=="?[value,!value]:[!value,value];
  return op==="!="?[`not_${value}`,value]:[value, `not_${value}`];
}
function mergeAssignments(a:Record<string,any>,b:Record<string,any>){return {...a,...b};}
function assignmentsForAst(ast:ExprAst,desired:boolean):Record<string,any>{if(ast.kind==="atom"){const [t,f]=valuesFor(ast.atom.op,ast.atom.value);return {[ast.atom.field]:desired?t:f};}if(ast.kind==="and"){return desired?mergeAssignments(assignmentsForAst(ast.left,true),assignmentsForAst(ast.right,true)):mergeAssignments(assignmentsForAst(ast.left,false),assignmentsForAst(ast.right,true));}return desired?mergeAssignments(assignmentsForAst(ast.left,true),assignmentsForAst(ast.right,false)):mergeAssignments(assignmentsForAst(ast.left,false),assignmentsForAst(ast.right,false));}
function compareAtom(atom:Atom,actual:any){switch(atom.op){case ">":return Number(actual)>Number(atom.value);case ">=":return Number(actual)>=Number(atom.value);case "<":return Number(actual)<Number(atom.value);case "<=":return Number(actual)<=Number(atom.value);case "==":{if(typeof atom.value==="boolean"){const av=typeof actual==="boolean"?actual:/^(true|1|yes)$/i.test(String(actual));return av===atom.value;}return String(actual).toLowerCase()===String(atom.value).toLowerCase();}case "!=":{if(typeof atom.value==="boolean"){const av=typeof actual==="boolean"?actual:/^(true|1|yes)$/i.test(String(actual));return av!==atom.value;}return String(actual).toLowerCase()!==String(atom.value).toLowerCase();}}}
function evaluateAst(ast:ExprAst,inputs:Record<string,any>,visitIndex:number):{result:boolean|null;detail:string;field?:string}{if(ast.kind==="atom"){const raw=inputs[ast.atom.field];if(Array.isArray(raw)&&visitIndex>=raw.length)return {result:null,detail:`TEST_DEFINITION_INVALID: input '${ast.atom.field}' has ${raw.length} value(s), but condition visit ${visitIndex+1} requires another value.`,field:ast.atom.field};const actual=Array.isArray(raw)?raw[visitIndex]:raw;if(actual===undefined||actual===null||actual==="")return {result:null,detail:`Missing test input '${ast.atom.field}' required by condition.`,field:ast.atom.field};const result=compareAtom(ast.atom,actual);return {result,detail:`${ast.atom.field}=${String(actual)} → ${ast.atom.field} ${ast.atom.op} ${String(ast.atom.value)} = ${result}`,field:ast.atom.field};}const l=evaluateAst(ast.left,inputs,visitIndex);if(l.result===null)return l;if(ast.kind==="and"&&l.result===false)return {result:false,detail:`(${l.detail}) AND (…) = false`};if(ast.kind==="or"&&l.result===true)return {result:true,detail:`(${l.detail}) OR (…) = true`};const r=evaluateAst(ast.right,inputs,visitIndex);if(r.result===null)return r;const result=ast.kind==="and"?Boolean(l.result&&r.result):Boolean(l.result||r.result);return {result,detail:`(${l.detail}) ${ast.kind.toUpperCase()} (${r.detail}) = ${result}`};}

export function generateTests(nodes: WFNode[], edges: Edge[], prompt: string): GeneratedTestCase[] {
  const conds=nodes.filter(n=>n.data.kind==="condition"), approvals=nodes.filter(n=>n.data.kind==="approval");
  const trigger=nodes.find(n=>n.data.kind==="trigger");
  const base:GeneratedTestCase={id:uid("test"),name:"Primary success path",source:"deterministic",description:`Generated from: ${prompt.slice(0,120)}${prompt.length>120?"…":""}`,inputs:{},approvals:{},expectedPathIncludes:[]};
  for(const c of conds){const ast=parseConditionAst(c.data.config?.Expression||"");if(ast)Object.assign(base.inputs,assignmentsForAst(ast,true));}
  for(const a of approvals)base.approvals[a.id]="approved";
  // Primary loop scenario intentionally enters once and exits, preserving deterministic regression behavior.
  for(const c of conds){const ast=parseConditionAst(c.data.config?.Expression||"");if(!ast)continue;const trueEdge=edges.find(e=>e.source===c.id&&String(e.label||e.sourceHandle||"").toUpperCase()==="TRUE");if(!trueEdge)continue;const seen=new Set<string>();const reachesBack=(id:string):boolean=>{if(id===c.id&&seen.size)return true;if(seen.has(id))return false;seen.add(id);return edges.filter(e=>e.source===id).some(e=>reachesBack(e.target));};if(reachesBack(trueEdge.target)){const t=assignmentsForAst(ast,true),f=assignmentsForAst(ast,false);for(const k of Object.keys(t))base.inputs[k]=[t[k],f[k]] as any;}}
  const tests:GeneratedTestCase[]=[base];
  const incomingPath=(target:string)=>{if(!trigger)return [] as Edge[];const q:[string,Edge[]][]=[[trigger.id,[]]];const seen=new Set<string>();while(q.length){const [id,path]=q.shift()!;if(id===target)return path;if(seen.has(id))continue;seen.add(id);for(const ed of edges.filter(e=>e.source===id))q.push([ed.target,[...path,ed]]);}return [] as Edge[];};
  const prepareToReach=(target:string)=>{const inputs:Record<string,any>={};const decisions:GeneratedTestCase["approvals"]={};for(const ed of incomingPath(target)){const src=nodes.find(n=>n.id===ed.source);const branch=String(ed.label||ed.sourceHandle||"DEFAULT").toUpperCase();if(src?.data.kind==="condition"&&(branch==="TRUE"||branch==="FALSE")){const ast=parseConditionAst(src.data.config?.Expression||"");if(ast)Object.assign(inputs,assignmentsForAst(ast,branch==="TRUE"));}if(src?.data.kind==="approval"&&["APPROVED","REJECTED","TIMEOUT"].includes(branch))decisions[src.id]=branch.toLowerCase() as any;}return {inputs,approvals:decisions};};
  for(const c of conds){const ast=parseConditionAst(c.data.config?.Expression||"");if(!ast)continue;for(const branch of ["TRUE","FALSE"] as const){if(!edges.some(e=>e.source===c.id&&String(e.label||e.sourceHandle||"").toUpperCase()===branch))continue;const reach=prepareToReach(c.id);Object.assign(reach.inputs,assignmentsForAst(ast,branch==="TRUE"));const isLoopCondition=edges.some(e=>{const seen=new Set<string>();const walk=(id:string):boolean=>{if(id===c.id&&seen.size)return true;if(seen.has(id))return false;seen.add(id);return edges.filter(x=>x.source===id).some(x=>walk(x.target));};return e.source===c.id&&walk(e.target);});const loops=branch==="TRUE"&&isLoopCondition;if(loops){const trueAssign=assignmentsForAst(ast,true),falseAssign=assignmentsForAst(ast,false);for(const k of Object.keys(trueAssign))reach.inputs[k]=[trueAssign[k],falseAssign[k]] as any;}tests.push({id:uid("test"),name:`${c.data.name} / ${branch}`,source:"deterministic",description:`Exact coverage target: ${c.id} ${branch}.`,inputs:reach.inputs,approvals:{...base.approvals,...reach.approvals},expectedPathIncludes:[],coverageTarget:{nodeId:c.id,branch:loops?"LOOP_REPEAT":(isLoopCondition&&branch==="FALSE"?"LOOP_EXIT":branch)}});}}
  for(const a of approvals){for(const branch of ["APPROVED","REJECTED","TIMEOUT"] as const){if(!edges.some(e=>e.source===a.id&&String(e.label||e.sourceHandle||"").toUpperCase()===branch))continue;const reach=prepareToReach(a.id);reach.approvals[a.id]=branch.toLowerCase() as any;tests.push({id:uid("test"),name:`${a.data.name} / ${branch}`,source:"deterministic",description:`Exact coverage target: ${a.id} ${branch}.`,inputs:reach.inputs,approvals:{...base.approvals,...reach.approvals},expectedPathIncludes:[],coverageTarget:{nodeId:a.id,branch}});}}
  const fanout=nodes.find(n=>edges.filter(e=>e.source===n.id&&String(e.label||e.sourceHandle||"DEFAULT").toUpperCase()==="DEFAULT").length>1);
  if(fanout){
    const plan=findParallelJoinPlan(nodes,edges,fanout.id);
    if(plan){
      tests.push({...base,id:uid("test"),name:"Parallel branch coverage",description:`Ensures every owned parallel branch from ${fanout.data.name} executes and synchronizes at ${plan.joinId}.`});
      for(const b of plan.branches)tests.push({...base,id:uid("test"),name:`Parallel branch / ${b.edge.target}`,description:`Proves the specific parallel branch ${b.edge.target} executes before Join ${plan.joinId}.`,coverageTarget:{nodeId:b.edge.target,branch:"PARALLEL_BRANCH"}});
      tests.push({...base,id:uid("test"),name:`Join reached / ${plan.joinId}`,description:`Proves all owned parallel branches synchronize at Join ${plan.joinId}.`,coverageTarget:{nodeId:plan.joinId,branch:"JOIN_REACHED"}});
      if(edges.some(e=>e.source===plan.joinId))tests.push({...base,id:uid("test"),name:`Join continuation / ${plan.joinId}`,description:`Proves execution continues after Join ${plan.joinId}.`,coverageTarget:{nodeId:plan.joinId,branch:"JOIN_CONTINUATION"}});
    } else {
      tests.push({...base,id:uid("test"),name:"Parallel branch coverage",description:`Ensures every supported independent terminal branch from ${fanout.data.name} executes.`});
    }
  }
  return tests;
}

export function requiredCoverageTargets(nodes:WFNode[],edges:Edge[]){const out:{nodeId:string;branch:string}[]=[];for(const n of nodes){const labels=new Set(edges.filter(e=>e.source===n.id).map(e=>String(e.label||e.sourceHandle||"DEFAULT").toUpperCase()));if(n.data.kind==="condition"){if(labels.has("TRUE"))out.push({nodeId:n.id,branch:"TRUE"});if(labels.has("FALSE"))out.push({nodeId:n.id,branch:"FALSE"});}if(n.data.kind==="approval")for(const b of ["APPROVED","REJECTED","TIMEOUT"])if(labels.has(b))out.push({nodeId:n.id,branch:b});if(n.data.kind==="join"){out.push({nodeId:n.id,branch:"JOIN_REACHED"});if(edges.some(e=>e.source===n.id))out.push({nodeId:n.id,branch:"JOIN_CONTINUATION"});}}for(const n of nodes){const plan=findParallelJoinPlan(nodes,edges,n.id);if(plan)for(const b of plan.branches)out.push({nodeId:b.edge.target,branch:"PARALLEL_BRANCH"});}return out;}
export function coverageKey(target:{nodeId:string;branch:string}){const b=target.branch==="LOOP_REPEAT"?"TRUE":target.branch==="LOOP_EXIT"?"FALSE":target.branch;return `${target.nodeId}/${b}`;}

export interface ParallelJoinPlan { joinId:string; branches:{edge:Edge;nodeIds:string[];edgeIds:string[]}[]; }
export function findParallelJoinPlan(nodes:WFNode[],edges:Edge[],sourceId:string):ParallelJoinPlan|null{
  const byId=new Map(nodes.map(n=>[n.id,n]));const starts=edges.filter(e=>e.source===sourceId&&String(e.label||e.sourceHandle||"DEFAULT").toUpperCase()==="DEFAULT");if(starts.length<2)return null;
  const pathToJoin=(startEdge:Edge,joinId:string)=>{const q:[string,string[],string[]][]=[[startEdge.target,[],[startEdge.id]]],seen=new Set<string>();while(q.length){const [id,path,eids]=q.shift()!;if(id===joinId)return {edge:startEdge,nodeIds:path,edgeIds:eids};if(seen.has(id))continue;seen.add(id);const n=byId.get(id);if(!n||["condition","approval","trigger","end","join"].includes(n.data.kind))continue;const outs=edges.filter(e=>e.source===id&&String(e.label||e.sourceHandle||"DEFAULT").toUpperCase()==="DEFAULT");if(outs.length!==1)continue;q.push([outs[0].target,[...path,id],[...eids,outs[0].id]]);}return null;};
  const joins=nodes.filter(n=>n.data.kind==="join"&&edges.filter(e=>e.target===n.id).length>=2);
  for(const j of joins){const branches=starts.map(e=>pathToJoin(e,j.id));if(branches.every(Boolean))return {joinId:j.id,branches:branches as any};}
  return null;
}

export interface ExpectedExecutionPlan { valid:boolean; pathIds:string[]; pathNames:string[]; terminal?:string; reason?:string; visitedBranches:{nodeId:string;branch:string}[]; coverageSatisfied?:boolean; }

/**
 * Deterministically derives the expected route for a generated test from the VERIFIED graph.
 * Gemma supplies scenarios/inputs; FlowForge supplies the oracle. This prevents stale or
 * hallucinated expectedPathIncludes values from making a correct execution look failed.
 */
export function deriveExpectedExecution(nodes: WFNode[], edges: Edge[], test: GeneratedTestCase): ExpectedExecutionPlan {
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const trigger=nodes.find(n=>n.data.kind==="trigger");
  if(!trigger)return {valid:false,pathIds:[],pathNames:[],reason:"No trigger node exists.",visitedBranches:[]};
  const finishPlan=(result:ExpectedExecutionPlan):ExpectedExecutionPlan=>{if(test.coverageTarget){const target=test.coverageTarget;const branch=target.branch==="LOOP_REPEAT"?"TRUE":target.branch==="LOOP_EXIT"?"FALSE":target.branch;const satisfied=visitedBranches.some(v=>v.nodeId===target.nodeId&&v.branch===branch);if(!satisfied&&result.valid)return {...result,valid:false,coverageSatisfied:false,reason:`Coverage target ${target.nodeId}/${target.branch} was not visited.`};return {...result,coverageSatisfied:satisfied};}return result;};
  let current:string|null=trigger.id;
  const pathIds:string[]=[];
  const visitedBranches:{nodeId:string;branch:string}[]=[];
  const conditionVisits:Record<string,number>={};
  const visitCounts:Record<string,number>={};
  const MAX=40;
  while(current){
    const node=byId.get(current); if(!node)return {valid:false,pathIds,pathNames:pathIds.map(id=>byId.get(id)?.data.name||id),reason:`Node ${current} does not exist.`,visitedBranches};
    visitCounts[current]=(visitCounts[current]||0)+1;
    if(visitCounts[current]>MAX)return {valid:false,pathIds,pathNames:pathIds.map(id=>byId.get(id)?.data.name||id),reason:`Expected-path derivation exceeded ${MAX} visits at ${node.data.name}.`,visitedBranches};
    pathIds.push(current);
    if(node.data.kind==="end")return finishPlan({valid:true,pathIds,pathNames:pathIds.map(id=>byId.get(id)?.data.name||id),terminal:node.data.name,visitedBranches});
    let outgoing=edges.filter(e=>e.source===current);
    if(node.data.kind==="approval"){
      const decision=test.approvals?.[node.id];
      if(!decision)return {valid:false,pathIds,pathNames:pathIds.map(id=>byId.get(id)?.data.name||id),reason:`Test has no approval decision for ${node.data.name}.`,visitedBranches};
      const wanted=decision==="approved"?"APPROVED":decision==="timeout"?"TIMEOUT":"REJECTED";
      const edge=outgoing.find(e=>String(e.label||e.sourceHandle||"").toUpperCase()===wanted);
      if(!edge)return {valid:false,pathIds,pathNames:pathIds.map(id=>byId.get(id)?.data.name||id),reason:`Missing ${wanted} branch from ${node.data.name}.`,visitedBranches};
      visitedBranches.push({nodeId:node.id,branch:wanted});
      current=edge.target; continue;
    }
    if(node.data.kind==="condition"){
      const visit=conditionVisits[node.id]||0;
      const ev=evaluateCondition(node.data.config?.Expression||"",test.inputs||{},visit);
      conditionVisits[node.id]=visit+1;
      if(ev.result===null)return {valid:false,pathIds,pathNames:pathIds.map(id=>byId.get(id)?.data.name||id),reason:ev.detail,visitedBranches};
      const wanted=ev.result?"TRUE":"FALSE";
      const edge=outgoing.find(e=>String(e.label||e.sourceHandle||"").toUpperCase()===wanted);
      if(!edge)return {valid:false,pathIds,pathNames:pathIds.map(id=>byId.get(id)?.data.name||id),reason:`Missing ${wanted} branch from ${node.data.name}.`,visitedBranches};
      visitedBranches.push({nodeId:node.id,branch:wanted});
      current=edge.target; continue;
    }
    if(node.data.kind==="join"){
      visitedBranches.push({nodeId:node.id,branch:"JOIN_REACHED"});
      if(outgoing.length)visitedBranches.push({nodeId:node.id,branch:"JOIN_CONTINUATION"});
    }
    if(["api","database","notification","webhook"].includes(node.data.kind)){
      const mock=(test.nodeMocks||{})[node.id]||{};
      const fail=String((mock as any).MockFailure??(mock as any).mockFailure??"").toLowerCase();
      const status=Number((mock as any).MockStatus??(mock as any).mockStatus??200);
      const failed=["true","1","yes","fail","failed","error"].includes(fail) || (node.data.kind==="api" && status>=400);
      if(failed){
        const edge=outgoing.find(e=>String(e.label||e.sourceHandle||"").toUpperCase()==="FALSE");
        if(edge){visitedBranches.push({nodeId:node.id,branch:"FAILURE"});current=edge.target;continue;}
        return {valid:false,pathIds,pathNames:pathIds.map(id=>byId.get(id)?.data.name||id),reason:`Scenario injects failure at ${node.data.name}, but the verified graph has no FALSE/failure path to handle it.`,visitedBranches};
      }
      const success=outgoing.find(e=>String(e.label||e.sourceHandle||"").toUpperCase()==="TRUE");
      if(success){visitedBranches.push({nodeId:node.id,branch:"SUCCESS"});current=success.target;continue;}
    }
    const normalOut=outgoing.filter(e=>!["REJECTED","FALSE"].includes(String(e.label||e.sourceHandle||"").toUpperCase()));
    if(normalOut.length>1){
      const joinPlan=findParallelJoinPlan(nodes,edges,node.id);
      if(joinPlan){for(const b of joinPlan.branches){visitedBranches.push({nodeId:b.edge.target,branch:"PARALLEL_BRANCH"});for(const id of b.nodeIds){const bn=byId.get(id)!;if(["api","database","notification","webhook"].includes(bn.data.kind)){const mock=(test.nodeMocks||{})[id]||{};const fail=String((mock as any).MockFailure??(mock as any).mockFailure??"").toLowerCase();const status=Number((mock as any).MockStatus??(mock as any).mockStatus??200);if(["true","1","yes","fail","failed","error"].includes(fail)||(bn.data.kind==="api"&&status>=400))return {valid:false,pathIds,pathNames:pathIds.map(x=>byId.get(x)?.data.name||x),reason:`Parallel branch failure at ${bn.data.name} is not representable before Join in this test oracle.`,visitedBranches};}pathIds.push(id);}}current=joinPlan.joinId;continue;}
      const targets=normalOut.map(e=>byId.get(e.target)).filter(Boolean) as WFNode[];const fanoutSafe=targets.length===normalOut.length&&targets.every(t=>["action","api","webhook","database","notification"].includes(t.data.kind)&&!edges.some(e=>e.source===t.id));if(!fanoutSafe)return {valid:false,pathIds,pathNames:pathIds.map(id=>byId.get(id)?.data.name||id),reason:`Parallel fan-out from ${node.data.name} does not converge on a valid Join barrier.`,visitedBranches};for(const t of targets)pathIds.push(t.id);return finishPlan({valid:true,pathIds,pathNames:pathIds.map(id=>byId.get(id)?.data.name||id),terminal:"Parallel branches completed",visitedBranches});
    }
    const normal=normalOut[0] || outgoing[0];
    if(!normal){
      if(["action","api","webhook","database","notification"].includes(node.data.kind))return finishPlan({valid:true,pathIds,pathNames:pathIds.map(id=>byId.get(id)?.data.name||id),terminal:node.data.name,visitedBranches});
      return {valid:false,pathIds,pathNames:pathIds.map(id=>byId.get(id)?.data.name||id),reason:`No valid outgoing path from ${node.data.name}.`,visitedBranches};
    }
    current=normal.target;
  }
  return finishPlan({valid:true,pathIds,pathNames:pathIds.map(id=>byId.get(id)?.data.name||id),visitedBranches});
}

export function evaluateCondition(expression: string, inputs: Record<string, any>, visitIndex=0): { result:boolean|null; detail:string; field?:string } {
  const ast=parseConditionAst(expression);if(!ast)return {result:null,detail:`Condition '${expression}' is outside FlowForge's supported expression grammar. Supported: comparisons combined with AND/OR/&&/|| and parentheses.`,field:"condition"};return evaluateAst(ast,inputs,visitIndex);
}

const IMPLICIT_TERMINAL_KINDS = new Set(["action","api","webhook","database","notification"]);
function isImplicitTerminalNode(node: WFNode, outs: Edge[]): boolean {
  if (outs.length) return false;
  if (!IMPLICIT_TERMINAL_KINDS.has(node.data.kind)) return false;
  const cfg=node.data.config||{};
  const terminalFlag=String(cfg.Terminal ?? cfg.terminal ?? cfg.EndWorkflow ?? cfg.endWorkflow ?? "").toLowerCase();
  if (["false","no","0"].includes(terminalFlag)) return false;
  return true;
}

function nodeConfigIssues(node: WFNode): {severity:"error"|"warning"; reason:string; fix:string}[] {
  const specialized=nodeContractIssues(node.data.kind,node.data.name,node.data.subtitle,node.data.config||{});
  const cfg=node.data.config||{}; const key=(...names:string[])=>names.some(n=>String(cfg[n]??"").trim());
  const out=[...specialized];
  if(node.data.kind==="webhook" && !key("Operation","URL","Url","url","Path","path","Event","event","Mode","mode")) out.push({severity:"warning",reason:"Webhook node has no send/receive intent or endpoint/path configuration.",fix:"Define webhook mode and logical destination/event. Concrete deployment URL/path may be supplied later."});
  if(node.data.kind==="database" && !key("Operation","Query","query","Table","table","Collection","collection","Resource","resource")) out.push({severity:"warning",reason:"Database node has no logical data operation defined.",fix:"Define read/write/update/delete and the logical resource. Connection details may be supplied later."});
  if(node.data.kind==="action" && !key("Operation","operation")) out.push({severity:"warning",reason:"Action node has no explicit operation identifier.",fix:"Define the logical operation this action performs."});
  return out;
}

export function verifyGraph(nodes: WFNode[], edges: Edge[], originalPrompt = ""): VerificationIssue[] {
  const issues: VerificationIssue[]=[];
  const triggers=nodes.filter(n=>n.data.kind==="trigger"); const ends=nodes.filter(n=>n.data.kind==="end");
  if(!triggers.length) issues.push(issue("missing-trigger","Missing Trigger","Structure","error","No trigger node exists, so the workflow has no defined entry point.",[],"Add a trigger and connect it to the first executable node."));
  else issues.push(pass("trigger-valid","Trigger Valid","Structure",`${triggers.length} workflow trigger${triggers.length>1?'s':''} detected.`));
  if(triggers.length>1) {
    const explicitMulti=/\b(multiple triggers|either when|when .+ or when|on either|separate triggers)\b/i.test(originalPrompt);
    issues.push(issue("multiple-triggers",explicitMulti?"Multiple Triggers":"Unexpected Multiple Triggers","Structure",explicitMulti?"warning":"error",explicitMulti?"Multiple entry points are allowed when intentionally designed.":"The original requirement defines one entry event, but the graph contains multiple trigger nodes.",triggers.map(n=>n.id),explicitMulti?"Confirm that each trigger is intentional.":"Keep the trigger that matches the stated entry event and re-type/reconnect any action that was misclassified as a trigger."));
  }
  const terminalLeaves=nodes.filter(n=>isImplicitTerminalNode(n,edges.filter(e=>e.source===n.id)));
  if(!ends.length && !terminalLeaves.length) issues.push(issue("missing-end","Missing End State","Structure","error","No explicit END node or terminal-capable final action exists.",[],"Add an END node or finish the workflow on a terminal action such as the final notification/API/database action."));
  else if(!ends.length && terminalLeaves.length) issues.push(pass("implicit-terminal-valid","Implicit Terminal Path Valid","Structure",`Workflow can complete after ${terminalLeaves.map(n=>n.data.name).join(", ")}. An explicit END node is optional unless the requirement specifically calls for one.`));

  const outgoing=(id:string)=>edges.filter(e=>e.source===id); const incoming=(id:string)=>edges.filter(e=>e.target===id);
  const visited=new Set<string>(); const q=triggers.map(n=>n.id); while(q.length){const id=q.shift()!;if(visited.has(id))continue;visited.add(id);outgoing(id).forEach(e=>q.push(e.target));}
  const unreachable=nodes.filter(n=>!visited.has(n.id)); if(unreachable.length) issues.push(issue("unreachable","Unreachable Nodes","Graph Integrity","error","Some nodes cannot be reached from any trigger.",unreachable.map(n=>n.id),"Connect unreachable nodes to an intended execution path or remove them.")); else if(nodes.length) issues.push(pass("reachability-valid","All Nodes Reachable","Graph Integrity","Every node is reachable from a workflow trigger."));

  nodes.forEach(n=>{
    const outs=outgoing(n.id); const ins=incoming(n.id);
    if(n.data.kind==="action"&&isCommunicationIntent(`${n.data.name} ${n.data.subtitle||""}`)) issues.push(issue(`communication-type-${n.id}`,`Communication Must Use Notification: ${n.data.name}`,"Node Contract","error","This step has communication intent (notify/email/message/alert/etc.) but is typed as a generic Action.",[n.id],"Change this node to Notification so recipient/channel/message behavior can be verified and executed consistently."));
    if(n.data.kind!=="trigger"&&n.data.kind!=="end"&&!ins.length) issues.push(issue(`orphan-${n.id}`,`Orphan Node: ${n.data.name}`,"Graph Integrity","error","This node has no incoming connection.",[n.id],"Connect it to the appropriate predecessor."));
    if(n.data.kind!=="end"&&!outs.length && !isImplicitTerminalNode(n,outs)) issues.push(issue(`deadend-${n.id}`,`Dead End: ${n.data.name}`,"Execution Safety","error","Execution stops at a node that cannot safely serve as a terminal action.",[n.id],"Connect this node to an END state or intended successor."));
    else if(n.data.kind!=="end"&&!outs.length && isImplicitTerminalNode(n,outs)) issues.push(pass(`terminal-action-${n.id}`,`Terminal Action Valid: ${n.data.name}`,"Execution Safety","This leaf action can validly complete the workflow without a separate END node."));
    if(n.data.kind==="end"&&outs.length) issues.push(issue(`end-out-${n.id}`,`End Node Has Output: ${n.data.name}`,"Execution Safety","error","Terminal nodes should not continue execution.",[n.id],"Remove outgoing edges from this END node."));
    if(n.data.kind==="condition"){
      const labels=outs.map(e=>String(e.label||e.sourceHandle||"").toUpperCase()); if(!labels.some(x=>x==="TRUE"||x==="TRUE".toLowerCase())||!labels.some(x=>x==="FALSE"||x==="FALSE".toLowerCase())) issues.push(issue(`condition-branches-${n.id}`,`Incomplete Condition: ${n.data.name}`,"Branch Safety","error","A condition should define both TRUE and FALSE outcomes.",[n.id],"Add explicit TRUE and FALSE branches."));
      if(!n.data.config?.Expression) issues.push(issue(`condition-expression-${n.id}`,`Undefined Condition: ${n.data.name}`,"Ambiguity","error","The condition node has no machine-evaluable expression.",[n.id],"Define an expression such as amount > 50000."));
      else if(!parseConditionAst(String(n.data.config.Expression))) issues.push(issue(`condition-grammar-${n.id}`,`Unsupported Condition Expression: ${n.data.name}`,"Execution Safety","error",`Expression '${String(n.data.config.Expression)}' is outside the supported grammar.`,[n.id],"Use comparisons combined with AND/OR (or &&/||) and parentheses."));
    }
    if(n.data.kind==="join"){const ins=edges.filter(e=>e.target===n.id),labels=[...ins,...outs].map(e=>String(e.label||e.sourceHandle||"DEFAULT").toUpperCase()),mode=String(n.data.config?.JoinMode||n.data.config?.Mode||"BARRIER").toUpperCase();if(ins.length<2)issues.push(issue(`join-inputs-${n.id}`,`Incomplete ${mode==="MERGE"?"Merge":"Join"}: ${n.data.name}`,"Parallel Semantics","error","A synchronization node must have at least two incoming paths.",[n.id],"Connect every intended branch into this Join/Merge."));if(outs.length>1)issues.push(issue(`join-outputs-${n.id}`,`Invalid Join Output: ${n.data.name}`,"Parallel Semantics","error","A Join/Merge may continue through at most one successor.",[n.id],"Keep one DEFAULT continuation edge."));if(labels.some(x=>x!=="DEFAULT"))issues.push(issue(`join-branches-${n.id}`,`Invalid Join Branch Labels: ${n.data.name}`,"Parallel Semantics","error","Join/Merge edges must use DEFAULT branch labels.",[n.id],"Use DEFAULT edges into and out of the Join/Merge."));if(!["BARRIER","MERGE"].includes(mode))issues.push(issue(`join-mode-${n.id}`,`Invalid Join Mode: ${n.data.name}`,"Parallel Semantics","error","JoinMode must be BARRIER or MERGE.",[n.id],"Set JoinMode to BARRIER or MERGE."));}
    if(n.data.kind==="approval"){
      const labels=outs.map(e=>String(e.label||e.sourceHandle||"").toUpperCase()); if(!labels.includes("APPROVED")||!labels.includes("REJECTED")) issues.push(issue(`approval-branches-${n.id}`,`Incomplete Approval: ${n.data.name}`,"Branch Safety","error","Human approval must define what happens for both approval and rejection.",[n.id],"Add APPROVED and REJECTED outcomes."));
      if(!n.data.config?.Role){const contract=buildRequirementContract(originalPrompt);const roleConstraints=contract.approvalRoles;const roleConstraint=roleConstraints.length===1?roleConstraints[0]:undefined;if(roleConstraint?.role)issues.push(issue(`approval-role-${n.id}`,`Missing Approval Role: ${n.data.name}`,"Authorization","error",`The requirement identifies ${roleConstraint.role} as the approver, but this Approval node has no Role.`,[n.id],`Set Role to ${roleConstraint.role}.`));else issues.push(issue(`approval-role-${n.id}`,`Approval Role Needs User Input: ${n.data.name}`,"User Input Required","warning","The requirement asks for approval but does not identify the approver role.",[n.id],"Ask the user to specify the authorized approver. Do not invent a role."));}
    }
    const cfgProblems=nodeConfigIssues(n);
    cfgProblems.forEach((c,idx)=>issues.push(issue(`config-${n.id}-${idx}`,`Incomplete ${n.data.kind.toUpperCase()} Node: ${n.data.name}`,"Node Configuration",c.severity,c.reason,[n.id],c.fix)));
  });

  // Strongly-connected-component cycle analysis. A loop is allowed when the cycle
  // contains a decision and has an explicit edge that exits the cycle. This covers
  // retry / repeat-until workflows without treating every cycle as a defect.
  const indexMap=new Map<string,number>(), low=new Map<string,number>(), stack:string[]=[], onStack=new Set<string>(); let nextIndex=0; const sccs:string[][]=[];
  const tarjan=(id:string)=>{indexMap.set(id,nextIndex);low.set(id,nextIndex);nextIndex++;stack.push(id);onStack.add(id);for(const ed of outgoing(id)){if(!indexMap.has(ed.target)){tarjan(ed.target);low.set(id,Math.min(low.get(id)!,low.get(ed.target)!));}else if(onStack.has(ed.target)){low.set(id,Math.min(low.get(id)!,indexMap.get(ed.target)!));}}if(low.get(id)===indexMap.get(id)){const comp:string[]=[];let w="";do{w=stack.pop()!;onStack.delete(w);comp.push(w);}while(w!==id);sccs.push(comp);}};
  nodes.forEach(n=>{if(!indexMap.has(n.id))tarjan(n.id);});
  const cyclic=sccs.filter(comp=>comp.length>1 || edges.some(e=>e.source===comp[0]&&e.target===comp[0]));
  if(!cyclic.length&&nodes.length){issues.push(pass("cycle-valid","No Circular Dependencies","Graph Integrity","No cycle was detected."));}
  const explicitLoopIntent=!originalPrompt.trim() || /\b(repeat|repeating|retry|again|keep checking|keep repeating|continue until|until|while|loop)\b/i.test(originalPrompt);
  cyclic.forEach((comp,idx)=>{
    const set=new Set(comp); const exits=edges.filter(e=>set.has(e.source)&&!set.has(e.target));
    const decisions=nodes.filter(n=>set.has(n.id)&&n.data.kind==="condition");
    const hasDecisionExit=exits.some(e=>decisions.some(n=>n.id===e.source));
    if(!explicitLoopIntent){
      issues.push(issue(`cycle-${idx+1}`,"Unexpected Cycle Detected","Graph Integrity","error",`Cycle ${comp.join(" → ")} exists even though the original requirement does not request repetition.`,comp,"Remove the accidental back-edge and restore the requested acyclic order."));
    }else if(decisions.length&&exits.length&&hasDecisionExit){
      issues.push(pass(`controlled-loop-${idx+1}`,"Controlled Loop Detected","Graph Integrity",`Loop ${comp.join(" → ")} has an explicit decision-controlled exit to ${[...new Set(exits.map(e=>e.target))].join(", ")}.`));
    }else if(exits.length){
      issues.push(issue(`cycle-${idx+1}`,"Potentially Unbounded Loop","Graph Integrity","warning",`Cycle ${comp.join(" → ")} has an exit, but the exit is not clearly controlled by a condition inside the loop.`,comp,"Connect an explicit condition outcome to the loop exit."));
    }else{
      issues.push(issue(`cycle-${idx+1}`,"Infinite Loop Detected","Graph Integrity","error",`Cycle ${comp.join(" → ")} has no edge leaving the cycle, so execution cannot terminate.`,comp,"Add a condition-controlled exit path from the loop."));
    }
  });

  if(originalPrompt.trim()) {
    const shared = evaluateSharedStructuralRules(
      originalPrompt,
      nodes.map(n => ({ id:n.id, type:n.data.kind as any, name:n.data.name, description:n.data.subtitle || "", config:n.data.config || {} })),
      edges.map(e => ({ source:e.source, target:e.target, branch:String(e.label || e.sourceHandle || "DEFAULT").toUpperCase() }))
    );
    const existing = new Set(issues.map(i => i.id));
    for(const f of shared) if(!existing.has(f.id)) issues.push(issue(f.id,f.title,f.category,f.severity,f.reason,f.affected,f.suggestedFix));
  }
  if(!issues.some(i=>i.category==="Authorization"&&i.severity!=="pass")) issues.push(pass("auth-valid","Authorization Model Valid","Authorization","All approval nodes have an explicit role."));
  return issues;
}

const issue=(id:string,title:string,category:string,severity:"error"|"warning",reason:string,affected:string[],suggestedFix:string):VerificationIssue=>({
  id:String(id),
  title:String(title),
  category:String(category),
  severity,
  reason:String(reason),
  affected:Array.isArray(affected)?affected.map(String):[],
  suggestedFix:String(suggestedFix||""),
});
const pass=(id:string,title:string,category:string,reason:string):VerificationIssue=>({id:String(id),title:String(title),category:String(category),severity:"pass",reason:String(reason),affected:[],suggestedFix:""});
