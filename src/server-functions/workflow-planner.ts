import { createServerFn } from "@tanstack/react-start";
import { buildDemoSafeWorkflow } from "@/lib/demo-safe-workflows";
import { WorkflowIRSchema, WorkflowPlanRequestSchema, type WorkflowIR } from "@/lib/workflow-ir";
import { normalizeWorkflowIR, type NormalizationReport } from "@/lib/workflow-ir-normalizer";
import { PLANNER_SYSTEM_PROMPT, PLANNER_DSL_PROMPT } from "./prompts/planner-prompts";
import { NORMAL_PLANNER_SYSTEM_PROMPT } from "./prompts/normal-planner-prompt";
import { plannerTokenBudget } from "./prompts/llm-budgets";
import { sharedProblems } from "@/lib/workflow-structural-rules";
import { completeNodeConfig, isCommunicationIntent } from "@/lib/node-contracts";
import { classifyWorkflowProfile } from "@/lib/workflow-profile";
import { callConfiguredLLM, configuredStructuredOutputMode, getLLMProviderConfig, resolveConfiguredModel, type LLMProviderKind } from "./llm-provider";
import { attachRequirementMappings, requirementPlanProblems } from "@/lib/requirement-plan";


let structuredOutputSupported: boolean | null = null;

const WORKFLOW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    workflowName: { type: "string" },
    purpose: { type: "string" },
    summary: { type: "string" },
    triggerDescription: { type: "string" },
    actors: { type:"array", items:{type:"string"} },
    inputs: { type:"array", items:{type:"object", additionalProperties:false, properties:{name:{type:"string"},type:{enum:["string","number","boolean","date","object"]},description:{type:"string"},required:{type:"boolean"}}, required:["name","type","description","required"]} },
    conditions: { type:"array", items:{type:"string"} },
    actions: { type:"array", items:{type:"string"} },
    assumptions: { type:"array", items:{type:"string"} },
    nodes: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          type: { enum: ["trigger", "action", "condition", "approval", "api", "webhook", "database", "notification", "delay", "join", "end"] },
          name: { type: "string" },
          description: { type: "string" },
          config: {
            type: "object",
            additionalProperties: { type: ["string", "number", "boolean"] },
          },
          requirementActionId: { type: "string" },
          inputs: { type: "array", items: { type: "string" } },
          outputs: { type: "array", items: { type: "string" } },
        },
        required: ["id", "type", "name", "description", "config", "inputs", "outputs"],
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          source: { type: "string" },
          target: { type: "string" },
          branch: { enum: ["DEFAULT", "TRUE", "FALSE", "APPROVED", "REJECTED", "TIMEOUT"] },
        },
        required: ["source", "target", "branch"],
      },
    },
    requirementPlan: {
      type: "object",
      additionalProperties: false,
      properties: {
        actions: { type: "array", items: { type: "object", additionalProperties: false, properties: { id:{type:"string"}, intent:{type:"string"}, label:{type:"string"}, required:{type:"boolean"} }, required:["id","intent","label","required"] } },
        ordering: { type: "array", items: { type: "object", additionalProperties: false, properties: { before:{type:"string"}, after:{type:"string"}, source:{type:"string"} }, required:["before","after","source"] } },
        decisions: { type: "array", items: { type: "object", additionalProperties: false, properties: { id:{type:"string"}, expression:{type:"string"}, outcomes:{type:"array",items:{type:"string"}}, source:{type:"string"} }, required:["id","expression","outcomes","source"] } },
        parallelGroups: { type: "array", items: { type: "object", additionalProperties: false, properties: { id:{type:"string"}, actions:{type:"array",items:{type:"string"}}, requiresJoin:{type:"boolean"}, source:{type:"string"} }, required:["id","actions","requiresJoin","source"] } },
      },
      required:["actions","ordering","decisions","parallelGroups"],
    },
    ambiguities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          reason: { type: "string" },
          requiresUserInput: { type: "boolean" },
        },
        required: ["text", "reason", "requiresUserInput"],
      },
    },
  },
  required: ["workflowName", "purpose", "summary", "triggerDescription", "requirementPlan", "nodes", "edges", "ambiguities"],
} as const;

