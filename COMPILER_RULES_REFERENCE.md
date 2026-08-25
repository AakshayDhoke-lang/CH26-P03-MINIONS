# FlowForge Compiler Redesign — Implementation Prompt

You are working on the **FlowForge AI natural-language-to-workflow prototype**.

Your task is to **redefine and simplify the compiler, workflow generation, verification, and execution architecture**.

This is NOT a request to redesign the frontend or blindly rewrite the entire project.

The existing project has gone through many versions and became over-engineered because too many systems independently interpreted, validated, repaired, patched, and reconstructed workflows.

The new architecture must prioritize:

**Predictability → semantic correctness → simple deterministic verification → reliable execution → strong demo behavior.**

---

# 1. PRIMARY OBJECTIVE

FlowForge should perform this pipeline:

```text
Natural-Language Requirement
        ↓
LLM Planner
        ↓
Requirement Plan + Workflow Graph
        ↓
Normalize into canonical Workflow IR
        ↓
ONE Deterministic Verifier
        ↓
PASS / FAIL
        ↓
Executor
        ↓
Real control-flow execution
+
Simulated prototype action execution
        ↓
Execution Result

```

Do NOT rebuild the previous multi-layer architecture:

```text
Planner
→ Completer
→ Rulebook
→ Semantic Contract
→ AI Verifier
→ Repair Classifier
→ Repair DSL
→ Targeted Patch
→ Reconstruction
→ Certification
→ Planner Again

```

There must be **one authoritative normalized IR and one authoritative deterministic verification pipeline.**

---

# 2. PRESERVE EXISTING STABLE FEATURES

Do not unnecessarily redesign or remove stable frontend functionality.

Preserve:

- Existing FlowForge UI/UX
- Workflow canvas
- Node rendering
- Edge rendering
- Prompt input
- Node editing
- Edge editing
- Node creation/deletion/duplication where currently supported
- Verification panel
- Execution panel
- Execution logs
- Workflow IR concept
- Provider selector
- Provider health/connectivity indicator
- NVIDIA/LM Studio infrastructure where currently functional
- Existing useful workflow visual styling

The goal is primarily to **replace/simplify compiler logic**, not rebuild the visual application.

---

# 3. CORE DESIGN PHILOSOPHY

The verifier must answer:

> "Does this graph correctly implement the user's requirement?"

It must NOT answer:

> "Does this graph match one rigid workflow shape preferred by the verifier?"

Do not reject valid workflows merely because they do not contain unnecessary structural nodes.

---

# 4. MINIMAL NODE MODEL

Do NOT create hardcoded implementations for every possible business action.

Use these primary semantic categories:

```text
TRIGGER
ACTION
CONDITION
APPROVAL
JOIN
IO
END

```

Most natural-language operations should become generic `ACTION` nodes.

Examples:

```text
Classify Severity
Analyze Ticket
Detect Fraud
Extract Customer Details
Calculate Risk
Generate Summary
Generate Recommendation
Prepare Report
Create Case
Escalate Issue
Categorize Request
Validate Document

```

These do NOT require separate compiler node types.

Represent them as:

```json
{
  "type": "action",
  "label": "Classify Severity",
  "instruction": "Classify the severity of the incoming ticket",
  "inputs": [],
  "outputs": ["severity"]
}

```

Unknown business-action names should normally be normalized to `ACTION`, not rejected.

---

# 5. STANDARD NODE EXECUTION RESULT

Every executable node must return a common execution envelope.

Use a structure conceptually equivalent to:

```json
{
  "status": "success",
  "message": "Action completed successfully",
  "output": {}
}

```

Possible status values:

```text
success
failed
skipped
waiting

```

Individual nodes place their business result inside `output`.

Example:

```json
{
  "status": "success",
  "message": "Severity classified",
  "output": {
    "severity": "critical"
  }
}

```

---

# 6. PROTOTYPE SIMULATION MODEL

