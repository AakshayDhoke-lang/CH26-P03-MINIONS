# FlowForge v7.18 — Simplification & Reliability Audit

## Executive result

The project previously had overlapping repair responsibilities in the planner, deterministic completer, verifier, targeted AI repair DSL, repair retry, and reconstruction fallback. That made the same workflow susceptible to several independent mutations and made failures difficult to reason about.

v7.18 uses one simpler invariant: **a wrong workflow is regenerated as a complete candidate, never patched during verification**.

## New operational path

1. Original natural-language requirement is the business source of truth.
2. Planner returns one complete Workflow IR.
3. If the first planner candidate fails deterministic completeness, the planner receives one clean full-regeneration attempt. No targeted completion edits are used.
4. Verification performs deterministic graph analysis and asks the model for one verdict: RIGHT, WRONG, or NEEDS_INPUT.
5. RIGHT is accepted only if deterministic checks also pass.
6. WRONG requires one complete replacement Workflow IR generated from the original requirement.
7. The replacement is normalized and deterministically validated.
8. If valid, the entire graph is replaced atomically. If invalid, the old graph is preserved and remains unverified.
9. NEEDS_INPUT stops verification; no semantic value is invented.
10. Only a VERIFIED graph may run certification.
11. Every mandatory test must pass before the workflow is saved/exportable.

## Removed complexity

- Targeted verifier repair DSL (`ADD_NODE`, `UPDATE_NODE`, `REMOVE_NODE`, `ADD_EDGE`, `REMOVE_EDGE`, `SET_CONFIG`).
- Deterministic graph mutation during semantic verification.
- Separate targeted repair retry strategy.
- Repair-then-reconstruction fallback chain.
- Targeted planner completion pass.
- Manual “Apply AI Repair” workflow state.
- Conflicting planner completion prompt.

## Editor defects fixed

### Edge deletion

Edges can now be removed in two reliable ways in the interactive Studio canvas:

- select an edge and press Delete/Backspace;
- double-click an edge to delete it directly.

Every edge change invalidates prior verification/certification.

### Node attribute persistence

The node configuration panel previously synchronized its form only when `node.id` changed. That could leave stale name/type/config values after an update. It now resynchronizes when node name, type, subtitle, or config changes.

Manual node type selection is also respected exactly. Saving an ACTION no longer silently converts it to NOTIFICATION based on a heuristic. Semantic verification may later judge it wrong, but the editor itself does not overwrite the user's choice.

## Hallucination controls

The model can no longer invent patch operations or decide its own repaired graph is valid. It only returns a strict JSON verdict envelope.

The model is instructed not to invent recipients, roles, thresholds, schedules, APIs, URLs, credentials, database names, policies, branches, or parallelism.

If business meaning is unavailable, the only safe result is NEEDS_INPUT.

A model RIGHT verdict is overruled when deterministic invariants fail.

A regenerated candidate is not applied until deterministic acceptance succeeds.

Only one strict regeneration retry exists; there is no repair loop.

## Predicted model behavior checks

### Case A — Correct normal workflow

Requirement: `When a new employee is hired, create core accounts, assign a laptop, notify IT, then schedule orientation on day one.`

Expected semantic shape:

`Trigger -> Create Core Accounts[ACTION] -> Assign Laptop[ACTION] -> Notify IT[NOTIFICATION, RecipientRole=IT] -> Schedule Orientation[ACTION/Timing=day one]`

Expected verifier output: `RIGHT` when the current graph matches this shape.

### Case B — Misclassified Create Core Accounts

Current graph incorrectly represents `Create Core Accounts` as NOTIFICATION.

Expected verifier output: `WRONG`, with a completely regenerated workflow where Create Core Accounts is ACTION. The verifier must not ask for a recipient for this node and must not emit a SET_CONFIG/UPDATE_NODE patch.

### Case C — Missing recipient that is explicitly named

Requirement says `notify IT`.

Expected workflow: NOTIFICATION with `RecipientRole=IT`; no user clarification is needed.

### Case D — Recipient genuinely absent

Requirement says only `send a notification` and business correctness requires a destination.

Expected verifier output: `NEEDS_INPUT`. FlowForge must not fabricate an address or role.

### Case E — Wrong condition wiring

If TRUE/FALSE actions are swapped or one branch bypasses a required step, expected verifier output is `WRONG` plus a full replacement IR. The old edges are not individually repaired.

### Case F — Model claims RIGHT despite broken graph

Deterministic analysis detects an unreachable required node, missing canonical branch, or uncontrolled cycle.

Expected FlowForge behavior: override RIGHT and require WRONG/regeneration (or NEEDS_INPUT when unresolved semantics genuinely exist).

### Case G — Regenerated candidate is malformed

FlowForge attempts one strict complete regeneration retry. If it is still malformed or violates deterministic rules, the old workflow remains visible, status is ISSUES FOUND, and nothing is certified or saved.

## Remaining deliberate separation

The model still performs language-level semantic judgment because deterministic code cannot prove unrestricted natural-language meaning. FlowForge retains deterministic responsibility for schema validity, graph invariants, execution eligibility, test coverage, execution oracle, and save eligibility. This separation is intentional and reduces model hallucination impact.