type GenerationMode = "json-schema" | "json-prompt" | "dsl";

function parseDsl(content: string): unknown {
  const lines = content.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<analysis>[\s\S]*?<\/analysis>/gi, "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const raw: any = { nodes: [], edges: [], ambiguities: [] };
  for (const line of lines) {
    const parts = line.split("|").map(p => p.trim());
    const tag = parts[0]?.toUpperCase();
    if (tag === "WORKFLOW") raw.workflowName = parts.slice(1).join("|");
    else if (tag === "PURPOSE") raw.purpose = parts.slice(1).join("|");
    else if (tag === "SUMMARY") raw.summary = parts.slice(1).join("|");
    else if (tag === "TRIGGER") raw.triggerDescription = parts.slice(1).join("|");
    else if (tag === "NODE" && parts.length >= 5) {
      const config: Record<string, string | number | boolean> = {};
      for (const pair of (parts[5] || "").split(";").filter(Boolean)) {
        const eq = pair.indexOf("="); if (eq < 0) continue;
        const key = pair.slice(0, eq).trim(); const value = pair.slice(eq + 1).trim();
        if (key) config[key] = value;
      }
      raw.nodes.push({ id: parts[1], type: parts[2], name: parts[3], description: parts[4], config });
    } else if (tag === "EDGE" && parts.length >= 4) raw.edges.push({ source: parts[1], target: parts[2], branch: parts[3] || "DEFAULT" });
    else if (tag === "AMBIGUITY" && parts.length >= 2) raw.ambiguities.push({ text: parts[1], reason: parts.slice(2).join("|") || "More detail is required", requiresUserInput: true });
  }
  if (!raw.workflowName && !raw.nodes.length) throw new Error("The model did not return recognizable FlowForge DSL.");
  return raw;
}

function parseJsonContent(content: string): unknown {
  let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<analysis>[\s\S]*?<\/analysis>/gi, "").trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const first = cleaned.indexOf("{"); const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)); } catch {}
  }
  throw new Error(`The AI model did not return parseable JSON. Output started with: ${cleaned.slice(0, 300)}`);
}

function hasDirectedCycle(ir: WorkflowIR): boolean {
  const outgoing = new Map<string, string[]>();
  for (const edge of ir.edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source)!.push(edge.target);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dfs = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of outgoing.get(id) || []) if (dfs(next)) return true;
    visiting.delete(id); visited.add(id); return false;
  };
  return ir.nodes.some(n => dfs(n.id));
}