This is a prototype.

External/business operations do NOT need real integrations unless already configured.

They may execute in simulation mode.

Example:

```text
Notify Support Lead

```

may return:

```json
{
  "status": "success",
  "message": "Notification sent to Support Lead",
  "output": {
    "notified": true,
    "recipient": "Support Lead"
  }
}

```

Similarly:

```text
Send Email
→ SUCCESS — Email sent

Create Ticket
→ SUCCESS — Ticket created

Save Record
→ SUCCESS — Record saved

Escalate Case
→ SUCCESS — Case escalated

Generate Report
→ SUCCESS — Report generated

```

Clearly mark simulated external actions as simulated in execution metadata/UI where appropriate.

Do NOT falsely imply that a real external service was contacted.

---

# 7. OUTPUT-AWARE EXECUTION

A generic action may return simulated data, but its output must satisfy downstream requirements.

Example:

```text
Classify Severity
        ↓
Is severity critical?

```

The classification action cannot return only:

```json
{
  "status": "success"
}

```

It must expose:

```json
{
  "status": "success",
  "output": {
    "severity": "critical"
  }
}

```

because the next condition depends on `severity`.

Therefore:

> Simulated execution is allowed, but downstream data dependencies must remain valid.

---

# 8. SHARED WORKFLOW CONTEXT

Implement a shared execution context.

Conceptually:

```json
{
  "trigger": {},
  "variables": {},
  "nodes": {}
}

```

Example during execution:

```json
{
  "trigger": {
    "ticket": "Customer cannot access account"
  },
  "variables": {
    "severity": "critical"
  },
  "nodes": {
    "classify_severity": {
      "status": "success",
      "output": {
        "severity": "critical"
      }
    }
  }
}

```

Nodes should be able to consume outputs from previous reachable nodes.

---

# 9. SEQUENTIAL-BY-DEFAULT RULE

This is a CORE compiler rule.

If the requirement describes actions sequentially and does NOT explicitly request branching or parallelism, preserve their sequence.

Example:

```text
Receive ticket, classify severity, notify manager, save ticket.

```

Generate:

```text
Receive Ticket
      ↓
Classify Severity
      ↓
Notify Manager
      ↓
Save Ticket

```

Do NOT generate:

```text
Receive Ticket
├── Notify Manager
├── Save Ticket
└── Classify Severity

```

Do NOT reorder actions without semantic justification.

---

# 10. EXPLICIT ORDERING LANGUAGE

Recognize ordering language such as:

```text
then
after
before
once
followed by
after that
finally
subsequently

```

Translate these into explicit ordering constraints.

Example:

```text
After validating the request, notify the manager.

```

means:

```text
Validate Request
      ↓
Notify Manager

```

---

# 11. "AND" DOES NOT AUTOMATICALLY MEAN PARALLEL

This is important.

The statement:

```text
Validate the request and notify the manager.

```

should normally become:

```text
Validate Request
      ↓
Notify Manager

```

Do NOT infer parallelism merely from:

- `and`
- commas
- lists
- punctuation

---

# 12. PARALLELISM MUST BE EXPLICIT

Parallel execution should require clear semantic evidence such as:

```text
in parallel
simultaneously
at the same time
concurrently
independently

```

Example:

```text
Notify the manager and create the ticket in parallel.

```

may become:

```text
             ┌── Notify Manager ──┐
Previous ────┤                     ├── Join
             └── Create Ticket ───┘

```

Do NOT introduce a Join unless convergence is actually required.

---

# 13. CONDITION GENERATION

Generate a condition only when the requirement expresses actual decision logic.

Examples:

```text
if
when ... otherwise
depending on
unless
if not
based on whether

```

Example:

```text
If severity is critical, notify the support lead.

```

Generate:

```text
Classify Severity
       ↓
Severity Critical?
    ┌──┴──┐
 TRUE   FALSE
  ↓
Notify
Lead

```

