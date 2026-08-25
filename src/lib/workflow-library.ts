import type { Edge } from "@xyflow/react";
import type { DetectedStage, NLPAnalysis, WorkflowStatus } from "./types";
import type { GeneratedTestCase } from "./workflow-engine";
import type { WFNode } from "./workflow-store";

export const FLOWFORGE_FILE_FORMAT = "flowforge.workflow";
export const FLOWFORGE_FILE_VERSION = 1;
const STORAGE_KEY = "flowforge-certified-workflows-v1";

export interface CertifiedTestResult {
  testId: string;
  testName: string;
  passed: true;
  reason: string;
  path: string[];
  terminal?: string;
}

export interface SavedWorkflow {
  format: typeof FLOWFORGE_FILE_FORMAT;
  formatVersion: typeof FLOWFORGE_FILE_VERSION;
  id: string;
  name: string;
  version: string;
  sourcePrompt: string;
  status: "VERIFIED";
  createdAt: number;
  certifiedAt: number;
  verification: {
    score: number;
    verifiedAt: number;
    phases: { structure: "pass"; semantics: "pass"; execution: "pass" };
  };
  analysis: NLPAnalysis | null;
  stages: DetectedStage[];
  nodes: WFNode[];
  edges: Edge[];
  tests: GeneratedTestCase[];
  certificationResults: CertifiedTestResult[];
  compilerNotes: string[];
}

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function listSavedWorkflows(): SavedWorkflow[] {
  const s=storage(); if(!s)return [];
  try { const parsed=JSON.parse(s.getItem(STORAGE_KEY)||"[]"); return Array.isArray(parsed)?parsed.filter(isSavedWorkflow):[]; } catch { return []; }
}

export function saveCertifiedWorkflow(record: SavedWorkflow): SavedWorkflow {
  const s=storage(); if(!s)return record;
  const current=listSavedWorkflows();
  const next=[record,...current.filter(x=>x.id!==record.id)].slice(0,100);
  s.setItem(STORAGE_KEY,JSON.stringify(next));
  return record;
}

export function getSavedWorkflow(id:string){ return listSavedWorkflows().find(x=>x.id===id)||null; }
export function deleteSavedWorkflow(id:string){const s=storage();if(!s)return; s.setItem(STORAGE_KEY,JSON.stringify(listSavedWorkflows().filter(x=>x.id!==id)));}

export function isSavedWorkflow(x:any): x is SavedWorkflow {
  return Boolean(x&&x.format===FLOWFORGE_FILE_FORMAT&&x.formatVersion===FLOWFORGE_FILE_VERSION&&typeof x.id==="string"&&Array.isArray(x.nodes)&&Array.isArray(x.edges)&&Array.isArray(x.tests)&&x.verification?.phases?.execution==="pass");
}

export function downloadWorkflowFile(record:SavedWorkflow){
  if(typeof window==="undefined")return;
  const blob=new Blob([JSON.stringify(record,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");
  const safe=(record.name||"workflow").replace(/[^a-z0-9-_]+/gi,"-").replace(/^-+|-+$/g,"").toLowerCase()||"workflow";
  a.href=url;a.download=`${safe}.flowforge.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

export function importWorkflowFileText(text:string): SavedWorkflow {
  const parsed=JSON.parse(text);
  if(!isSavedWorkflow(parsed))throw new Error("Invalid or uncertified FlowForge workflow file.");
  saveCertifiedWorkflow(parsed);return parsed;
}