const STRUCTURE_STOPWORDS = new Set(["the","a","an","to","it","their","them","of","on","in","for","and","then","if","is","are","was","were","be","new","when","otherwise","else","day","one"]);
const STRUCTURE_VERBS = /\b(create|assign|notify|email|message|alert|schedule|classify|escalate|route|send|check|verify|validate|update|save|store|call|request|obtain|extract|match|process|record|open|close)\b/i;
function phraseTokens(v:string): string[] { return v.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(x=>x.length>2&&!STRUCTURE_STOPWORDS.has(x)); }
function findNodeForPhrase(ir:WorkflowIR, phrase:string, allowed?:Set<string>) {
  const want=phraseTokens(phrase); if(!want.length)return undefined;
  const normalized=want.join(" ");
  const ranked=ir.nodes.filter(n=>!allowed||allowed.has(n.type)).map(n=>{
    const have=phraseTokens(`${n.name} ${n.description} ${Object.values(n.config||{}).join(" ")}`), name=phraseTokens(n.name).join(" ");
    const overlap=want.filter(t=>have.includes(t)).length;
    const score=name===normalized?2:(overlap/Math.max(1,want.length)*0.75+overlap/Math.max(1,have.length)*0.25);
    return {n,score};
  }).filter(x=>x.score>=0.45).sort((a,b)=>b.score-a.score);
  if(!ranked.length)return undefined;
  if(ranked[0].score>=1.99)return ranked[0].n;
  // Never silently bind a requirement phrase when two nodes are similarly plausible.
  if(ranked[1]&&ranked[0].score-ranked[1].score<=0.08)return undefined;
  return ranked[0].n;
}
function splitTopLevelActions(clause:string): string[] {
  const cleaned=clause.replace(/[.]+$/g,"").trim();
  const parts=cleaned.split(/\s*,\s*|\s+and\s+(?=(?:create|assign|notify|email|message|alert|schedule|classify|escalate|route|send|check|verify|validate|update|save|store|call|request|obtain|extract|match|process|record|open|close)\b)/i).map(x=>x.trim()).filter(x=>STRUCTURE_VERBS.test(x));
  return parts;
}
function enforceHighConfidenceStructure(text:string, ir:WorkflowIR): {ir:WorkflowIR; warnings:string[]} {
  let nodes=ir.nodes.map(n=>({...n,config:{...n.config}})); let edges=ir.edges.map(e=>({...e})); const warnings:string[]=[]; const trigger=nodes.find(n=>n.type==="trigger"); if(!trigger)return {ir,warnings};
  const add=(source:string,target:string,branch:"DEFAULT"|"TRUE"|"FALSE")=>{if(!edges.some(e=>e.source===source&&e.target===target&&e.branch===branch))edges.push({source,target,branch});};
  const currentIr=()=>({...ir,nodes,edges});
  const slug=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,48)||"step";
  const inferType=(phrase:string):WorkflowIR["nodes"][number]["type"]=>{
    if(isCommunicationIntent(phrase)) return "notification";
    if(/\b(wait|delay|pause)\b/i.test(phrase)) return "delay";
    if(/\b(api|http|endpoint|webhook)\b/i.test(phrase)) return /webhook/i.test(phrase)?"webhook":"api";
    if(/\b(database|db|table|record|collection)\b/i.test(phrase)) return "database";
    if(/\bapproval|approve|authorization|authorisation\b/i.test(phrase)) return "approval";
    return "action";
  };
  const ensureExplicitNode=(phrase:string,allowed:Set<string>)=>{
    const existing=findNodeForPhrase(currentIr(),phrase,allowed); if(existing)return existing;
    if(!STRUCTURE_VERBS.test(phrase))return undefined;
    const type=inferType(phrase); if(!allowed.has(type))return undefined;
    let id=slug(phrase); let n=2; while(nodes.some(x=>x.id===id))id=`${slug(phrase)}_${n++}`;
    const name=phrase.replace(/^[,;\s]+|[,;.\s]+$/g,"").replace(/\b\w/g,c=>c.toUpperCase());
    const config=completeNodeConfig(type as any,name,`Explicitly required by the original instruction: ${phrase}`,{});
    const created={id,type,name,description:`Explicitly required by the original instruction: ${phrase}`,config} as WorkflowIR["nodes"][number];
    nodes.push(created); warnings.push(`Synthesized explicit required '${type}' node '${id}' because the model omitted the stated step.`); return created;
  };
  const sentences=text.replace(/\s+/g," ").split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean); const first=sentences[0]||"";
  if(sentences.length===1 && !/\b(if|else|otherwise|then|after|before|once\b.*\bcomplete)/i.test(first)){
    const m=first.match(/^(?:when|whenever|once|on)\s+.+?,\s*(.+)$/i); const actionClause=m?.[1]||""; const actions=splitTopLevelActions(actionClause); const actionTypes=new Set(["action","api","webhook","database","notification","delay"]);
    const matched=actions.map(a=>ensureExplicitNode(a,actionTypes)).filter(Boolean) as WorkflowIR["nodes"];
    const explicitParallel=/\b(in parallel|simultaneously|at the same time|concurrently)\b/i.test(actionClause);
    if(explicitParallel && matched.length>=2){
      const ids=new Set(matched.map(n=>n.id));
      edges=edges.filter(e=>!(ids.has(e.source)&&ids.has(e.target)) && !(e.source===trigger.id&&ids.has(e.target)));
      for(const n of matched)add(trigger.id,n.id,"DEFAULT");
      warnings.push(`Applied explicit parallel fan-out requested by the user: ${matched.map(n=>n.id).join(", ")}.`);
    } else if(matched.length>=2) {
      // Ordinary comma/"and" lists are ambiguous. Preserve them as one safe sequence instead
      // of inventing parallelism, which previously created orphan branches and accidental cycles.
      const ids=new Set(matched.map(n=>n.id));
      edges=edges.filter(e=>!(ids.has(e.source)&&ids.has(e.target)) && !(e.source===trigger.id&&ids.has(e.target)));
      add(trigger.id,matched[0].id,"DEFAULT");
      for(let j=1;j<matched.length;j++) add(matched[j-1].id,matched[j].id,"DEFAULT");
      warnings.push(`Canonicalized unordered action list as a safe sequence because parallel execution was not explicitly requested: ${matched.map(n=>n.id).join(" → ")}.`);
    }
  }
  for(let i=1;i<sentences.length;i++){
    const cm=sentences[i].match(/^if\s+(.+?)(?:,|\bthen\b)\s*(.+?)(?:\s*(?:,|;)\s*(?:else|otherwise)\s+(.+))?$/i); if(!cm)continue;
    const prevActions=splitTopLevelActions(sentences[i-1].replace(/^(?:when|whenever|once|on)\s+.+?,\s*/i,"")); const prev=prevActions.length?findNodeForPhrase(currentIr(),prevActions[prevActions.length-1],new Set(["action","api","webhook","database","notification","delay"])):undefined; let cond=findNodeForPhrase(currentIr(),cm[1],new Set(["condition"]));
    if(!cond){const conditions=nodes.filter(n=>n.type==="condition");if(conditions.length===1)cond=conditions[0];}
    if(!cond)continue;
    if(prev){edges=edges.filter(e=>!(e.target===cond.id&&e.source!==prev.id));add(prev.id,cond.id,"DEFAULT");}
    const allowed=new Set(["action","api","webhook","database","notification","delay","approval"]);
    const trueNodes=splitTopLevelActions(cm[2]).map(x=>ensureExplicitNode(x,allowed)).filter(Boolean) as WorkflowIR["nodes"];
    if(trueNodes[0]){edges=edges.filter(e=>!(e.source===cond.id&&e.branch==="TRUE"&&e.target!==trueNodes[0].id));add(cond.id,trueNodes[0].id,"TRUE");for(let j=1;j<trueNodes.length;j++)add(trueNodes[j-1].id,trueNodes[j].id,"DEFAULT");}
    const falseNodes=(cm[3]?splitTopLevelActions(cm[3]):[]).map(x=>ensureExplicitNode(x,allowed)).filter(Boolean) as WorkflowIR["nodes"];
    if(falseNodes[0]){edges=edges.filter(e=>!(e.source===cond.id&&e.branch==="FALSE"&&e.target!==falseNodes[0].id));add(cond.id,falseNodes[0].id,"FALSE");for(let j=1;j<falseNodes.length;j++)add(falseNodes[j-1].id,falseNodes[j].id,"DEFAULT");}
    if(prev||trueNodes.length||falseNodes.length)warnings.push(`Applied high-confidence conditional anchoring around '${cond.id}', including multi-step branch sequences.`);
  }
  // A singular natural-language trigger must not silently become multiple workflow entry points.
  // Small models occasionally mis-type action steps such as "Schedule Onboarding" as triggers.
  const triggerNodes=nodes.filter(n=>n.type==="trigger");
  const explicitMultiTrigger=/\b(multiple triggers|either when|when .+ or when|on either|separate triggers)\b/i.test(text);
  if(triggerNodes.length>1 && !explicitMultiTrigger){
    const intro=(text.match(/^(?:when|whenever|once|on)\s+(.+?)(?:,|\.)/i)?.[1]||"").trim();
    const scored=triggerNodes.map(n=>({n,score:phraseTokens(intro).filter(t=>new Set(phraseTokens(`${n.name} ${n.description}`)).has(t)).length})).sort((a,b)=>b.score-a.score);
    const keeper=scored[0]?.n||triggerNodes[0];
    for(const extra of triggerNodes.filter(n=>n.id!==keeper.id)){
      const inferred=inferType(`${extra.name} ${extra.description||""}`);
      extra.type=inferred==="approval"?"action":inferred;
      extra.config=completeNodeConfig(extra.type as any,extra.name,extra.description||"",extra.config||{});
      warnings.push(`Corrected extra trigger '${extra.id}' to '${extra.type}' because the requirement defines one entry event.`);
    }
  }
  return {ir:{...ir,nodes,edges},warnings};
}

