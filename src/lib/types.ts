export type NodeKind =
  | "trigger"
  | "action"
  | "condition"
  | "approval"
  | "api"
  | "webhook"
  | "database"
  | "notification"
  | "delay"
  | "join"
  | "end";

export type NodeRunStatus = "idle" | "waiting" | "running" | "completed" | "failed" | "paused";

export interface WorkflowNodeProvenance {
  source: "explicit" | "derived" | "deterministic" | "model_proposed";
  requirementRefs: string[];
  confidence: "high" | "medium" | "low";
}

export interface WorkflowNodeData extends Record<string, unknown> {
  kind: NodeKind;
  name: string;
  subtitle?: string;
  status: NodeRunStatus;
  issue?: string | null;
  scanning?: boolean;
  config?: Record<string, string>;
  provenance?: WorkflowNodeProvenance;
}

export type WorkflowStatus = "DRAFT" | "VERIFIED" | "ISSUES FOUND" | "NEEDS USER INPUT" | "RUNNING";

export interface WorkflowSummary {
  id: string;
  name: string;
  status: WorkflowStatus;
  nodes: number;
  lastExecution: string;
  successRate: number;
  version: string;
  description: string;
}

export type IssueSeverity = "error" | "warning" | "pass";

export interface VerificationIssue {
  id: string;
  title: string;
  category: string;
  severity: IssueSeverity;
  reason: string;
  affected: string[];
  suggestedFix: string;
  fixPreview?: string[];
  resolved?: boolean;
}

export interface ExecutionEvent {
  time: string;
  message: string;
  detail?: string;
  level?: "info" | "success" | "warning" | "error";
}

export interface ExecutionRecord {
  id: string;
  workflow: string;
  status: "Completed" | "Failed" | "Running" | "Awaiting approval";
  startedAt: string;
  duration: string;
  nodes: number;
}

export interface PolicyRule {
  range: string;
  role: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
}

export interface NLPAnalysis {
  trigger: string;
  actors: string[];
  variables: string[];
  conditions: string[];
  actions: string[];
}

export interface DetectedStage {
  id: string;
  kind: NodeKind;
  type: string;
  name: string;
}


export interface SemanticVerificationFinding {
  id: string;
  title: string;
  severity: "error" | "warning" | "info";
  reason: string;
  affectedIds: string[];
  suggestedFix: string;
  requiresUserInput?: boolean;
  resolution?: "auto_fix" | "repair_failed" | "repair_rejected" | "user_input" | "warning";
  repairStatus?: "auto_fixed" | "repair_failed" | "repair_rejected" | "needs_user_input" | "not_attempted";
}

export interface WorkflowDiffItem {
  kind: "node" | "edge";
  change: "added" | "removed" | "modified";
  id: string;
  label: string;
  detail: string;
}

export interface SemanticVerificationProposal {
  reviewSummary: string;
  findings: SemanticVerificationFinding[];
  diff: WorkflowDiffItem[];
  correctedWorkflow: import("./workflow-ir").WorkflowIR;
  provider: string;
  model: string;
  durationMs: number;
}
