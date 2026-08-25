# FlowForge — Natural Language to Verified Workflow Compiler

FlowForge is an **AI-assisted workflow compiler** that converts natural-language process descriptions into structured, visual, verified, executable, and reusable workflows.

The project is built around the problem statement:

> **Natural Language to Verified Workflow Compiler**

The core idea is to combine the simplicity of a **ChatGPT-like conversational interface** with the power of an **n8n-style visual workflow environment**, while adding an important layer that traditional AI workflow generators often lack: **verification before execution**.

A user should be able to describe a process in ordinary language, see the system convert that description into a workflow graph, inspect and edit the workflow visually, verify whether the generated workflow actually matches the original requirement, execute it safely, and save it for future use.

---

## Problem Statement

Building workflows today generally requires one of two approaches.

The first approach is to manually build automation logic using tools such as workflow editors, low-code platforms, or orchestration systems. These tools are powerful, but users still need to understand nodes, branches, conditions, data flow, dependencies, and execution order.

The second approach is to use an AI model to generate automation logic from natural language. This is easier for the user, but introduces a serious reliability problem.

An AI model can generate a workflow that **looks correct visually while being logically incorrect**.

Typical failures include:

- Missing required actions
- Extra or unnecessary nodes
- Incorrect ordering
- Invalid branching
- Missing TRUE or FALSE paths
- Undefined conditions
- Orphan nodes
- Unreachable nodes
- Broken dependencies
- Incorrect node relationships
- Different graph structures for the same requirement
- Visual edits that do not remain synchronized with the internal workflow definition
- AI-generated workflows that are executed without being properly verified

FlowForge addresses this by treating natural-language workflow generation as a **compiler problem**, not only a diagram-generation problem.

The system first understands the requirement, converts it into a structured workflow representation, compiles it into a graph, verifies that graph, repairs or regenerates invalid workflows when possible, and only then allows the workflow to move toward execution.

---

# Reference Idea

FlowForge takes inspiration from two familiar interaction models.

## ChatGPT-Like Interaction

The user should not need to know how to manually construct every node.

Instead, the user can describe the required process naturally.

For example:

```text
When a support ticket is received, classify its severity.

If the severity is critical, escalate it to the support lead.

Otherwise assign it to the normal support queue.

Save the result.
```

The AI understanding layer interprets the requirement and determines:

- The trigger
- Required actions
- Conditions
- TRUE and FALSE branches
- Ordering
- Dependencies
- Outputs
- Required workflow completion behavior

This gives FlowForge the simplicity of a conversational AI interface.

## n8n-Style Workflow Environment

After understanding the requirement, FlowForge represents the process visually as connected workflow nodes.

For example:

```text
Receive Ticket
      |
      v
Classify Severity
      |
      v
Is Severity Critical?
     / \
 TRUE   FALSE
  |       |
  v       v
Escalate  Normal Queue
     \     /
      \   /
       v v
     Save Result
```

The user can inspect the generated flow visually, similar to modern workflow automation platforms.

However, in FlowForge the graph is not merely a drawing.

Every node and every connection is part of the actual workflow definition.

---

# Core Idea

FlowForge combines:

```text
ChatGPT-like natural-language input
                +
n8n-style visual workflow environment
                +
Structured workflow compiler
                +
AI-assisted verification
                +
Deterministic validation
                +
Workflow regeneration / repair
                +
Execution
                +
Workflow saving and reuse
```

The complete concept can be represented as:

```text
Natural Language
       |
       v
AI Understanding
       |
       v
Structured Workflow Plan
       |
       v
Workflow IR
       |
       v
Compiler
       |
       v
Visual Workflow
       |
       v
Verification
   +---+---+
   |       |
 VALID   INVALID
   |       |
   |       v
   |    Regenerate
   |       |
   |       v
   |    Re-Verify
   |       |
   +-------+
       |
       v
Execution
       |
       v
Save / Reuse Workflow
```

---

# Main Objectives