function completenessProblems(ir: WorkflowIR, normalization?: NormalizationReport, originalText = ""): string[] {
  const problems: string[] = [];
  const byId = new Map(ir.nodes.map(n => [n.id, n]));
  const outgoing = new Map<string, WorkflowIR["edges"]>();
  const incoming = new Map<string, WorkflowIR["edges"]>();
  for (const node of ir.nodes) incoming.set(node.id, []);
  for (const edge of ir.edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source)!.push(edge);
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    incoming.get(edge.target)!.push(edge);
    if (!byId.has(edge.source)) problems.push(`edge source '${edge.source}' is undefined`);
    if (!byId.has(edge.target)) problems.push(`edge target '${edge.target}' is undefined`);
  }
  for (const node of ir.nodes) {
    const branches = new Set((outgoing.get(node.id) || []).map(e => e.branch));
    if (node.type !== "trigger" && !(incoming.get(node.id) || []).length) problems.push(`node '${node.id}' is orphaned with no incoming connection`);
    if (node.type === "condition") {
      const outs = outgoing.get(node.id) || [];
      if (!branches.has("TRUE")) problems.push(`condition '${node.id}' is missing TRUE branch`);
      if (!branches.has("FALSE")) problems.push(`condition '${node.id}' is missing FALSE branch`);
      if (outs.filter(e => e.branch === "TRUE").length > 1) problems.push(`condition '${node.id}' has duplicate TRUE branches`);
      if (outs.filter(e => e.branch === "FALSE").length > 1) problems.push(`condition '${node.id}' has duplicate FALSE branches`);
    }
    if (node.type === "approval") {
      if (!branches.has("APPROVED")) problems.push(`approval '${node.id}' is missing APPROVED branch`);
      if (!branches.has("REJECTED")) problems.push(`approval '${node.id}' is missing REJECTED branch`);
    }
    const terminalCapable = ["end","action","api","webhook","database","notification"].includes(node.type);
    if (!terminalCapable && !(outgoing.get(node.id) || []).length) problems.push(`node '${node.id}' is an unsafe dead end`);
  }
  if (!ir.nodes.some(n => n.type === "trigger")) problems.push("workflow has no trigger node");
  if (normalization?.synthesizedNodeIds?.length) problems.push(`model omitted definitions for nodes synthesized during normalization: ${normalization.synthesizedNodeIds.join(", ")}`);
  if (originalText) {
    problems.push(...requirementPlanProblems(originalText, ir));
    problems.push(...sharedProblems(originalText, ir.nodes, ir.edges));
  }
  return [...new Set(problems)];
}

