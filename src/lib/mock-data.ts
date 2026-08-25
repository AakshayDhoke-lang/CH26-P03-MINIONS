import type {
  DetectedStage,
  ExecutionRecord,
  NLPAnalysis,
  Policy,
  VerificationIssue,
  WorkflowSummary,
} from "./types";

export const DEMO_PROMPT =
  "When a new purchase request arrives, check the amount. If it exceeds ₹50,000, obtain manager approval. If approved, create the purchase order and notify finance.";

export const EXAMPLE_PROMPTS = [
  {
    title: "Customer Complaint",
    text: "When a customer submits a complaint, classify the severity. If it is critical, escalate to a support lead, otherwise assign it to the support queue and email the customer.",
  },
  {
    title: "Purchase Approval",
    text: "When a new purchase request arrives, check the amount. If it is above ₹50,000, send it to the manager for approval. If approved, create the purchase order and notify finance.",
  },
  {
    title: "Leave Approval",
    text: "When a leave request arrives, check the number of leave days. If it is more than 5 days, send it to the manager for approval. If approved, notify HR. Otherwise, notify the employee.",
  },
  {
    title: "Support Ticket",
    text: "When a support ticket arrives, classify the priority. If it is urgent, escalate it to the support lead, otherwise assign it to the support queue and notify the requester.",
  },
  {
    title: "Employee Onboarding",
    text: "When a new employee joins, create the employee record, create core accounts, schedule orientation, and send a welcome email to the employee.",
  },
];

export const NLP_STAGES = [
  { id: "01", title: "Parsing Language", detail: "Breaking instructions into semantic components" },
  { id: "02", title: "Detecting Intent", detail: "Identifying triggers, actions and outcomes" },
  { id: "03", title: "Extracting Entities", detail: "Finding actors, variables and resources" },
  { id: "04", title: "Detecting Conditions", detail: "Understanding branches and decision logic" },
  { id: "05", title: "Mapping Dependencies", detail: "Determining execution order" },
  {
    id: "06",
    title: "Building Intermediate Representation",
    detail: "Converting natural language into structured workflow logic",
  },
];

export const COMPILER_MESSAGES = [
  "Parsing workflow IR...",
  "Resolving dependencies...",
  "Generating nodes...",
  "Generating edges...",
  "Validating branches...",
  "Workflow graph generated successfully.",
];

export const VERIFY_MESSAGES = [
  "Checking structure...",
  "Checking graph reachability...",
  "Checking circular dependencies...",
  "Checking authorization policies...",
  "Checking ambiguous conditions...",
  "Checking termination paths...",
];

export const MOCK_ANALYSIS: NLPAnalysis = {
  trigger: "Purchase Request Created",
  actors: ["Employee", "Manager", "Finance"],
  variables: ["Purchase Amount"],
  conditions: ["Amount > ₹50,000"],
  actions: ["Manager Approval", "Create Purchase Order", "Notify Finance"],
};

export const MOCK_STAGES: DetectedStage[] = [
  { id: "s1", kind: "trigger", type: "Trigger", name: "Purchase Request Received" },
  { id: "s2", kind: "action", type: "Action", name: "Read Purchase Amount" },
  { id: "s3", kind: "condition", type: "Condition", name: "Amount > ₹50,000?" },
  { id: "s4", kind: "approval", type: "Approval", name: "Manager Approval" },
  { id: "s5", kind: "action", type: "Action", name: "Create Purchase Order" },
  { id: "s6", kind: "notification", type: "Notification", name: "Notify Finance" },
];

export const BASE_ISSUES: VerificationIssue[] = [
  {
    id: "i-trigger",
    title: "Trigger Valid",
    category: "Structural Integrity",
    severity: "pass",
    reason: "Workflow contains a valid starting event.",
    affected: ["trigger"],
    suggestedFix: "",
  },
  {
    id: "i-auth",
    title: "Authorization Valid",
    category: "Authorization",
    severity: "pass",
    reason: "Manager approval role exists in the Purchase Authorization policy.",
    affected: ["approval"],
    suggestedFix: "",
  },
  {
    id: "i-reject",
    title: "Undefined Rejection Path",
    category: "Execution Safety",
    severity: "error",
    reason:
      "The workflow defines what happens when approval succeeds but does not define what happens when the manager rejects the request.",
    affected: ["approval"],
    suggestedFix: "Add a rejection branch that notifies the requester and terminates the workflow.",
    fixPreview: ["Manager Approval", "↓ REJECTED", "Notify Requester", "↓", "End Workflow"],
  },
  {
    id: "i-ambiguous",
    title: "Ambiguous Threshold Boundary",
    category: "Ambiguity",
    severity: "warning",
    reason:
      "The condition uses '> ₹50,000'. Requests of exactly ₹50,000 are routed without approval — confirm this matches policy.",
    affected: ["condition"],
    suggestedFix: "Pin the boundary explicitly as amount > 50000 with an inclusive comment in the IR.",
    fixPreview: ["Amount > ₹50,000?", "→ boundary documented in IR"],
  },
];