FlowForge is designed to achieve the following goals:

1. Convert natural-language requirements into structured workflows.
2. Reduce the need for users to manually create automation graphs.
3. Preserve the meaning and order of the original requirement.
4. Prevent unnecessary node generation.
5. Use semantic workflow connections rather than decorative graph edges.
6. Detect structurally incorrect workflows.
7. Detect workflows that do not match the original requirement.
8. Automatically regenerate rejected workflows when possible.
9. Keep the visual workflow synchronized with the underlying workflow representation.
10. Execute only workflows that have passed the required validation stages.
11. Allow workflows to be stored, reopened, inspected, and reused.
12. Support both local and online AI providers through a controlled planner interface.

---

# System Architecture

FlowForge separates AI understanding from deterministic workflow behavior.

```text
+------------------------------------------------------+
|                 NATURAL LANGUAGE                     |
|          User describes required workflow            |
+---------------------------+--------------------------+
                            |
                            v
+------------------------------------------------------+
|                UNDERSTANDING LAYER                   |
|                                                      |
|  Intent • Actions • Conditions • Order • Dependencies|
+---------------------------+--------------------------+
                            |
                            v
+------------------------------------------------------+
|              STRUCTURED WORKFLOW PLAN                |
|                                                      |
|       Required nodes, branches and semantics         |
+---------------------------+--------------------------+
                            |
                            v
+------------------------------------------------------+
|              INTERMEDIATE REPRESENTATION             |
|                        IR                            |
+---------------------------+--------------------------+
                            |
                            v
+------------------------------------------------------+
|                     COMPILER                         |
|                                                      |
|       IR -> typed nodes -> semantic graph            |
+---------------------------+--------------------------+
                            |
                            v
+------------------------------------------------------+
|                WORKFLOW STUDIO                       |
|                                                      |
|            Visual representation of graph            |
+---------------------------+--------------------------+
                            |
                            v
+------------------------------------------------------+
|                  VERIFICATION                        |
|                                                      |
| Structural + semantic + requirement-level validation |
+---------------------------+--------------------------+
                            |
                  +---------+---------+
                  |                   |
                VALID              INVALID
                  |                   |
                  |                   v
                  |          Fresh regeneration
                  |                   |
                  |                   v
                  |              Re-verify
                  |                   |
                  +---------+---------+
                            |
                            v
+------------------------------------------------------+
|                     EXECUTION                        |
|                                                      |
|      Run the accepted workflow using graph rules     |
+---------------------------+--------------------------+
                            |
                            v
+------------------------------------------------------+
|               WORKFLOW LIBRARY                      |
|                                                      |
|       Save, reopen, inspect and reuse workflows      |
+------------------------------------------------------+
```

---

# Natural-Language Compiler

The compiler workflow starts from a user requirement instead of a manually constructed graph.

The user enters natural language in the compiler interface.

The input stage supports:

- Free-form workflow descriptions
- Example prompts
- Voice input through browser speech recognition when supported
- AI provider selection
- Connection testing
- AI planning status
- Compilation progress

The planner interprets the natural-language requirement and produces a structured workflow representation.

The model is not allowed to directly control execution.

Its role is to understand the requirement and propose a compiler-ready workflow structure.

---

# AI Provider Support

The current compiler supports selectable AI providers.

The interface includes support for:

- **LM Studio** for a locally hosted model
- **NVIDIA-hosted AI provider** for online inference

The system includes a provider connection test so users can check whether the selected AI backend is available before generating a workflow.

This keeps the workflow compiler flexible while preserving the same structured workflow contract regardless of the selected model provider.

---

# Intermediate Representation — Workflow IR

Natural-language output is not sent directly to the visual editor.

FlowForge uses a structured **Workflow Intermediate Representation (IR)**.

The IR acts as the contract between:

```text
AI Understanding
      |
      v
Workflow Compiler
      |
      v
Verification
      |
      v
Studio
      |
      v
Execution
```

