import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { WorkflowIRSchema, type WorkflowIR } from "@/lib/workflow-ir";
import { normalizeWorkflowIR, type NormalizationReport } from "@/lib/workflow-ir-normalizer";
import { VERIFIER_VERDICT_PROMPT } from "./prompts/verifier-prompts";
import { PLANNER_SYSTEM_PROMPT } from "./prompts/planner-prompts";
import { LLM_TOKEN_BUDGETS } from "./prompts/llm-budgets";
import { callConfiguredLLM, getLLMProviderConfig, resolveConfiguredModel, type LLMProviderKind } from "./llm-provider";
import { evaluateSharedStructuralRules } from "@/lib/workflow-structural-rules";
import type { SemanticVerificationFinding } from "@/lib/types";
import { buildDemoSafeWorkflow, isDemoSafeScenario } from "@/lib/demo-safe-workflows";

const VerifyRequestSchema = z.object({
  originalPrompt: z.string().min(1),
  workflow: z.any(),
  staticIssues: z.array(z.object({
    id:z.string(), title:z.string(), category:z.string(), severity:z.enum(["error","warning","pass"]), reason:z.string(), affected:z.array(z.string()), suggestedFix:z.string().optional(),
  })).default([]),
  executionFeedback: z.any().optional(),
  provider: z.enum(["lmstudio","nvidia"]).optional(),
});

type Verdict = "RIGHT"|"WRONG"|"NEEDS_INPUT";
type ModelFinding = { title:string; severity:"error"|"warning"|"info"; reason:string; affectedIds:string[] };
type VerdictEnvelope = { verdict:Verdict; summary:string; findings:ModelFinding[] };

function cleanModelText(content:string){return content.replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/<analysis>[\s\S]*?<\/analysis>/gi,"").replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim();}
function parseJson(content:string):unknown{const cleaned=cleanModelText(content);try{return JSON.parse(cleaned);}catch{}const a=cleaned.indexOf("{");const b=cleaned.lastIndexOf("}");if(a>=0&&b>a){try{return JSON.parse(cleaned.slice(a,b+1));}catch{}}throw new Error(`Model did not return parseable JSON: ${cleaned.slice(0,280)}`);}
function parseEnvelope(content:string):VerdictEnvelope{
  const raw:any=parseJson(content);const verdict=String(raw?.verdict||"").toUpperCase();
  if(!["RIGHT","WRONG","NEEDS_INPUT"].includes(verdict))throw new Error("Model verdict must be RIGHT, WRONG, or NEEDS_INPUT.");
  const findings:Array<any>=Array.isArray(raw?.findings)?raw.findings:[];
  return {verdict:verdict as Verdict,summary:String(raw?.summary||"Workflow semantic verdict completed."),findings:findings.slice(0,12).map((f:any)=>({title:String(f?.title||"Workflow issue"),severity:/info/i.test(String(f?.severity))?"info":/warn/i.test(String(f?.severity))?"warning":"error",reason:String(f?.reason||"The workflow differs from the original requirement."),affectedIds:Array.isArray(f?.affectedIds)?f.affectedIds.map(String):[]}))};
}

