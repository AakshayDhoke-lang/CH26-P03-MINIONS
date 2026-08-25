# FlowForge — AI-Assisted Deterministic Workflow Generation

FlowForge is an **AI-assisted workflow generation, verification, visualization, repair, and execution platform** that converts natural-language requirements into structured and machine-verifiable workflows.

The current project combines the **FlowForge v5 Understanding architecture** with the **Phase 2 dashboard and UI design system**.

The central idea behind FlowForge is:

> **AI understands the workflow the user wants. Structured and deterministic systems control how that workflow is represented, verified, repaired, visualized, and executed.**

---

## 🚀 Current Version

### FlowForge v5 Understanding + Phase 2 UI

This version combines two major parts of the project:

**v5 Understanding Engine**

* Natural-language workflow understanding
* Structured workflow generation
* Intermediate Representation (IR)
* Workflow compiler
* Semantic node connections
* Deterministic verification
* Workflow repair/regeneration
* Workflow Studio
* Execution architecture

**Phase 2 Frontend**

* Original Phase 2 dashboard design
* Blue/teal theme
* Sidebar navigation
* Top navigation
* Dashboard cards
* Workflow status presentation
* Light application layout
* Consistent UI/UX across v5 pages

The Phase 2 frontend was integrated **without changing the core working behavior of v5 Understanding**.

---

# 🎯 What Problem Does FlowForge Solve?

AI can easily generate a workflow diagram.

The difficult part is ensuring that the generated workflow is actually **correct**.

Typical AI-generated workflow systems may create:

* Unnecessary nodes
* Missing required actions
* Incorrect action ordering
* Invalid conditions
* Missing TRUE/FALSE branches
* Orphan nodes
* Unreachable nodes
* Broken connections
* Incorrect dependencies
* Different workflows for the same requirement
* Visual workflows that no longer match their internal representation

FlowForge approaches this differently.

Instead of allowing an LLM to directly control the workflow graph, FlowForge separates the system into multiple controlled stages.

---

# 🧠 Core Architecture

```text
Natural Language Requirement
            │
            ▼
┌──────────────────────────────┐
│      Understanding Layer     │
│                              │
│ • Understand intent          │
│ • Detect required actions    │
│ • Detect conditions          │
│ • Detect ordering            │
│ • Detect dependencies        │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     Structured Workflow      │
│                              │
│ • Nodes                      │
│ • Semantic connections       │
│ • Conditions                 │
│ • Branches                   │
│ • Dependencies               │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Intermediate Representation  │
│             (IR)             │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│          Compiler            │
│                              │
│ IR → Workflow representation │
│ IR → Visual representation   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│         Verification         │
│                              │
│ • Structural checks          │
│ • Semantic checks            │
│ • Requirement checks         │
│ • Connection checks          │
└──────────────┬───────────────┘
               │
          ┌────┴────┐
          │ Valid ? │
          └────┬────┘
          YES  │  NO
          │    │
          │    ▼
          │  Repair
          │    │
          │    ▼
          │ Re-Verify
          │    │
          └────┘
               │
               ▼
┌──────────────────────────────┐
│       Workflow Studio        │
│                              │
│ Visual representation of     │
│ actual workflow structure    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│          Execution           │
│                              │
│ Execute verified workflow    │
└──────────────────────────────┘
```

---

# 💡 Fundamental Design Principle

FlowForge does **not** treat a workflow as only a flowchart.

A workflow is a structured graph containing:

```text
Nodes
+
Semantic Connections
+
Conditions
+
Dependencies
+
Execution Rules
```

The diagram displayed in Workflow Studio is therefore a **visual representation of the real workflow structure**.

---

# 🔗 Semantic Connections

One of the important concepts in the current architecture is that connections between nodes have meaning.

A connection is not simply:

```text
Node A ───────── Node B
```

Instead, it can represent:

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
                 ┌── TRUE ──→ Escalate Ticket
                 │