The IR represents concepts such as:

- Trigger nodes
- Action nodes
- Conditions
- Approvals
- Input/output operations
- Branches
- Joins
- Dependencies
- Semantic connections
- Outcome paths
- Workflow metadata

Using an IR reduces the risk of the visual editor and AI output becoming two independent sources of truth.

---

# Semantic Workflow Connections

A critical design rule in FlowForge is that workflow connections carry meaning.

An edge is not just a visual line.

A connection may represent:

```text
NEXT
TRUE
FALSE
SUCCESS
FAILURE
BRANCH
JOIN
```

For example:

```text
                 TRUE
                  |
                  v
            Escalate Ticket
                 ^
                 |
Receive -> Classify -> Critical?
                 |
                 v
             Normal Queue
                 |
                FALSE
```

The compiler, verifier, Studio, and execution engine can therefore reason about the relationship between nodes.

This makes the graph part of the actual program.

---

# Workflow Studio

The Workflow Studio provides the visual workflow environment.

It is designed to provide the usability of modern low-code workflow tools while remaining connected to FlowForge's compiler architecture.

The Studio can represent:

- Workflow nodes
- Connections
- Conditions
- Branches
- Dependencies
- Execution order
- Node configuration
- Workflow structure

The visual editor should never become an independent drawing layer.

The core principle is:

> **What the user sees in the Studio must represent the actual workflow that the compiler, verifier, and executor understand.**

Any structural editing of the workflow must therefore remain synchronized with the underlying workflow model.

---

# Verification Stage

Verification is one of the most important differences between FlowForge and a simple AI workflow generator.

Generating a graph does not automatically mean the graph is correct.

Before a workflow is accepted, FlowForge can examine it using multiple validation layers.

## Structural Verification

Structural rules can detect problems such as:

- Orphan nodes
- Unreachable nodes
- Missing connections
- Missing branches
- Invalid cycles
- Broken graph topology
- Invalid outcome connections
- Incorrect node structure

## Condition Verification

Condition-related validation can detect:

- Missing TRUE branch
- Missing FALSE branch
- Duplicate TRUE or FALSE branches
- Undefined conditions
- Invalid branch configuration
- Unsupported condition behavior

## Requirement Verification

The verifier also compares the generated workflow against the original natural-language requirement.

It can detect situations such as:

- Required action missing from graph
- Action placed in the wrong order
- Required dependency not represented
- Workflow behavior inconsistent with original prompt
- Generated topology that does not satisfy the requested process

## Semantic Verification

Because edges have meaning, verification can inspect semantic relationships rather than only checking whether nodes are connected.

---

# AI Verification + Deterministic Verification

FlowForge uses AI where semantic reasoning is useful, but deterministic rules remain responsible for enforcing workflow correctness.

The verifier therefore follows the principle:

```text
AI reasoning
     +
Deterministic structural rules
     =
Verified workflow decision
```

A model cannot simply declare a graph valid if deterministic rules show that the graph is broken.

Deterministic validation can override an optimistic AI verdict.

This creates a stronger verification boundary between generation and execution.

---

# Verification Verdicts

The verification layer supports clear workflow outcomes.

Conceptually, a workflow can be classified as:

```text
RIGHT
WRONG
NEEDS_INPUT
```

### RIGHT

The workflow satisfies the required validation gates and can proceed.

### WRONG

The generated workflow contains structural or semantic problems and should not be accepted in its current form.

### NEEDS_INPUT

The original requirement contains unresolved information that must be clarified before the system can safely create a complete workflow.

---

# Workflow Regeneration

When a workflow is rejected, FlowForge does not rely only on displaying an error message.

The system can use verification evidence to generate a replacement workflow.

An important design principle is:

> **Do not keep patching a fundamentally incorrect graph.**

When the verifier rejects the topology, the planner can generate a fresh complete workflow from the original requirement.

Conceptually:

```text
Original Requirement
        |
        v
Generated Workflow
        |
        v
Verification
        |
     INVALID
        |
        v
Discard failed topology
        |
        v
Generate complete replacement
        |
        v
Deterministic validation
        |
        v
Re-Verification
```

This reduces graph corruption caused by repeatedly applying small repairs to an already incorrect structure.

---

# Deterministic Acceptance

A regenerated workflow is not automatically trusted simply because an AI model produced it.

The replacement must still satisfy deterministic acceptance rules.

This helps prevent a repair cycle where one invalid AI response is replaced by another invalid AI response.

The objective is:

```text
Generate
   |
Validate
   |
Verify
   |
Accept
```

rather than:

```text
Generate
   |
Assume correct
   |
Execute
```

---

# Workflow Execution

Execution is treated as a separate stage after workflow construction and verification.

The execution layer follows the accepted workflow graph.

It respects:

- Node ordering
- Conditions
- Semantic branches
- Dependencies
- Execution state
- Workflow outcomes

The architecture intentionally prevents the AI model from directly controlling runtime behavior.

The AI proposes the workflow.

The structured workflow controls execution.

---

# Execution Feedback

Execution results can also become useful evidence for verification.

If execution exposes a failure, that information can be supplied back to the verification process.

Conceptually:

```text
Verified Workflow
       |
       v
Execution
       |
       v
Failure Evidence
       |
       v
Verification
       |
       v
Regeneration / Correction
```

This creates a path for improving a workflow based on real execution behavior while still keeping verification in control.

---

# Workflow Saving and Library

Generated workflows are intended to be reusable rather than temporary.

FlowForge includes a workflow library concept for storing workflow definitions.

This enables users to:

- Save workflows
- Reopen previous workflows
- Review workflow structure
- Reuse verified workflows
- Continue editing existing workflows
- Keep workflow configurations available for later execution

The workflow library forms the persistence layer for reusable automation designs.

---

# Application Modules

The current application is organized into several major modules.

## Dashboard

The dashboard provides an overview of the FlowForge environment.

It is designed to surface information such as:

- Workflow activity
- Recent workflows
- Workflow status
- Verification state
- Diagnostics
- Execution activity
- System status

## Compiler

The Compiler is the natural-language entry point.

Users describe what they want the workflow to do and the system converts it into a structured workflow.

## Workflow Studio

The Studio shows the compiled workflow visually and allows the graph to be inspected and configured.

## Verification

The Verification module analyzes the workflow for structural, semantic, and requirement-level correctness.

## Executions

The execution area represents the runtime stage for accepted workflows.

## Workflow Library

The Library stores workflows so that they can be reopened and reused.

## Integrations

The Integrations section represents connections to external systems and services used by workflow nodes.

## Policies

Policies provide a place for workflow rules and constraints that govern acceptable workflow behavior.

## Settings

Settings contain system and application configuration.

---

# End-to-End User Experience

The intended user journey is simple.

## Step 1 — Describe

The user explains the workflow in natural language.

```text
Every day check each student's attendance.

If the student is present, mark present.

Otherwise mark absent.

Save the attendance record.
```

## Step 2 — Understand

The AI planner identifies:

```text
Trigger
  -> Daily schedule

Action
  -> Check attendance

Condition
  -> Student present?

TRUE
  -> Mark present

FALSE
  -> Mark absent

Final action
  -> Save attendance
```

## Step 3 — Compile

The structured interpretation is converted into Workflow IR and then into a graph.

## Step 4 — Visualize

The workflow is displayed in the Workflow Studio.

## Step 5 — Verify

FlowForge checks whether the graph is structurally valid and whether it matches the original requirement.

## Step 6 — Regenerate if Required

If the generated graph is rejected, a new complete candidate can be generated and validated.

## Step 7 — Execute

After acceptance, the workflow can proceed to execution.

## Step 8 — Save

The workflow can be stored in the Library for later inspection and reuse.

---

# Why Verification Matters

Consider this requirement:

```text
Receive an incident.

Classify its severity.

If it is critical, escalate it.

Otherwise continue normal processing.
```

A normal generative system might output:

```text
Receive Incident
      |
      v
Is Critical?
      |
      v
Escalate
```

The graph looks reasonable but is wrong because the required **Classify Severity** action is missing and the FALSE branch is absent.

FlowForge aims to detect these errors before execution.

A correct representation should resemble:

```text
Receive Incident
      |
      v
Classify Severity
      |
      v
Is Critical?
   /      \
TRUE      FALSE
 |          |
 v          v
Escalate   Continue
```

This illustrates why the project is a **verified workflow compiler**, not merely an AI diagram generator.

---

# Preventing Unnecessary Nodes

Another goal is to reduce AI-generated workflow expansion.

If the requirement says:

```text
Receive Request
Validate Request
Process Request
Send Response
```

the compiler should preserve that intent.

It should not invent unrelated stages such as:

```text
Receive Request
Analyze Request
Prepare Request
Review Request
Validate Request
Process Request
Validate Processing
Generate Report
Send Response
```

unless those steps are required by the user's request or by an explicit workflow rule.

This improves:

- Predictability
- Repeatability
- Explainability
- Workflow simplicity
- Verification reliability

---

# Workflow Graph as Source of Truth

The workflow graph carries the structure required by the system.

That means the graph should capture:

```text
What happens
When it happens
What comes next
Why one node connects to another
Which branch is TRUE
Which branch is FALSE
What dependencies exist
Where execution can continue
Where execution ends
```

The visual workflow, compiler representation, verifier, and execution engine should therefore describe the same process.

---

# Separation of Responsibilities

FlowForge intentionally separates major responsibilities.

```text
Natural-language interaction
          |
          v
AI understanding
          |
          v
Workflow IR
          |
          v
Compiler
          |
          v
Graph
          |
          v
Verification
          |
          v
Execution
          |
          v
Persistence
```

This separation is important because each layer has a different purpose.

### AI Understanding

Interprets human requirements.

### IR

Stores structured workflow intent.

### Compiler

Transforms structured intent into an executable graph representation.

### Studio

Provides visual interaction with the graph.

### Verification

Determines whether the graph is valid and faithful to the requirement.

### Execution

Runs the accepted workflow.

### Library

Stores workflows for reuse.

---

# Reliability Principle

The project follows one central reliability rule:

> **AI can propose workflow logic, but deterministic systems must decide whether that workflow is structurally acceptable.**

This is intended to reduce dependence on model randomness.

---

# Technology Stack

The current project uses:

- **React 19**
- **TypeScript**
- **Vite**
- **TanStack Router**
- **TanStack Start**
- **XYFlow / React Flow**
- **Tailwind CSS**
- **Framer Motion**
- **Radix UI components**
- **Zod**
- **Node.js / npm**

The workflow system also contains custom modules for:

- Workflow IR
- IR normalization
- Requirement planning
- Node contracts
- Structural rules
- Workflow engine
- Workflow state
- Workflow library
- Workflow verification
- AI provider handling
- AI workflow planning
- Workflow test generation

---

# Project Structure

A simplified conceptual structure is:

```text
src/
|
+-- components/
|   |
|   +-- layout/
|   +-- ui/
|   +-- workflow/
|
+-- lib/
|   |
|   +-- workflow-ir
|   +-- workflow-ir-normalizer
|   +-- workflow-engine
|   +-- workflow-structural-rules
|   +-- workflow-store
|   +-- workflow-library
|   +-- requirement-plan
|   +-- requirement-contract
|   +-- node-contracts
|
+-- routes/
|   |
|   +-- dashboard
|   +-- compiler
|   +-- studio
|   +-- verification
|   +-- executions
|   +-- library
|   +-- integrations
|   +-- policies
|   +-- settings
|
+-- server-functions/
    |
    +-- workflow-planner
    +-- workflow-verifier
    +-- workflow-test-generator
    +-- llm-provider
    +-- llm-health
```