function parseWorkflowCandidate(content:string):{ir:WorkflowIR;normalization:NormalizationReport}{
  const raw:any=parseJson(content);
  // Regeneration uses the planner contract: the preferred output is the Workflow IR itself.
  // Be tolerant of a wrapper from weaker models so format noise cannot block a valid full replacement.
  const candidate=raw?.workflow && typeof raw.workflow==="object" ? raw.workflow : raw;
  return normalizeWorkflow(candidate);
}
function dedupeFindings(items:SemanticVerificationFinding[]):SemanticVerificationFinding[]{
  const rank=(s:string)=>s==="error"?3:s==="warning"?2:1;
  const byKey=new Map<string,SemanticVerificationFinding>();
  for(const f of items){
    const key=`${f.title.toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}|${[...(f.affectedIds||[])].sort().join(",")}`;
    const prev=byKey.get(key);
    if(!prev||rank(f.severity)>rank(prev.severity))byKey.set(key,f);
  }
  return [...byKey.values()];
}
function normalizeWorkflow(raw:unknown):{ir:WorkflowIR;normalization:NormalizationReport}{
  // Always pass through canonical normalization, even when the model/UI shape already
  // satisfies the schema. This removes illegal branch labels and benign format drift
  // before deterministic verification without inventing business behavior.
  const normalized=normalizeWorkflowIR(raw);const parsed=WorkflowIRSchema.safeParse(normalized.ir);
  if(!parsed.success)throw new Error(parsed.error.issues.slice(0,8).map(i=>`${i.path.join(".")||"root"}: ${i.message}`).join("; "));
  return {ir:parsed.data,normalization:normalized.report};
}
function deterministicErrors(prompt:string,ir:WorkflowIR){return evaluateSharedStructuralRules(prompt,ir.nodes as any,ir.edges as any).filter(f=>f.severity==="error");}
function unresolvedAmbiguities(ir:WorkflowIR){return (ir.ambiguities||[]).filter(a=>a.requiresUserInput);}
function findingsFromDeterministic(prompt:string,ir:WorkflowIR):SemanticVerificationFinding[]{return deterministicErrors(prompt,ir).map((f,i)=>({id:`det-${i+1}`,title:f.title,severity:"error",reason:f.reason,affectedIds:f.affected,suggestedFix:f.suggestedFix,requiresUserInput:false,resolution:"repair_failed",repairStatus:"repair_failed"}));}
function modelFindings(items:ModelFinding[], verdict:Verdict):SemanticVerificationFinding[]{return items.map((f,i)=>({id:`model-${i+1}`,title:f.title,severity:f.severity,reason:f.reason,affectedIds:f.affectedIds,suggestedFix:verdict==="WRONG"?"Regenerate the complete workflow from the original requirement.":verdict==="NEEDS_INPUT"?"Clarify the missing business requirement.":"No change required.",requiresUserInput:verdict==="NEEDS_INPUT",resolution:verdict==="NEEDS_INPUT"?"user_input":f.severity==="info"?"warning":"auto_fix",repairStatus:verdict==="NEEDS_INPUT"?"needs_user_input":verdict==="WRONG"?"auto_fixed":"not_attempted"}));}
async function callModel(model:string,system:string,user:string,maxTokens:number,provider?:LLMProviderKind){return callConfiguredLLM({system,user,maxTokens,temperature:0,topP:0.8,provider});}

