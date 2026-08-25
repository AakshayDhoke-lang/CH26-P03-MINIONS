# FlowForge Rule Book v2.0 — Regenerate, Never Patch

This file is the single normative source of workflow rules.

## 1. Authority

Priority is always:

1. Explicit user requirement
2. Hard deterministic invariants
3. Semantic interpretation
4. Model judgment

The model may interpret and generate. FlowForge deterministic code decides whether a candidate is compilable and safe.

## 2. One workflow lifecycle

```text
Original Requirement
      ↓
Initial Complete Workflow
      ↓
Deterministic Audit + Model Verdict
      ↓
RIGHT ───────────────→ Verify Candidate
WRONG ───────────────→ Scrap repair target and regenerate COMPLETE workflow
NEEDS_INPUT ─────────→ Stop; do not invent missing business information
      ↓
Deterministic Acceptance Gate
      ↓
VERIFIED
      ↓
Mandatory Execution Suite
      ↓
PASS ALL → Save certified workflow
ANY FAIL → Do not save
```

There is no targeted graph repair engine. Verification never applies ADD_NODE, REMOVE_NODE, ADD_EDGE, REMOVE_EDGE, SET_CONFIG, or similar patch operations.

## 3. Model responsibility

The model receives the original requirement, current complete workflow, deterministic findings, and optional failed execution evidence.

It must independently judge the whole workflow and return exactly one machine-readable verdict:

- `RIGHT`: current workflow represents the requirement correctly.
- `WRONG`: current workflow is incorrect. The verifier returns only the verdict; FlowForge then invokes the planner to generate one completely new workflow from the original requirement.
- `NEEDS_INPUT`: essential business meaning is absent and cannot be safely derived.

When verdict is WRONG, regeneration starts from the ORIGINAL REQUIREMENT using the planner/generator contract. The verifier never generates or patches workflow JSON. The current workflow and audit findings are evidence of what failed, not a structure that must be preserved.

## 4. Hallucination controls

The model must not invent business intent, recipients, roles, thresholds, schedules, APIs, URLs, credentials, database names, policies, branches, parallelism, or failure behavior absent from the requirement.

Missing deployment/runtime details do not make business semantics incomplete.

If essential semantic information is genuinely unavailable, return NEEDS_INPUT instead of guessing.

Model output is never trusted directly. Every returned workflow must pass the deterministic schema and graph rules.

## 5. Node semantics

- `trigger`: starts the workflow.
- `action`: requested non-communication business operation.
- `condition`: predicate with TRUE/FALSE routing.
- `approval`: explicit authorization with APPROVED/REJECTED; TIMEOUT only when requested.
- `notification`: explicit communication such as notify/email/message/alert/inform/contact.
- `api`, `webhook`, `database`: only when explicitly required by business semantics.
- `delay`: explicit timing/wait requirement.
- `join`: synchronization only. `BARRIER` for explicit parallel siblings; `MERGE` for mutually exclusive branches that reconverge.
- `end`: explicit termination when needed.

Examples:

- `Create Core Accounts` → ACTION.
- `Notify IT` → NOTIFICATION with `RecipientRole=IT` when IT is explicitly named.

## 6. Ordering and control flow

Ordinary listed actions and the word `and` are sequential unless parallelism is explicit.

Only phrases such as `in parallel`, `simultaneously`, `concurrently`, or `at the same time` authorize fan-out.

Preserve explicit `before`, `after`, `then`, `next`, `followed by`, and `finally` ordering.

Do not invent data dependencies merely because actions are sequential.

Conditions are not approvals. Approvals are not conditions. Parallel splits are not conditions.

A condition uses TRUE and FALSE structural branches. An approval uses APPROVED/REJECTED and TIMEOUT only when required. Every ordinary trigger/action/API/webhook/database/notification/delay/join/end connection uses DEFAULT. Human-readable action names must never be stored as edge outcomes. Do not invent business actions for an unspecified outcome.

## 7. Hard acceptance invariants

A candidate cannot be VERIFIED when any of these are false:

1. Every explicit required business intent is represented.
2. No ungrounded business intent is present.
3. Explicit order is preserved.
4. Required executable nodes are reachable from the trigger.
5. Edges reference existing nodes.
6. Condition branches are structurally valid.
7. Approval branches are structurally valid.
8. No accidental/uncontrolled cycle exists.
9. Parallel BARRIER and conditional MERGE semantics are not confused.
10. No required action is skipped by premature termination.
11. Semantic node types match their intent.
12. Unresolved critical ambiguity is absent.

## 8. Verification behavior

Verification is an audit, not an editor.

If the current workflow is wrong, FlowForge does not repair individual nodes or edges. The verifier emits only WRONG. FlowForge then invokes the planner to generate one full regenerated Workflow IR from the original requirement, validates it, and atomically replaces the old graph only if the new candidate passes deterministic acceptance.

If regeneration fails validation, the old graph remains visible and the workflow stays unverified. At most one strict regeneration retry is allowed for malformed/invalid model output; there are no repair loops.

## 9. Manual editing

Manual edits are allowed in Studio. Any node, config, or edge edit immediately invalidates verification/certification.

Node attribute changes must persist exactly as saved by the user. FlowForge must not silently change an explicitly selected node type during a manual edit.

Edges must be explicitly deletable from the canvas.

## 10. Execution and saving

Only VERIFIED workflows may execute certification tests.

Mandatory tests are derived from the accepted graph. The deterministic execution oracle decides PASS/FAIL; the model never self-certifies execution.

A reusable workflow is saved only when every mandatory certification test passes. Failed, interrupted, unresolved, or partially tested workflows are never saved.

Saved certified workflows remain downloadable/importable using the versioned FlowForge workflow format.