function candidateScore(ir: WorkflowIR, normalization: NormalizationReport, problems: string[]): number {
  // Problems dominate scoring; among similarly complete candidates, preserve richer explicit graphs
  // and penalize nodes synthesized by FlowForge rather than supplied by the model.
  return (ir.nodes.length * 4) + (ir.edges.length * 2) - (problems.length * 30) - ((normalization.synthesizedNodeIds?.length || 0) * 8);
}

async function requestCompletion(text: string, mode: GenerationMode, provider?: LLMProviderKind, regenerationContext?: { draft: WorkflowIR; problems: string[] }): Promise<string> {
  const config = getLLMProviderConfig(provider);
  const modelId = await resolveConfiguredModel(config);
  const profile=classifyWorkflowProfile(text);
  const system = mode === "dsl" ? PLANNER_DSL_PROMPT : profile.profile === "normal" ? NORMAL_PLANNER_SYSTEM_PROMPT : PLANNER_SYSTEM_PROMPT;
  const user = regenerationContext
    ? `Your previous workflow is incomplete. Return the COMPLETE workflow again, not a patch.\nProblems:\n- ${regenerationContext.problems.join("\n- ")}\n\nPrevious normalized draft:\n${JSON.stringify(regenerationContext.draft)}\n\nOriginal user process:\n${text}`
    : `CURRENT USER PROCESS:\n${text}`;

  const body: any = {
    model: modelId,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    temperature: 0,
    top_p: 0.9,
    max_tokens: plannerTokenBudget(provider),
    stream: false,
  };
  if (mode === "json-schema") {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "flowforge_workflow", strict: true, schema: WORKFLOW_JSON_SCHEMA },
    };
  }

  try {
    const result = await callConfiguredLLM({
      system,
      user,
      maxTokens: plannerTokenBudget(provider),
      temperature: 0,
      topP: 0.9,
      responseFormat: body.response_format,
      provider,
    });
    if (result.finishReason === "length") throw new Error(`${result.provider} reached the ${plannerTokenBudget(provider)}-token planner output limit before finishing the workflow.`);
    return result.content;
  } catch (error: any) {
    if (/HTTP 400|response_format|json_schema|grammar|structured/i.test(String(error?.message || error))) error.status = error.status || 400;
    throw error;
  }
}

