/** Runtime mirror of rules/RULE_BOOK.md. The markdown file is the sole normative rule source. */
export const RULE_PRECEDENCE = ["EXPLICIT_USER_INTENT","DETERMINISTIC_INVARIANTS","SEMANTIC_INTERPRETATION","MODEL_JUDGMENT"] as const;
export type RuleAuthority = typeof RULE_PRECEDENCE[number];
export type ValidationDisposition = "PASS"|"FAIL"|"MISSING"|"AMBIGUOUS";
export type FieldClass = "REQUIRED_SEMANTIC"|"OPTIONAL_SEMANTIC"|"DERIVABLE"|"RUNTIME"|"USER_INPUT";
export type MissingInformationClass = FieldClass;
export type ProvenanceSource = "explicit"|"derived"|"deterministic"|"model_proposed";
export interface NodeProvenance { source:ProvenanceSource; requirementRefs:string[]; confidence:"high"|"medium"|"low"; }

export const CORE_NODE_SEMANTICS = {
  trigger:"Starts workflow execution.", action:"Requested non-communication business operation.",
  condition:"Predicate with TRUE/FALSE routing.", approval:"Explicit authorization with APPROVED/REJECTED; TIMEOUT only when requested.",
  notification:"Explicit communication; recipient or recipientRole comes only from the requirement.",
  api:"Explicit external API operation.", database:"Explicit persistence/query/update operation.", webhook:"Explicit webhook operation.",
  delay:"Explicit timing or wait requirement.", join:"BARRIER for explicit parallel siblings; MERGE for mutually exclusive reconvergence.",
  end:"Safe termination after all required intent on that path is complete."
} as const;

export const CORE_GLOBAL_RULES = [
  "Every explicit required intent is represented.","No invented business intent.","Explicit order is preserved.",
  "Required nodes are reachable.","Edges reference existing nodes.","Conditions and approvals use their canonical branches.",
  "No uncontrolled cycles.","BARRIER and MERGE are not confused.","No premature termination.","Semantic node types match intent.",
  "Unresolved critical ambiguity blocks verification.","Unverified workflows never certify or save."
] as const;

export const CORE_CONTRACT_PROMPT = `
FLOWFORGE RULE BOOK v2.0 — REGENERATE, NEVER PATCH
Priority: explicit user requirement > deterministic invariants > semantic interpretation > model judgment.
The ORIGINAL REQUIREMENT is the only business source of truth.

SEMANTICS:
- Every explicit required business intent must appear exactly as needed; do not invent business intent.
- Ordinary listed actions and "and" are sequential unless parallel/simultaneous/concurrent/at-the-same-time is explicit.
- Preserve before/after/then/next/followed-by/finally order.
- Notification is ONLY explicit communication: notify/email/message/alert/inform/contact. Create/assign/generate/update/process/store are ACTIONS unless the requirement explicitly makes them communication.
- Notification needs recipient OR recipientRole only when derivable from explicit wording. Never invent either.
- Conditions use TRUE/FALSE. Approvals use APPROVED/REJECTED; TIMEOUT only when requested.
- BARRIER joins explicit parallel siblings. MERGE reconverges mutually exclusive condition/approval paths.
- Loops require explicit repeat/retry/while/until intent and a controlled exit.
- Runtime/deployment details are not missing business semantics.

VERIFICATION ARCHITECTURE:
- Do not patch the current graph.
- Judge the complete current workflow as RIGHT, WRONG, or NEEDS_INPUT.
- If WRONG, generate ONE complete replacement Workflow IR from the ORIGINAL REQUIREMENT. Treat the current graph only as evidence of what was wrong.
- If NEEDS_INPUT, do not guess.
- FlowForge deterministic validation, not you, decides final acceptance and execution PASS/FAIL.
- Output only the exact machine-readable structure requested by the phase prompt. No markdown or commentary.
`.trim();