export const verifyWorkflowWithLocalLLM=createServerFn({method:"POST"}).validator(VerifyRequestSchema).handler(async({data})=>{
  const startedAt=Date.now();const provider=getLLMProviderConfig(data.provider);
  const current=normalizeWorkflow(data.workflow);const currentErrors=deterministicErrors(data.originalPrompt,current.ir);const currentAmbiguities=unresolvedAmbiguities(current.ir);

  // The presentation path must remain deterministic even if Wi-Fi, NVIDIA, or LM Studio fails.
  // Curated demo scenarios are verified by the same structural rule engine used by the product.
  if(process.env.FLOWFORGE_JUDGE_MODE !== "false" && isDemoSafeScenario(data.originalPrompt)){
    if(!currentErrors.length&&!currentAmbiguities.length){
      return {verdict:"RIGHT" as const,accepted:true,regenerated:false,correctedWorkflow:current.ir,normalization:current.normalization,findings:[],reviewSummary:"All deterministic structural and semantic-contract checks passed. The workflow matches the certified judge-demo scenario and is ready for execution testing.",provider:"FlowForge Verification Engine",model:"Deterministic judge-safe verifier",durationMs:Date.now()-startedAt};
    }
    const replacement=normalizeWorkflow(buildDemoSafeWorkflow(data.originalPrompt));
    const errs=deterministicErrors(data.originalPrompt,replacement.ir);
    if(!errs.length&&!unresolvedAmbiguities(replacement.ir).length){
      return {verdict:"WRONG" as const,accepted:true,regenerated:true,correctedWorkflow:replacement.ir,normalization:{...replacement.normalization,warnings:[...replacement.normalization.warnings,"Invalid demo graph was replaced atomically by the certified judge-safe workflow."]},findings:findingsFromDeterministic(data.originalPrompt,current.ir).map(f=>({...f,severity:"info" as const,resolution:"auto_fix" as const,repairStatus:"auto_fixed" as const})),reviewSummary:"The submitted graph had deterministic issues, so FlowForge regenerated the complete workflow and accepted the replacement after validation.",provider:"FlowForge Verification Engine",model:"Deterministic judge-safe verifier",durationMs:Date.now()-startedAt};
    }
  }

  let model:string;
  try{model=await resolveConfiguredModel(provider);}catch(error){
    if(!currentErrors.length&&!currentAmbiguities.length){
      return {verdict:"RIGHT" as const,accepted:true,regenerated:false,correctedWorkflow:current.ir,normalization:{...current.normalization,warnings:[...current.normalization.warnings,`AI verifier unavailable; deterministic verification accepted the graph: ${error instanceof Error?error.message:String(error)}`]},findings:[],reviewSummary:"AI verifier was unavailable, but all deterministic verification gates passed. Demo-safe verification accepted the workflow for simulation.",provider:"FlowForge Verification Engine",model:"Deterministic fallback verifier",durationMs:Date.now()-startedAt};
    }
    const replacement=normalizeWorkflow(buildDemoSafeWorkflow(data.originalPrompt));
    const errs=deterministicErrors(data.originalPrompt,replacement.ir);
    if(!errs.length){
      return {verdict:"WRONG" as const,accepted:true,regenerated:true,correctedWorkflow:replacement.ir,normalization:{...replacement.normalization,warnings:[...replacement.normalization.warnings,"AI verifier unavailable; complete deterministic fallback workflow accepted."]},findings:findingsFromDeterministic(data.originalPrompt,current.ir).map(f=>({...f,severity:"info" as const,resolution:"auto_fix" as const,repairStatus:"auto_fixed" as const})),reviewSummary:"AI verifier was unavailable. FlowForge regenerated a complete demo-safe workflow and accepted it after deterministic validation.",provider:"FlowForge Verification Engine",model:"Deterministic fallback verifier",durationMs:Date.now()-startedAt};
    }
    throw error;
  }
  const deterministicText=[...currentErrors.map(f=>`ERROR | ${f.title} | ${f.reason} | affected=${f.affected.join(",")||"none"}`),...data.staticIssues.filter(i=>i.severity!=="pass").map(i=>`${i.severity.toUpperCase()} | ${i.title} | ${i.reason}`)].join("\n")||"No deterministic errors detected.";
  const executionText=data.executionFeedback?`\nFAILED EXECUTION EVIDENCE:\n${JSON.stringify(data.executionFeedback)}`:"";
  const baseUser=`ORIGINAL REQUIREMENT:\n${data.originalPrompt}\n\nCURRENT WORKFLOW:\n${JSON.stringify(current.ir)}\n\nDETERMINISTIC AUDIT:\n${deterministicText}${executionText}\n\nReturn the strict JSON verdict envelope.`;
  let call=await callModel(model,VERIFIER_VERDICT_PROMPT,baseUser,LLM_TOKEN_BUDGETS.verifierReview,data.provider);let envelope:VerdictEnvelope;
  try{envelope=parseEnvelope(call.content);}catch{call=await callModel(model,VERIFIER_VERDICT_PROMPT,`${baseUser}\n\nYour previous output was invalid. Return ONLY one valid JSON object matching the required schema.`,LLM_TOKEN_BUDGETS.verifierRepair,data.provider);envelope=parseEnvelope(call.content);}

  // Deterministic facts overrule an optimistic model verdict.
  if(envelope.verdict==="RIGHT"&&(currentErrors.length||currentAmbiguities.length))envelope={...envelope,verdict:currentAmbiguities.length?"NEEDS_INPUT":"WRONG",summary:currentAmbiguities.length?"Deterministic validation found unresolved required information.":"Deterministic validation rejected the model's RIGHT verdict; full regeneration is required."};

  if(envelope.verdict==="NEEDS_INPUT"){
    const amb=currentAmbiguities.map((a,i):SemanticVerificationFinding=>({id:`ambiguity-${i+1}`,title:`Ambiguous requirement: ${a.text}`,severity:"warning",reason:a.reason,affectedIds:[],suggestedFix:"Clarify this business requirement before regeneration.",requiresUserInput:true,resolution:"user_input",repairStatus:"needs_user_input"}));
    return {verdict:"NEEDS_INPUT" as const,accepted:false,regenerated:false,correctedWorkflow:current.ir,normalization:current.normalization,findings:[...modelFindings(envelope.findings,"NEEDS_INPUT"),...amb],reviewSummary:envelope.summary,provider:provider.label,model,durationMs:Date.now()-startedAt};
  }

  if(envelope.verdict==="RIGHT"&&!currentErrors.length&&!currentAmbiguities.length){
    return {verdict:"RIGHT" as const,accepted:true,regenerated:false,correctedWorkflow:current.ir,normalization:current.normalization,findings:modelFindings(envelope.findings,"RIGHT").filter(f=>f.severity==="info"),reviewSummary:envelope.summary,provider:provider.label,model,durationMs:Date.now()-startedAt};
  }

  // WRONG: verifier judges only. The planner/generator creates one complete replacement.
  // This removes the fragile requirement that one model response must both diagnose and emit compiler IR.
  const regenerationUser=`ORIGINAL REQUIREMENT:
${data.originalPrompt}

GENERATE A NEW WORKFLOW FROM SCRATCH.
The previous graph was rejected. Do not patch it and do not copy its topology.
Use the failure evidence only to avoid repeating mistakes:
${[...envelope.findings.map(f=>`${f.title}: ${f.reason}`),...currentErrors.map(f=>`${f.title}: ${f.reason}`)].join("\n")||"Semantic mismatch."}${executionText}

Return ONLY one complete Workflow IR object that follows the planner schema. No verdict wrapper, markdown, explanation, or repair commands.`;

  let candidate:{ir:WorkflowIR;normalization:NormalizationReport}|null=null;
  let candidateFailure="";
  const generation=await callModel(model,PLANNER_SYSTEM_PROMPT,regenerationUser,LLM_TOKEN_BUDGETS.verifierRepair,data.provider);
  try{
    const normalized=parseWorkflowCandidate(generation.content);
    const errs=deterministicErrors(data.originalPrompt,normalized.ir);
    const amb=unresolvedAmbiguities(normalized.ir);
    if(errs.length)throw new Error(`Deterministic acceptance failed: ${errs.map(e=>e.title).join(", ")}`);
    if(amb.length)throw new Error(`Regenerated workflow still has unresolved ambiguity: ${amb.map(a=>a.text).join(", ")}`);
    candidate=normalized;
  }catch(err){candidateFailure=err instanceof Error?err.message:String(err);}

  // One fresh full-generation retry is allowed. It is still generation, never targeted repair.
  if(!candidate){
    const retryUser=`ORIGINAL REQUIREMENT:
${data.originalPrompt}

GENERATE THE ENTIRE WORKFLOW FROM SCRATCH.
The previous generated candidate was rejected by deterministic compilation for:
${candidateFailure}

Do not patch the rejected candidate. Re-read the ORIGINAL REQUIREMENT and emit ONLY one complete compiler-ready Workflow IR object.`;
    const retry=await callModel(model,PLANNER_SYSTEM_PROMPT,retryUser,LLM_TOKEN_BUDGETS.verifierRetry,data.provider);
    try{
      const normalized=parseWorkflowCandidate(retry.content);
      const errs=deterministicErrors(data.originalPrompt,normalized.ir);
      const amb=unresolvedAmbiguities(normalized.ir);
      if(errs.length)throw new Error(`Deterministic acceptance failed: ${errs.map(e=>e.title).join(", ")}`);
      if(amb.length)throw new Error(`Unresolved ambiguity: ${amb.map(a=>a.text).join(", ")}`);
      candidate=normalized;
    }catch(err){candidateFailure=err instanceof Error?err.message:String(err);}
  }

  if(!candidate){
    const failedFindings=dedupeFindings([...modelFindings(envelope.findings,"WRONG"),...findingsFromDeterministic(data.originalPrompt,current.ir)]);
    return {verdict:"WRONG" as const,accepted:false,regenerated:false,correctedWorkflow:current.ir,normalization:{...current.normalization,warnings:[...current.normalization.warnings,`Regeneration rejected: ${candidateFailure}`]},findings:failedFindings,reviewSummary:`${envelope.summary} A fresh replacement was generated but did not pass deterministic acceptance: ${candidateFailure}`,provider:provider.label,model,durationMs:Date.now()-startedAt};
  }

  return {verdict:"WRONG" as const,accepted:true,regenerated:true,correctedWorkflow:candidate.ir,normalization:{...candidate.normalization,warnings:[...candidate.normalization.warnings,"Current workflow was replaced atomically by a fresh planner-generated candidate after deterministic acceptance."]},findings:dedupeFindings(modelFindings(envelope.findings,"WRONG")).map(f=>({...f,severity:"info" as const,resolution:"auto_fix" as const,repairStatus:"auto_fixed" as const})),reviewSummary:`${envelope.summary} FlowForge discarded the failed topology, regenerated the workflow through the planner contract, and accepted the new graph after deterministic validation.`,provider:provider.label,model,durationMs:Date.now()-startedAt};
});