Receive → Classify → Is Critical?
                 │
                 └── FALSE ─→ Normal Queue
```

The system therefore understands not only **which nodes are connected**, but also **why they are connected**.

This information can then be used by:

* The compiler
* Verification engine
* Repair system
* Workflow Studio
* Execution engine

---

# 🧠 Understanding Layer

The Understanding Layer converts natural-language requirements into structured workflow intent.

Example:

```text
When a support ticket arrives, classify its severity.

If the severity is critical, escalate it to the support lead.

Otherwise assign it to the normal support queue.
```

The system should identify:

### Trigger

```text
Support ticket received
```

### Required Action

```text
Classify severity
```

### Condition

```text
severity == critical
```

### TRUE Branch

```text
Escalate to support lead
```

### FALSE Branch

```text
Assign to normal support queue
```

The Understanding Layer therefore focuses on **understanding the user's intended workflow**, rather than directly drawing arbitrary nodes.

---

# 🧩 Intermediate Representation — IR

FlowForge uses an **Intermediate Representation (IR)** as the structured representation of a workflow.

Conceptually:

```text
Natural Language
       ↓
Understanding
       ↓
Structured Intent
       ↓
IR
       ↓
Compiler
       ↓
Workflow
```

The IR represents workflow concepts such as:

```text
Trigger
Action
Condition
Approval
I/O
Branch
Join
Dependencies
Connections
Outcomes
```

This creates a boundary between AI understanding and the actual workflow implementation.

---

# ⚙️ Compiler

The compiler converts the structured workflow/IR into the representation required by FlowForge.

The compiler is responsible for preserving:

* Node identity
* Node type
* Node order
* Semantic connections
* Conditions
* Branch outcomes
* Dependencies
* Workflow structure

The compiler should **not invent business logic that was not present in the understood requirement**.

---

# 🛡️ Verification Engine

Generation alone is not considered sufficient.

Every workflow can be checked by the verification system.

The verifier analyzes both the structure of the workflow and whether it represents the original requirement correctly.

## Structural Verification

The system can detect issues such as:

```text
Orphan nodes
Unreachable nodes
Missing connections
Invalid graph structures
Accidental cycles
Broken workflow paths
```

## Condition Verification

Conditions can be checked for:

```text
Missing TRUE branch
Missing FALSE branch
Duplicate TRUE branches
Duplicate FALSE branches
Undefined expressions
Invalid branch placement
Unsupported condition structures
```

## Requirement Verification

The verifier can identify:

```text
Missing required actions
Incorrect action ordering
Missing dependencies
Incorrect workflow paths
Workflow behavior inconsistent with the requirement
```

## Semantic Verification

Because connections contain meaning, verification can reason about the relationship between nodes rather than only their visual position.

---

# 🔧 Verification + Automatic Repair

Verification should not simply say:

```text
ERROR: Missing required action
```

and stop.

The current architecture is designed around a verification and repair cycle:

```text
Generate
   │
   ▼
Compile
   │
   ▼
Verify
   │
   ▼
Valid?
 ┌─┴─┐
YES  NO
 │    │
 │    ▼
 │  Repair
 │    │
 │    ▼
 │ Recompile
 │    │
 │    ▼
 │ Re-verify
 │    │
 └────┘
   │
   ▼
Ready
```

Repair should use:

1. Original user requirement
2. Existing workflow structure
3. Current nodes
4. Current semantic connections
5. Verification errors

This is important because the system should fix the incorrect part of a workflow **without unnecessarily regenerating unrelated parts**.

---

# 🎯 Deterministic Workflow Generation

A major objective of FlowForge is reducing unnecessary variation in AI-generated workflows.

For example, if the requirement is:

```text
Receive Request
      ↓
Validate Request
      ↓
Process Request
      ↓
Send Response
```

the system should not arbitrarily generate:

```text
Receive Request
      ↓
Analyze Request
      ↓
Prepare Request
      ↓
Validate Request
      ↓