async function generateRaw(text: string, provider?: LLMProviderKind, regenerationContext?: { draft: WorkflowIR; problems: string[] }): Promise<{ raw: unknown; mode: GenerationMode }> {
  const structuredMode = configuredStructuredOutputMode(provider);
  const canTryStructured = structuredMode !== "off" && structuredOutputSupported !== false;
  if (canTryStructured) {
    try {
      const content = await requestCompletion(text, "json-schema", provider, regenerationContext);
      structuredOutputSupported = true;
      return { raw: parseJsonContent(content), mode: "json-schema" };
    } catch (error: any) {
      if (structuredMode === "on") throw error;
      if (error?.status === 400 || /response_format|json_schema|grammar|structured/i.test(String(error?.message || error))) {
        structuredOutputSupported = false;
      } else if (!regenerationContext) {
        // A generation/parse failure can still recover through the prompt-only route.
      }
    }
  }

  try {
    const content = await requestCompletion(text, "json-prompt", provider, regenerationContext);
    return { raw: parseJsonContent(content), mode: "json-prompt" };
  } catch (jsonError) {
    // Final non-JSON representation: a line-oriented graph DSL that is easier for small local models.
    const content = await requestCompletion(text, "dsl", provider, regenerationContext);
    return { raw: parseDsl(content), mode: "dsl" };
  }
}

function normalizeAndValidate(raw: unknown): { ir: WorkflowIR; normalization: NormalizationReport } {
  const direct = WorkflowIRSchema.safeParse(raw);
  if (direct.success) return { ir: direct.data, normalization: { warnings: [], synthesizedNodeIds: [], sourceShape: "canonical" } };
  const normalized = normalizeWorkflowIR(raw);
  const parsed = WorkflowIRSchema.safeParse(normalized.ir);
  if (!parsed.success) {
    const problems = parsed.error.issues.slice(0, 12).map(i => `${i.path.join(".") || "root"}: ${i.message}`).join("; ");
    throw new Error(`FlowForge could not normalize the model output into Workflow IR: ${problems}`);
  }
  return { ir: parsed.data, normalization: normalized.report };
}


