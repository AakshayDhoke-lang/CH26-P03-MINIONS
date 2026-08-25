# FlowForge v7.19 — Verdict / Regeneration Separation Audit

## Failure observed
The verifier correctly judged a workflow WRONG because required behavior such as `classify the severity` was missing, the condition was not executable, and the graph contained reachability/orphan problems. Regeneration then failed because the same verifier response contract required the model to both return verdict `WRONG` and embed a complete replacement Workflow IR. Small/local models can satisfy the diagnosis while omitting or malformed the nested workflow, producing errors such as `Retry did not contain a complete WRONG replacement`.

## Root cause
The verifier still had two responsibilities: semantic judgment and workflow generation. That contradicted the simplification goal and made a formatting failure capable of blocking otherwise-correct regeneration.

## v7.19 architecture
1. Verifier receives requirement + current graph + deterministic audit.
2. Verifier returns only `RIGHT`, `WRONG`, or `NEEDS_INPUT` plus concise root-cause findings.
3. If `WRONG`, FlowForge invokes the planner contract separately.
4. Planner generates one entirely new Workflow IR from the original requirement.
5. Canonical normalization runs on every candidate.
6. Deterministic acceptance decides whether the replacement can atomically replace the current graph.
7. One fresh full-generation retry is allowed. There is still no patch loop.

## Branch-rule conflict removed
An older deterministic rule treated API/database/webhook/notification edges as TRUE/FALSE success/failure branches. The simplified canonical model now has one unambiguous ownership rule:
- Condition: TRUE / FALSE
- Approval: APPROVED / REJECTED / TIMEOUT when applicable
- Every other node: DEFAULT

Human-readable text such as `Escalate to Support Lead` is a node/action name, never an edge outcome label. Canonical normalization converts non-decision branch labels to DEFAULT without inventing business behavior.

## Duplicate findings
Model and deterministic findings are now deduplicated before display, so the same `Missing Required Action: classify the severity` root cause should not appear repeatedly as separate cards merely because both engines detected it.

## Expected workflow for the reported complaint pattern
For a requirement such as: `When a complaint arrives, classify severity. If it is critical, escalate to a support lead, otherwise assign it to the queue and email the customer.` the compiler-ready topology is:

Complaint Received -> Classify Severity -> Is Severity Critical?
- TRUE -> Escalate to Support Lead
- FALSE -> Assign to Queue -> Email Customer

`Classify Severity` is an ACTION. `Is Severity Critical?` is a CONDITION with a machine-evaluable Expression. `Escalate to Support Lead` is an ACTION, not an edge label. `Email Customer` is a NOTIFICATION.

## Validation
Architecture regression suite: 24 passed, 0 failed.
Full project TypeScript build could not be executed because dependencies/type definitions are not installed in the uploaded archive. A syntax-oriented TypeScript pass found no parser-level errors in the modified files; unresolved-module/type errors are expected without node_modules.