Review Request
      ↓
Process Request
      ↓
Validate Processing
      ↓
Send Response
```

unless those steps are actually required.

This reduces:

* Workflow hallucination
* Unnecessary nodes
* Random restructuring
* Regeneration drift

---

# 🧠 Flow Diagram as Workflow Memory

The workflow structure itself provides important context for later operations.

When verification or repair occurs, the system can refer to:

```text
Existing nodes
Existing connections
Branch relationships
Execution order
Dependencies
Condition paths
```

rather than reconstructing the entire workflow from scratch every time.

This helps preserve the intended workflow during repair and modification.

---

# 🖥️ Workflow Studio

Workflow Studio provides the visual interface for inspecting the generated workflow.

It displays:

* Nodes
* Connections
* Conditions
* Branches
* Execution paths
* Workflow relationships

A major architectural requirement is:

> **The Studio must represent the actual workflow structure rather than maintaining an independent visual-only version of the workflow.**

The workflow model remains the source of truth.

---

# 🔄 Studio Synchronization

Visual editing must remain synchronized with the underlying workflow representation.

Conceptually:

```text
Workflow Model
      │
      ▼
     IR
      │
      ▼
Compiler
      │
      ▼
Workflow Studio
```

When workflow structure changes, those changes must remain meaningful to:

```text
Verification
Compiler
Repair
Execution
```

The Studio should therefore not become a disconnected visual editor.

---

# ▶️ Execution Layer

Only a workflow that satisfies the required validation rules should proceed toward execution.

The execution system follows the verified graph and respects:

* Node order
* Semantic connections
* Conditions
* Branch outcomes
* Dependencies
* Execution state

The architecture intentionally separates AI understanding from runtime execution.

```text
AI Understanding
       ↓
Structured Workflow
       ↓
Verification
       ↓
Execution
```

The AI model does not directly control runtime behavior.

---

# 🎨 Phase 2 UI Integration

The latest version uses the **Phase 2 FlowForge visual design system throughout the v5 application**.

The UI migration includes:

* Phase 2 dashboard style
* Light application background
* Blue/teal navigation
* Teal gradient actions
* White cards
* Consistent borders
* Dashboard metrics
* Workflow status cards
* Diagnostics presentation
* Consistent typography
* Sidebar navigation
* Top navigation

The purpose of this migration was purely UI/UX improvement.

The underlying v5 workflow architecture remains unchanged.

---

# 📊 Dashboard

The dashboard acts as the primary overview for FlowForge.

It provides visibility into areas such as:

```text
Workflow activity
Recent workflows
Workflow status
Verification status
Diagnostics
Generation activity
Execution state
```

The dashboard follows the Phase 2 visual language while remaining connected to the v5 application structure.

---

# 🧭 Application Modules

The current interface contains the major FlowForge areas.

## Dashboard

Overview of workflows and system activity.

## Workflow Studio

Visual workflow generation and inspection environment.

## Verification

Workflow validation, diagnostics, and verification results.

## Workflow Library

Access to generated or stored workflows.

## Integrations

External integration management.

## Policies

Workflow rules and constraints.

## Settings

Application configuration.

---

# 🏗️ System Separation

FlowForge maintains separation between major responsibilities:

```text
┌──────────────────────────┐
│          UI / UX         │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│      Understanding       │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│     Workflow Model       │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│            IR            │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│         Compiler         │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│       Verification       │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│          Repair          │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│        Execution         │
└──────────────────────────┘
```

This separation allows the UI to evolve without changing workflow semantics.

---

# 🛠️ Technology Stack

The current project uses a modern TypeScript/JavaScript application stack including:

```text
React
TypeScript
Vite
Node.js / npm
Component-based frontend architecture
Graph-based workflow representation
Structured workflow verification
```

---

# 📁 Conceptual Project Structure

```text
FlowForge
│
├── UI
│   ├── Dashboard
│   ├── Sidebar
│   ├── Topbar
│   ├── Workflow Studio
│   └── Application Pages
│
├── Understanding
│   └── Natural-language interpretation
│
├── Workflow Engine
│   ├── Nodes
│   ├── Semantic Connections
│   ├── Conditions
│   ├── Branches
│   └── Dependencies
│
├── IR
│   └── Structured workflow representation
│
├── Compiler
│   └── IR → Workflow / Visual representation
│
├── Verification
│   ├── Structural validation
│   ├── Semantic validation
│   ├── Requirement validation
│   └── Connection validation
│
├── Repair
│   └── Verification-guided workflow correction
│
└── Execution
    └── Verified workflow execution