---

# Installation

Clone the repository:

```bash
git clone https://github.com/AakshayDhoke-lang/CH26-P03-MINIONS.git
```

Move into the project directory:

```bash
cd CH26-P03-MINIONS
```

Install the required dependencies:

```bash
npm install
```

---

# Run the Project

Start the development server:

```bash
npm run dev
```

After the server starts, open the **Local URL displayed by Vite in the terminal**.

No fixed port is documented here because the development server may choose a different available port depending on the machine and environment.

---

# Available Development Commands

Run the application:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

Run the workflow-engine regression tests:

```bash
npm run test:engine
```

Run the workflow-understanding regression tests:

```bash
npm run test:v5
```

Run linting:

```bash
npm run lint
```

---

# Current Validation Status

The current implementation includes regression tests for the workflow understanding and workflow engine layers.

The latest validated project state passed:

```text
Workflow Understanding Tests    12 / 12 PASS
Workflow Engine Tests           24 / 24 PASS
--------------------------------------------
Total                           36 / 36 PASS
```

These tests help ensure that UI changes do not silently alter the tested workflow behavior.

---

# Development Principles

When extending FlowForge, the following principles should be maintained.

## 1. Do Not Treat Connections as Decorative

Connections must preserve semantic meaning.

## 2. Keep Studio and Workflow Model Synchronized

A visual change that affects workflow structure must also affect the underlying graph representation.

## 3. Do Not Let AI Bypass Validation

AI output must be normalized, compiled, and verified.

## 4. Preserve the Original Requirement

Verification and regeneration must continue to refer to the original user requirement.

## 5. Prefer Complete Regeneration for Rejected Topologies

If the workflow structure is fundamentally wrong, generate a new complete candidate rather than repeatedly applying fragile patches.

## 6. Verify Again After Regeneration

A repaired or regenerated workflow must pass validation before acceptance.

## 7. Keep Execution Separate from Generation

The generation model should not directly control runtime execution.

## 8. Make Saved Workflows Reusable

A verified workflow should be capable of being reopened and reused without requiring complete regeneration every time.

---

# Example End-to-End Architecture

```text
USER
 |
 | Natural-language workflow requirement
 v
+----------------------+
| Chat-style Compiler  |
+----------+-----------+
           |
           v
+----------------------+
| AI Understanding     |
| Planner              |
+----------+-----------+
           |
           v
+----------------------+
| Workflow IR          |
+----------+-----------+
           |
           v
+----------------------+
| Deterministic        |
| Compiler             |
+----------+-----------+
           |
           v
+----------------------+
| Workflow Studio      |
| Visual Graph         |
+----------+-----------+
           |
           v
+----------------------+
| Verification Engine  |
| AI + Deterministic   |
+----------+-----------+
           |
       +---+---+
       |       |
     VALID   WRONG
       |       |
       |       v
       |   Regenerate
       |       |
       |       v
       |   Re-Verify
       |       |
       +---+---+
           |
           v
+----------------------+
| Execution            |
+----------+-----------+
           |
           v
+----------------------+
| Save to Library      |
+----------------------+
```

---

# Project Vision

FlowForge aims to make workflow automation accessible through natural language without sacrificing correctness.

The goal is not simply:

> **"Ask AI to draw a workflow."**

The goal is:

> **"Describe a process naturally, compile it into a structured workflow, verify that the graph actually represents the process, execute it safely, and save it for reuse."**

The project therefore combines the strongest parts of conversational AI and visual automation environments while introducing a verification layer between generation and execution.

In short:

```text
ChatGPT-like interaction
        +
n8n-like visual workflows
        +
Compiler architecture
        +
AI reasoning
        +
Deterministic verification
        +
Execution
        +
Workflow persistence
        =
FlowForge
```

---

## Repository

**CH26-P03-MINIONS**

Problem statement:

**Natural Language to Verified Workflow Compiler**