async function plan(text: string, provider?: LLMProviderKind): Promise<{ ir: WorkflowIR; normalization: NormalizationReport; mode: GenerationMode; repaired: boolean }> {
  const firstGeneration=await generateRaw(text,provider);
  const firstRaw=normalizeAndValidate(firstGeneration.raw);
  const firstStructured=enforceHighConfidenceStructure(text,firstRaw.ir);
  const firstMapped=attachRequirementMappings(text,firstStructured.ir);
  const first={ir:firstMapped,normalization:{...firstRaw.normalization,warnings:[...firstStructured.warnings,...firstRaw.normalization.warnings]}};
  const firstProblems=completenessProblems(first.ir,first.normalization,text);
  if(!firstProblems.length)return {...first,mode:firstGeneration.mode,repaired:false};

  // One clean full regeneration. Never patch an incomplete initial graph.
  try{
    const secondGeneration=await generateRaw(text,provider,{draft:first.ir,problems:firstProblems});
    const secondRaw=normalizeAndValidate(secondGeneration.raw);
    const secondStructured=enforceHighConfidenceStructure(text,secondRaw.ir);
    const secondMapped=attachRequirementMappings(text,secondStructured.ir);
    const second={ir:secondMapped,normalization:{...secondRaw.normalization,warnings:["Initial candidate failed deterministic completeness; regenerated the complete workflow from the original requirement.",...secondStructured.warnings,...secondRaw.normalization.warnings]}};
    const secondProblems=completenessProblems(second.ir,second.normalization,text);
    if(!secondProblems.length)return {...second,mode:secondGeneration.mode,repaired:true};
    const firstScore=candidateScore(first.ir,first.normalization,firstProblems),secondScore=candidateScore(second.ir,second.normalization,secondProblems);
    const best=secondScore>=firstScore?second:first;
    const problems=secondScore>=firstScore?secondProblems:firstProblems;
    best.normalization.warnings.unshift(`Planner regeneration still has unresolved deterministic issue(s): ${problems.join("; ")}. Verification must not certify it.`);
    return {...best,mode:secondScore>=firstScore?secondGeneration.mode:firstGeneration.mode,repaired:secondScore>=firstScore};
  }catch(error){
    first.normalization.warnings.unshift(`Full planner regeneration failed; initial candidate remains unverified. ${error instanceof Error?error.message:String(error)}`);
    return {...first,mode:firstGeneration.mode,repaired:false};
  }
}

export const planWorkflowWithLocalLLM = createServerFn({ method: "POST" })
  .validator(WorkflowPlanRequestSchema)
  .handler(async ({ data }) => {
    const startedAt = Date.now();
    // v5-style understanding path: the selected model is always given the first chance to
    // understand the requirement and generate the requirement plan + graph. Deterministic
    // templates are fallback-only; they never bypass LM Studio/NVIDIA during a healthy run.
    try {
      const result = await plan(data.text, data.provider);
      return {
        ir: result.ir,
        normalization: result.normalization,
        provider: getLLMProviderConfig(data.provider).label,
        model: await resolveConfiguredModel(getLLMProviderConfig(data.provider)),
        generationMode: result.mode,
        repairPassUsed: result.repaired,
        fallbackUsed: false,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      // Judge-safe recovery: the live AI remains the primary planner, but a provider outage,
      // malformed response, or local-model failure must not kill the prototype demonstration.
      const ir = attachRequirementMappings(data.text, buildDemoSafeWorkflow(data.text));
      return {
        ir,
        normalization: { warnings: [`Demo-safe fallback activated: ${error instanceof Error ? error.message : String(error)}`], synthesizedNodeIds: [], sourceShape: "demo-safe-fallback" },
        provider: "FlowForge Demo-Safe Compiler",
        model: "Deterministic fallback",
        generationMode: "fallback" as const,
        repairPassUsed: false,
        fallbackUsed: true,
        durationMs: Date.now() - startedAt,
      };
    }
  });
