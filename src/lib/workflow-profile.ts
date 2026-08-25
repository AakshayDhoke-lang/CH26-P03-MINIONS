import type { WorkflowIR } from "./workflow-ir";

export type WorkflowComplexityProfile = "normal" | "advanced";

export interface WorkflowProfile {
  profile: WorkflowComplexityProfile;
  reasons: string[];
  explicitParallel: boolean;
  loopIntent: boolean;
  integrationHeavy: boolean;
}

/**
 * Normal mode intentionally covers the common business workflows FlowForge should
 * solve reliably: sequence + conditions + approvals + notifications + simple delays.
 * Advanced mode is reserved for features whose semantics genuinely require the
 * heavier rule/reconstruction machinery.
 */
export function classifyWorkflowProfile(prompt:string):WorkflowProfile {
  const text=String(prompt||"");
  const explicitParallel=/\b(in parallel|parallel(?:ly)?|simultaneously|concurrently|at the same time|after both|after all(?: branches| tasks| actions)?)\b/i.test(text);
  const loopIntent=/\b(repeat|repeating|retry|again|keep checking|keep repeating|continue until|until|while|loop)\b/i.test(text);
  const integrationHeavy=/\b(webhook|api endpoint|rest api|http request|database|firestore|postgres|postgresql|mysql|mongodb|sql query)\b/i.test(text);
  const reasons:string[]=[];
  if(explicitParallel)reasons.push("explicit parallel/Join semantics");
  if(loopIntent)reasons.push("explicit loop/retry semantics");
  if(integrationHeavy)reasons.push("external integration semantics");
  return {profile:reasons.length?"advanced":"normal",reasons,explicitParallel,loopIntent,integrationHeavy};
}

export function isDeterministicallyCleanForNormalWorkflow(
  prompt:string,
  ir:WorkflowIR,
  sharedFindings:{severity:string;category?:string;title?:string}[],
  structuralProblems:string[],
){
  const profile=classifyWorkflowProfile(prompt);
  if(profile.profile!=="normal")return false;
  if(structuralProblems.length)return false;
  if(sharedFindings.some(f=>f.severity==="error"))return false;
  if(sharedFindings.some(f=>f.severity==="warning"&&/user input|required|ambiguous|contradiction/i.test(`${f.category||""} ${f.title||""}`)))return false;
  if((ir.ambiguities||[]).some(a=>a.requiresUserInput))return false;
  return true;
}