export const RECENT_WORKFLOWS: WorkflowSummary[] = [
  {
    id: "wf-purchase",
    name: "Purchase Approval",
    status: "VERIFIED",
    nodes: 9,
    lastExecution: "2 min ago",
    successRate: 98,
    version: "v1.4",
    description: "Threshold-based purchase routing with manager approval.",
  },
  {
    id: "wf-onboarding",
    name: "Employee Onboarding",
    status: "DRAFT",
    nodes: 12,
    lastExecution: "3 h ago",
    successRate: 91,
    version: "v0.9",
    description: "Account creation, asset assignment and orientation scheduling.",
  },
  {
    id: "wf-complaint",
    name: "Customer Complaint Handling",
    status: "ISSUES FOUND",
    nodes: 8,
    lastExecution: "Yesterday",
    successRate: 84,
    version: "v2.1",
    description: "Severity classification with escalation to support leads.",
  },
  {
    id: "wf-invoice",
    name: "Invoice Processing",
    status: "RUNNING",
    nodes: 10,
    lastExecution: "Now",
    successRate: 96,
    version: "v3.0",
    description: "Invoice matching against purchase orders and payment scheduling.",
  },
  {
    id: "wf-vendor",
    name: "Vendor Verification",
    status: "VERIFIED",
    nodes: 7,
    lastExecution: "2 d ago",
    successRate: 99,
    version: "v1.1",
    description: "KYC document checks and compliance sign-off.",
  },
];

export const RECENT_EXECUTIONS: ExecutionRecord[] = [
  {
    id: "ex-8842",
    workflow: "Purchase Approval",
    status: "Completed",
    startedAt: "10:42:01",
    duration: "9.4s",
    nodes: 9,
  },
  {
    id: "ex-8841",
    workflow: "Invoice Processing",
    status: "Running",
    startedAt: "10:39:22",
    duration: "—",
    nodes: 10,
  },
  {
    id: "ex-8840",
    workflow: "Customer Complaint Handling",
    status: "Failed",
    startedAt: "10:12:04",
    duration: "3.1s",
    nodes: 8,
  },
  {
    id: "ex-8839",
    workflow: "Purchase Approval",
    status: "Awaiting approval",
    startedAt: "09:58:47",
    duration: "—",
    nodes: 9,
  },
  {
    id: "ex-8838",
    workflow: "Vendor Verification",
    status: "Completed",
    startedAt: "09:31:10",
    duration: "6.8s",
    nodes: 7,
  },
];

export const POLICIES: Policy[] = [
  {
    id: "p-purchase",
    name: "Purchase Authorization",
    description: "Approval authority by transaction value.",
    rules: [
      { range: "₹0 – ₹50,000", role: "Employee" },
      { range: "₹50,001 – ₹500,000", role: "Manager" },
      { range: "Above ₹500,000", role: "Finance Head" },
    ],
  },
  {
    id: "p-data",
    name: "Data Access",
    description: "Record-level permissions enforced during verification.",
    rules: [
      { range: "Employee", role: "Read" },
      { range: "Manager", role: "Read / Modify" },
      { range: "Admin", role: "Full Access" },
    ],
  },
  {
    id: "p-notify",
    name: "Notification Policy",
    description: "Who must be informed on completion or rejection.",
    rules: [
      { range: "Purchase created", role: "Finance" },
      { range: "Request rejected", role: "Requester" },
      { range: "SLA breach", role: "Operations Lead" },
    ],
  },
];

export const DASHBOARD_STATS = [
  { label: "Total Workflows", value: "24", accent: "primary" },
  { label: "Verified Workflows", value: "19", accent: "success" },
  { label: "Executions", value: "1,482", accent: "info" },
  { label: "Success Rate", value: "97.3%", accent: "success" },
  { label: "Issues Detected", value: "132", accent: "warning" },
  { label: "Issues Auto-Fixed", value: "118", accent: "ai" },
] as const;