Do NOT invent conditions that the user did not request.

---

# 14. CONDITION RULES

Boolean conditions should normally have:

```text
TRUE
FALSE

```

Both outcomes must be representable.

However, a branch does NOT need another action merely to satisfy the verifier.

A branch may terminate if no further action is required for that outcome.

Example:

```text
If critical, notify manager.

```

Valid:

```text
             TRUE → Notify Manager → TERMINAL
            /
Critical? 
            \
             FALSE → TERMINAL

```

The FALSE path does NOT require a fake action.

---

# 15. MULTI-OUTCOME DECISIONS

Do not unnecessarily force all decisions into Boolean TRUE/FALSE if the requirement naturally contains multiple outcomes.

Example:

```text
Classify severity as low, medium, high, or critical
and route accordingly.

```

A valid decision may have:

```text
LOW
MEDIUM
HIGH
CRITICAL

```

branches.

The verifier should understand declared multi-outcome decisions.

---

# 16. TERMINAL NODE PHILOSOPHY

This is a CRITICAL change.

Do NOT enforce:

> "Only END nodes may terminate workflows."

Instead enforce:

> "A reachable path may terminate when all required actions for that path have been completed."

Therefore many executable nodes may legitimately be terminal.

Examples:

```text
Notify User
Send Email
Save Record
Create Ticket
Generate Report
Escalate Case
Reject Request
Approve Request
Archive Request
API Call
Generic Action

```

All may be valid final nodes depending on the requirement.

---

# 17. EXPLICIT END NODE IS OPTIONAL

An explicit visual `END` node may still exist.

However, it should NOT be mandatory for semantic validity.

These are both semantically valid:

```text
Trigger
  ↓
Notify User

```

and:

```text
Trigger
  ↓
Notify User
  ↓
End

```

if notification is the final requested action.

The UI may optionally render terminal markers without changing semantic validity.

---

# 18. DEAD END VS VALID TERMINAL

The verifier MUST distinguish these.

## Valid terminal

Requirement:

```text
Notify the manager when a critical issue occurs.

```

Graph path:

```text
Critical
   ↓
Notify Manager

```

This is COMPLETE.

Do not report a dead end.

## Invalid dead end

Requirement:

```text
Classify the ticket, notify the manager, then save it.

```

Graph:

```text
Classify Ticket
      ↓
Notify Manager

```

This is incomplete because `Save Ticket` is missing.

That is a real error.

Therefore:

> Terminal validity must be determined from requirement completion, not from node type alone.

---

# 19. REQUIREMENT PLAN

Before graph verification, create a compact internal requirement plan.

Example requirement:

```text
Receive the ticket, classify severity,
and if critical notify the support lead.
Otherwise save the ticket.

```

Internal plan:

```text
A1 Receive Ticket
A2 Classify Severity

IF severity == critical:
    A3 Notify Support Lead
    TERMINAL

ELSE:
    A4 Save Ticket
    TERMINAL

```

This requirement plan becomes the semantic basis for deterministic verification.

Do NOT use another unrestricted AI reviewer as the final authority.

---

# 20. REQUIREMENT ACTION IDENTITIES

Each important action extracted from the requirement should have an internal identity.

Example:

```json
{
  "id": "A2",
  "intent": "classify severity",
  "required": true
}

```

The generated graph should map nodes back to these requirement actions where possible.

Example:

```json
{
  "id": "node_2",
  "type": "action",
  "label": "Determine Ticket Severity",
  "requirementActionId": "A2"
}

```

This allows:

```text
"Classify Severity"

```

and

```text
"Determine Ticket Severity"

```

to be recognized as the same required action without brittle exact-text matching.

---

# 21. STRUCTURAL VERIFICATION RULES

Keep structural verification small and deterministic.

Verify:

- Workflow has a valid trigger/start.
- All meaningful nodes are reachable.
- No unintended orphan nodes.
- No impossible references.
- No malformed edges.
- No accidental cycles.
- Explicit loops are allowed only when intentional.
- Control nodes have valid outgoing semantics.
- Required branches are represented.
- Join nodes have legitimate convergence.
- Data dependencies are satisfiable.

Do NOT add dozens of node-specific structural rules.

---

# 22. REQUIREMENT COVERAGE RULES

Verify:

- Every required action exists.
- Required action ordering is preserved.
- Explicit decisions are represented.
- Required outcomes are represented.
- Explicit parallelism is preserved.
- Explicit loops are preserved.
- Required terminal behavior is represented.
- No required action disappears because of normalization.

---

# 23. LINK VALIDATION RULES

Edges must represent semantic progression.

Rules:

1. Default to requirement order.
2. Do not randomly reorder actions.
3. Do not randomly branch.
4. Do not randomly merge.
5. Do not infer parallelism from punctuation.
6. Conditions create branches only when required.
7. Branches converge only when later work requires convergence.
8. A terminal branch does not require Join.
9. A completed terminal action does not require outgoing edges.
10. Every edge must connect nodes that can logically follow each other according to the requirement plan.

---

# 24. JOIN RULES

Use `JOIN` only when parallel/branching paths must converge before a common downstream action.

Example:

```text
          ┌→ Action B ─┐
Action A ─┤             ├→ Join → Action D
          └→ Action C ─┘

```

Do NOT require Join when paths terminate independently.

Example:

```text
Condition
├── TRUE → Notify Manager → TERMINAL
└── FALSE → Archive → TERMINAL

```

No Join required.

---

# 25. DATA DEPENDENCY VERIFICATION

A node may consume data only if that data is available from:

- Trigger input
- Upstream reachable node output
- Workflow variable
- Explicit configuration/constant

Example:

```text
Classify Severity
      ↓
severity = critical
      ↓
Condition:
severity == critical

```

Valid.

But:

```text
Condition:
riskScore > 80

```

with no trigger/upstream source for `riskScore` should fail verification.

Return a useful diagnostic:

```text
Condition references "riskScore", but no reachable upstream node produces it.

```

---

# 26. CONTROL NODES REMAIN STRICT

Generic actions are flexible.

Control-flow nodes are not.

### CONDITION

Must:

- Have evaluable logic.
- Reference available data.
- Define its expected outcomes.
- Route execution correctly.

### APPROVAL

Must:

- Represent a decision.
- Support relevant approval outcomes.
- Provide approver/role information where required.

### JOIN

Must:

- Have legitimate incoming paths.
- Wait for the correct required paths.

### TRIGGER

Must:

- Establish execution entry/context.

These rules should remain deterministic.

---

# 27. APPROVAL TERMINATION

Approval outcomes may themselves terminate a path.

Example:

```text
Request Approval
├── APPROVED → Create Account
└── REJECTED → Notify Requester

```

If notification is the final rejected-path requirement:

```text
Notify Requester

```

is a valid terminal node.

Do not force the rejected path through an artificial End node.

---

# 28. IO / NOTIFICATION RULE

Notification and simple external I/O nodes should have minimal contracts.

Example notification:

```text
recipient
message

```

Prototype execution:

```json
{
  "status": "success",
  "message": "Notification sent successfully",
  "output": {
    "notified": true
  }
}

```

Do NOT require explicit SUCCESS/FAILURE graph branches unless the requirement explicitly describes failure handling.

Example:

```text
Notify manager and if notification fails retry it.

```

Then explicit success/failure behavior is appropriate.

Otherwise:

```text
Notify Manager
      ↓
Next Action

```

is valid.

---

# 29. GENERIC ACTION FALLBACK

If the planner generates an unknown business node such as:

```text
Assess Customer Risk

```

do NOT fail with:

```text
Unsupported node type.

```

Normalize it to:

```text
ACTION
label = "Assess Customer Risk"

```

Then execute/simulate it using the generic action mechanism.

Only reject it when:

- its configuration is impossible,
- required input cannot be obtained,
- required downstream output cannot be produced,
- or it violates actual workflow structure.

---

# 30. VERIFICATION MUST NOT OVERREACH

Do NOT reject workflows for:

- Missing explicit END when the path is semantically complete.
- Generic action names.
- Notification being the final node.
- Save being the final node.
- API action being the final node.
- Report generation being the final node.
- Different wording for the same semantic action.
- Sequential actions that could theoretically run in parallel.
- Lack of Join when branches never reconverge.
- Lack of failure branches when failure handling was never requested.

---

# 31. REAL ERRORS THAT MUST STILL FAIL

Do NOT make verification meaningless.

Fail workflows for genuine errors such as:

```text
Required action missing
Required action occurs in wrong order
Unreachable required node
Orphan required node
Condition references unavailable data
Required TRUE/FALSE/outcome behavior missing
Incorrect branch routing
Explicit parallel requirement implemented sequentially
Explicit sequence implemented randomly
Accidental cycle
Malformed edge
Required downstream action missing
Invalid Join semantics
Impossible data dependency

```

---

# 32. EXECUTION ENGINE

The executor should operate using the normalized graph and shared context.

Conceptually:

```text
Start
 ↓
Execute current node
 ↓
Return standardized result
 ↓
Store output in workflow context
 ↓
Determine next edge
 ↓
Execute next node

```

For control nodes:

```text
Condition
→ evaluate
→ select branch

Approval
→ obtain/simulate decision
→ select branch

Join
→ wait for required predecessors
→ continue

```

For normal actions:

```text
Execute/simulate
→ return SUCCESS + output
→ continue

```

---

# 33. EXECUTION LOGGING

Every node should visibly show execution state.

Example:

```text
✓ Receive Ticket
SUCCESS
Ticket received

✓ Classify Severity
SUCCESS
Severity: Critical

✓ Notify Support Lead
SUCCESS
Notification sent to Support Lead

✓ Workflow Completed

```

This is essential for the prototype demonstration.

---

# 34. VERIFICATION RESULT

Verification should provide a simple result:

```text
PASS

```

or:

```text
FAIL

```

with understandable diagnostics.

Example:

```text
FAIL

Missing required action:
Save Ticket

Requirement expected:

Notify Manager
→ Save Ticket

Generated workflow ended after:
Notify Manager

```

Avoid vague semantic-verifier essays.

---

# 35. NO AUTOMATIC PATCH CHAINS

Do NOT restore the old multi-stage mutation architecture.

There must not be:

```text
repair
→ patch
→ repair
→ reconstruct
→ patch
→ verify
→ repair

```

If the generated workflow fails, preserve the diagnostic.

If regeneration is enabled, provide the original requirement + deterministic verifier errors back to the planner and request a **complete replacement graph**.

Never allow multiple independent systems to mutate the graph.

---

# 36. MANUAL EDITING

After the user manually edits the graph:

1. Invalidate previous verification result.
2. Normalize the modified graph.
3. Run the same deterministic verifier.
4. Show PASS/FAIL.
5. Execute only when valid.

Do not apply hidden AI repairs to manually edited workflows.

---

# 37. COMPILER SOURCE OF TRUTH

There must be exactly one canonical workflow representation.

Conceptually:

```text
WorkflowIR
├── requirementPlan
├── nodes
├── edges
├── variables
├── metadata
└── verification

```

Frontend canvas state, execution state, and verifier state should reference this canonical representation rather than maintaining conflicting interpretations.

---

# 38. CORE RULE HIERARCHY

When implementing the new compiler, prioritize rules in this order:

```text
1. USER REQUIREMENT
        ↓
2. REQUIREMENT PLAN
        ↓
3. REQUIRED ACTIONS
        ↓
4. ORDERING / BRANCH / PARALLEL CONSTRAINTS
        ↓
5. DATA DEPENDENCIES
        ↓
6. GRAPH STRUCTURAL VALIDITY
        ↓
7. NODE EXECUTION CONTRACTS
        ↓
8. UI PRESENTATION

```

A UI convention must never invalidate a semantically correct requirement.

---

# 39. FUNDAMENTAL RULES

Treat these as the constitution of the new FlowForge compiler.

### RULE 1 — Requirement is authoritative

The generated workflow exists to represent the user's requirement.

### RULE 2 — Sequential by default

Actions remain sequential unless the requirement explicitly introduces another relationship.

### RULE 3 — Explicit control flow only

Do not invent branches, parallelism, loops, retries, approvals, or failure handling.

### RULE 4 — Preserve required ordering

If A must happen before B, graph reachability must enforce A before B.

### RULE 5 — Generic actions are allowed

Business actions do not need individually hardcoded node types.

### RULE 6 — Control nodes are strict

Condition, Approval, Join, Trigger and other true control nodes must obey their contracts.

### RULE 7 — Terminal behavior is semantic

Any executable node may terminate a path when that path has completed its requirement.

### RULE 8 — END is optional

An explicit End node is presentation/runtime convenience, not mandatory semantic proof.

### RULE 9 — Dead ends are requirement-relative

A path is a dead end only when required work remains unfinished.

### RULE 10 — Outputs must support downstream logic

Simulation cannot hide missing data dependencies.

### RULE 11 — External actions may be simulated

Return realistic status/message/output without requiring real integrations.

### RULE 12 — Do not over-verify

Reject actual contradictions and missing requirements, not harmless graph variations.

### RULE 13 — One verifier

There must be one authoritative deterministic verification system.

### RULE 14 — One graph mutator

Do not allow multiple repair systems to modify workflows.

### RULE 15 — Complete replacement over patch chains

If regeneration is used, regenerate the complete workflow rather than repeatedly patching it.

---

# 40. EXAMPLE 1 — SIMPLE SEQUENTIAL WORKFLOW

Requirement:

```text
Receive a support ticket, classify its severity,
notify the support lead and save the ticket.

```

Expected:

```text
Trigger
   ↓
Receive Ticket
   ↓
Classify Severity
   ↓
Notify Support Lead
   ↓
Save Ticket

```

`Save Ticket` may be terminal.

PASS.

---

# 41. EXAMPLE 2 — TERMINAL NOTIFICATION

Requirement:

```text
When a critical ticket arrives, notify the support lead.

```

Valid:

```text
Trigger
   ↓
Check Critical?
  ├── TRUE → Notify Support Lead → TERMINAL
  └── FALSE → TERMINAL

```

Do NOT report:

```text
Dead end after notification.

```

PASS.

---

# 42. EXAMPLE 3 — BRANCH-SPECIFIC TERMINATION

Requirement:

```text
Classify severity.
If critical, escalate to the support lead.
Otherwise archive the ticket.

```

Expected:

```text
Classify Severity
       ↓
Critical?
├── TRUE → Escalate to Support Lead → TERMINAL
└── FALSE → Archive Ticket → TERMINAL

```

No Join.

No mandatory End nodes.

PASS.

---

# 43. EXAMPLE 4 — DOWNSTREAM DATA

Requirement:

```text
Classify severity and if it is critical notify the manager.

```

Expected execution:

```text
Classify Severity
output.severity = "critical"
        ↓
severity == "critical"
        ↓ TRUE
Notify Manager

```

The verifier must ensure `severity` exists before the condition.

---

# 44. EXAMPLE 5 — EXPLICIT PARALLELISM

Requirement:

```text
After receiving the request, notify the manager
and create an audit record in parallel.
After both complete, generate the report.

```

Expected:

```text
Receive Request
      ↓
   Parallel
   /      \
Notify   Create Audit
Manager    Record
   \      /
     Join
      ↓
Generate Report

```

Join is required because downstream work depends on both branches completing.

---

# 45. EXAMPLE 6 — NO UNNECESSARY PARALLELISM

Requirement:

```text
Receive the request, notify the manager and create an audit record.

```

Default:

```text
Receive Request
      ↓
Notify Manager
      ↓
Create Audit Record

```

Do NOT infer parallelism from `and`.

---

# 46. EXAMPLE 7 — INVALID MISSING ACTION

Requirement:

```text
Receive ticket, classify severity, notify manager, then save ticket.

```

Generated:

```text
Receive Ticket
      ↓
Classify Severity
      ↓
Notify Manager

```

FAIL.

Diagnostic:

```text
Missing required action: Save Ticket.

The workflow terminates before all required actions are complete.

```

This is a genuine dead end.

---

# 47. IMPLEMENTATION STRATEGY

Before modifying code:

1. Inspect the existing architecture.
2. Identify current compiler/planner modules.
3. Identify all verifier modules.
4. Identify repair/reconstruction modules.
5. Identify Workflow IR definitions.
6. Identify executor.
7. Identify canvas graph state.
8. Identify provider integrations.
9. Identify existing tests.
10. Document which components will be preserved, simplified, replaced, or removed.

Do NOT start by blindly deleting files.

---

# 48. REMOVE ARCHITECTURAL DUPLICATION

Find and eliminate situations where multiple modules independently decide:

- Whether an action is required.
- Whether a node is valid.
- Whether a path may terminate.
- Whether branches are correct.
- Whether a graph should be modified.
- Whether an action is semantically equivalent.
- Whether the workflow is executable.

Move these decisions into the new canonical rule system.

---

# 49. TEST SUITE

Create deterministic tests for at least:

```text
Simple sequential workflow
Notification as terminal
Save as terminal
Generic action as terminal
Two terminal condition branches
Condition with continuing TRUE branch
Condition with terminating FALSE branch
Explicit parallel workflow
Sequential "and" workflow
Parallel branches requiring Join
Parallel branches not requiring Join
Approval workflow
Rejected approval terminal notification
Missing required action
Incorrect action ordering
Orphan node
Unreachable node
Accidental cycle
Valid explicit loop
Condition with unavailable variable
Generic unknown action
Simulated notification
Simulated API action
Downstream output dependency
Manual graph edit + re-verification

```

Each test should have a deterministic expected PASS/FAIL.

---

# 50. SUCCESS CRITERIA

The redesign is successful when FlowForge can reliably demonstrate:

```text
User Requirement
       ↓
Understand Actions
       ↓
Build Requirement Plan
       ↓
Generate Ordered Workflow
       ↓
Normalize IR
       ↓
Verify Correctness
       ↓
Display Workflow
       ↓
Execute Nodes
       ↓
Show Outputs
       ↓
Complete Successfully

```

A judge should be able to enter ordinary workflow requirements without the compiler constantly rejecting reasonable graphs because of unnecessary structural restrictions.

---

# FINAL INSTRUCTION

Do not attempt to make FlowForge a universal formal workflow theorem prover.

This is a strong prototype of an:

> **AI-assisted natural-language workflow compiler with deterministic verification and executable simulation.**

Its strength should come from having a **small number of strong, explainable rules**, not hundreds of interacting exceptions.

The central principle is:

> **Strict about meaning. Flexible about representation. Deterministic about verification. Predictable about execution.**

First analyze the existing implementation against this specification.

Then provide:

1. Current architecture findings.
2. Modules to preserve.
3. Modules to remove/simplify.
4. Proposed canonical IR.
5. Proposed rule-engine structure.
6. Proposed executor structure.
7. Migration plan.
8. Test plan.

Only after that analysis, implement the redesign systematically without redesigning stable frontend components.