```

---

# 📦 Installation

Clone the repository:

```bash
git clone https://github.com/AakshayDhoke-lang/CH26-P03-MINIONS.git
```

Enter the repository:

```bash
cd CH26-P03-MINIONS
```

Install dependencies:

```bash
npm install
```

---

# ▶️ Running FlowForge

Start the development environment:

```bash
npm run dev
```

Open the local address shown in the terminal.

For example:

```text
http://localhost:8080/
```

The actual port may differ depending on the development environment.

---

# 🧪 Regression Validation

During the Phase 2 UI migration, the v5 workflow behavior was kept unchanged.

The available regression checks after the migration passed:

```text
v5 Understanding Tests      12 / 12 PASS
Workflow Engine Tests       24 / 24 PASS
-----------------------------------------
Total                       36 / 36 PASS
```

This verifies that the UI migration did not intentionally modify the tested v5 workflow behavior.

---

# ⚠️ Development Rules

When developing FlowForge, maintain the separation between:

```text
UI
Understanding
Workflow Model
IR
Compiler
Verification
Repair
Execution
```

### UI Changes

UI/UX modifications should not silently modify workflow semantics.

### Compiler Changes

Compiler changes should preserve the meaning of the structured workflow.

### Studio Changes

Visual changes to workflow structure must remain synchronized with the actual workflow representation.

### Verification Changes

Verification should validate both graph correctness and requirement consistency.

### Repair Changes

Repair should preserve correct parts of the existing workflow whenever possible.

### Execution Changes

Execution should operate on validated workflow structures rather than directly on AI-generated text.

---

# 🔮 Project Direction

The long-term FlowForge pipeline is:

```text
Natural Language
        │
        ▼
Understanding
        │
        ▼
Structured Workflow
        │
        ▼
Intermediate Representation
        │
        ▼
Compiler
        │
        ▼
Deterministic Verification
        │
        ├──── Invalid ────→ Repair
        │                     │
        │                     └──→ Re-Verify
        │
        ▼
Workflow Studio
        │
        ▼
Execution
        │
        ▼
Execution Results
```

The objective is to build a workflow-generation system that is:

* **Predictable**
* **Explainable**
* **Verifiable**
* **Repairable**
* **Visually editable**
* **Semantically consistent**
* **Execution-safe**
* **Less dependent on LLM randomness**

---

# 🏁 Project Vision

FlowForge is not intended to be simply an:

> **AI Flowchart Generator**

The goal is to create an:

> **AI-assisted deterministic workflow engineering platform.**

AI is used where understanding and reasoning are valuable.

Deterministic components are used where correctness, consistency, validation, and execution matter.

```text
             AI
              │
              ▼
        UNDERSTANDING
              │
              ▼
     STRUCTURED WORKFLOW
              │
              ▼
        DETERMINISTIC
          COMPILER
              │
              ▼
        VERIFICATION
              │
        ┌─────┴─────┐
        │           │
      VALID       INVALID
        │           │
        │         REPAIR
        │           │
        └─────┬─────┘
              ▼
       WORKFLOW STUDIO
              │
              ▼
          EXECUTION
```

---

## Repository

**CH26-P03-MINIONS**

This repository contains the current FlowForge development version based on:

**FlowForge v5 Understanding + Phase 2 UI**
