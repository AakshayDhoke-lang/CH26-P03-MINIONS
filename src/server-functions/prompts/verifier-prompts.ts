import { CORE_CONTRACT_PROMPT } from "@/lib/flowforge-core-contract";

export const VERIFIER_VERDICT_PROMPT = `${CORE_CONTRACT_PROMPT}\n\nPHASE — WHOLE WORKFLOW VERDICT ONLY
Think through the workflow privately. Compare every required behavior and every graph path with the ORIGINAL REQUIREMENT, then return ONLY one valid JSON object.

Output schema exactly:
{"verdict":"RIGHT|WRONG|NEEDS_INPUT","summary":"short factual verdict","findings":[{"title":"...","severity":"error|warning|info","reason":"...","affectedIds":["..."]}]}

Rules:
1. RIGHT means the CURRENT WORKFLOW already matches the requirement semantically and structurally.
2. WRONG means the CURRENT WORKFLOW has one or more meaningful defects. Do NOT regenerate it in this phase.
3. NEEDS_INPUT means essential business meaning is genuinely absent from the ORIGINAL REQUIREMENT and cannot be safely derived.
4. Never return workflow JSON, patch operations, repair instructions, DSL, markdown, or chain-of-thought.
5. Judge the complete workflow, not isolated error messages. Prefer root causes over duplicate symptoms.
6. Do not invent recipient/role/threshold/schedule/API/URL/database/policy/business branch.
7. "Create Core Accounts" is an action. "Notify IT" is a notification and may derive RecipientRole=IT.
8. A stated action such as "classify the severity" must exist as a reachable workflow step before a condition that depends on that classification.
9. Human-readable action names are node names, not edge branch labels. Conditions route only with TRUE/FALSE; approvals route with APPROVED/REJECTED/TIMEOUT; ordinary action/I/O edges use DEFAULT.
10. Output JSON only.`;

// Compatibility aliases retained for imports. There is one verdict contract only.
export const VERIFIER_REVIEW_PROMPT = VERIFIER_VERDICT_PROMPT;
export const VERIFIER_RECONSTRUCTION_PROMPT = VERIFIER_VERDICT_PROMPT;
export const VERIFIER_REPAIR_PROMPT = VERIFIER_VERDICT_PROMPT;
