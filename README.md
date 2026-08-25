<<<<<<< HEAD
# Flow Weaver

Build an Eye-Catching Frontend for an AI Natural Language → Verified Workflow Compiler

Create a complete, polished, highly interactive frontend web application for a hackathon project called:

FlowForge AI

Natural Language → Verified Workflow Compiler

The application converts a user's natural-language instructions into an automatically generated, verified, executable visual workflow.

The product should feel like a combination of:

AI chat interface

modern developer tool

n8n-style visual workflow builder

compiler/verification dashboard

workflow execution debugger

However, DO NOT clone n8n's branding or exact UI. Take inspiration from node-based workflow editors while creating an original visual identity.

1. PRODUCT CONCEPT

A user should be able to type or speak something like:

"When a new purchase request arrives, check the amount. If it is above ₹50,000, send it to the manager for approval. If approved, create the purchase order and notify finance."

The frontend should visually demonstrate the following pipeline:

Natural Language
→ AI/NLP Analysis
→ Detected Stages
→ Workflow Compilation
→ Visual Workflow
→ Verification
→ Automatic Fix Suggestions
→ Verified Workflow
→ Execution Simulation
→ Integration / Export

For this first version, create the complete frontend experience using realistic mock data and simulated processing.

Do NOT build the actual AI/NLP backend yet.

Architect the frontend so APIs can easily be connected later.

2. DESIGN DIRECTION

Create a premium futuristic developer-tool interface.

Visual style:

Dark theme as primary theme

Deep charcoal / near-black background

Glassmorphism panels where appropriate

Subtle gradients

Electric cyan / blue accents

Purple accent for AI operations

Green for verified/success

Amber for warnings

Red for errors

Soft glows around active AI/workflow elements

Thin borders

Large rounded cards

Smooth transitions

Clean typography

Spacious layout

The interface should look impressive on a projector during a hackathon presentation.

Avoid making everything glow excessively.

Use animations only where they communicate system activity.

3. APPLICATION LAYOUT

Create a persistent left sidebar.

Logo:

FlowForge AI

Subtitle:

Natural Language Workflow Compiler

Navigation:

Dashboard

AI Compiler

Workflow Studio

Verification

Executions

Integrations

Workflow Library

Policies

Settings

Bottom sidebar:

Documentation

System Status

User Profile

Top bar:

Current workflow name

Save

Version

Verification status

Run Workflow button

User avatar

4. DASHBOARD

Create an impressive dashboard landing page.

Hero section:

Turn Intent Into Execution

Subtitle:

"Describe a process. FlowForge understands it, compiles it, verifies it, and turns it into an executable workflow."

Primary button:

Create with AI

Secondary:

Open Workflow Studio

Include an animated pipeline:

Natural Language → Analyze → Compile → Verify → Execute

Dashboard statistics:

Total Workflows

Verified Workflows

Executions

Success Rate

Issues Detected

Issues Automatically Fixed

Include:

Recent Workflows

Example:

Purchase Approval
Employee Onboarding
Customer Complaint Handling
Invoice Processing

Show status:

VERIFIED
DRAFT
ISSUES FOUND
RUNNING

Also include a small recent execution activity panel.

5. AI COMPILER — MAIN INPUT EXPERIENCE

This is one of the most important screens.

Create a large AI chat-style interface.

Heading:

What should your workflow do?

Subtitle:

"Describe your business process naturally. We'll turn it into a verified workflow."

Large input box centered on screen.

Placeholder:

"Example: When a purchase request exceeds ₹50,000, send it to the manager for approval. After approval, create the purchase order and notify finance."

Inside the input area provide:

microphone icon

attachment icon

clear button

send/compile button

Primary CTA:

Generate Workflow

Include suggestions underneath:

"Try an example"

Cards:

Purchase Approval

Employee Onboarding

Customer Support

Invoice Processing

6. VOICE INPUT EXPERIENCE

Clicking the microphone should visually activate voice recording.

Show:

Listening...

Display an animated waveform.

Example live transcription:

"When a new customer submits a complaint..."

Buttons:

Cancel
Use Transcript

Make this interaction functional using frontend mock behavior or browser speech capabilities where appropriate.

7. AI / NLP ANALYSIS SCREEN

After the user submits instructions, transition to a dedicated processing experience.

Do NOT immediately display the workflow.

We want judges to visually understand that the system is interpreting and compiling the user's instructions.

Large central animation.

Heading:

Understanding your process...

Show animated processing stages:

01 — Parsing Language

"Breaking instructions into semantic components"

02 — Detecting Intent

"Identifying triggers, actions and outcomes"

03 — Extracting Entities

"Finding actors, variables and resources"

04 — Detecting Conditions

"Understanding branches and decision logic"

05 — Mapping Dependencies

"Determining execution order"

06 — Building Intermediate Representation

"Converting natural language into structured workflow logic"

Use an animated pipeline where stages progressively change from:

Pending → Processing → Complete

Include a subtle animated representation of text fragments being converted into structured tokens/nodes.

Example side panel:

NLP Insights

Trigger:
Purchase Request Created

Actors:
Employee
Manager
Finance

Variables:
Purchase Amount

Condition:
Amount > ₹50,000

Actions:
Manager Approval
Create Purchase Order
Notify Finance

8. DETECTED WORKFLOW STAGES

After analysis completes, show:

We understood your workflow

Subtitle:

"FlowForge identified the following stages from your instructions."

Show horizontally or vertically connected cards.

Example:

Trigger

Purchase Request Received

↓

Action

Read Purchase Amount

↓

Condition

Amount > ₹50,000?

↓

Approval

Manager Approval

↓

Action

Create Purchase Order

↓

Notification

Notify Finance

Use different visual identities for node types.

Trigger → lightning icon
Action → play/gear icon
Condition → diamond/split icon
Approval → user/check icon
Notification → bell icon
API → globe icon
Database → database icon
Delay → clock icon

Allow:

Edit

Delete

Reorder

Add Stage

Show:

6 stages detected

Primary CTA:

Compile Workflow

9. COMPILATION ANIMATION

When Compile Workflow is clicked, show another short transition.

Heading:

Compiling workflow...

Animation:

Detected stages

↓

Structured Intermediate Representation

↓

Graph generation

↓

Workflow

Show small compiler-style messages:

Parsing workflow IR...

Resolving dependencies...

Generating nodes...

Generating edges...

Validating branches...

Workflow graph generated successfully.

Then automatically transition to Workflow Studio.

10. WORKFLOW STUDIO

This is the visual centerpiece of the application.

Create a full-screen node-based workflow editor inspired by professional tools such as n8n, Node-RED and modern graph editors.

Prefer React Flow / XYFlow for the implementation.

The canvas must support:

drag nodes

zoom

pan

connect nodes

disconnect nodes

select nodes

delete nodes

minimap

fit-to-screen

zoom controls

Do not create a static image of a workflow.

The nodes must be real interactive frontend components.

Example generated workflow:

START

↓

Purchase Request

↓

Check Amount

↓

Amount > ₹50,000?

YES → Manager Approval
NO → Create Purchase Order

Manager Approval

↓

Approved?

YES → Create Purchase Order
NO → Request Rejected

↓

Notify Finance

↓

END

11. NODE DESIGN

Create reusable node components.

Node categories:

Trigger

Starts workflow.

Action

Performs operation.

Condition

Creates branches.

Approval

Requires human approval.

HTTP/API

Calls external service.

Webhook

Receives external event.

Database

Reads/writes data.

Notification

Sends message.

Delay

Waits before continuing.

End

Terminates workflow.

Each node should show:

Icon
Node type
Node name
Status
Input connector
Output connector

Condition nodes should have:

TRUE output
FALSE output

Nodes should open a configuration drawer when clicked.

12. WORKFLOW TOOLBAR

Left side floating toolbar:

Trigger

Action

Condition

Approval

API

Database

Notification

Delay

Top workflow toolbar:

Undo
Redo
Zoom
Fit
Auto Layout
Verify
Run

Bottom-left:

Minimap

13. NODE CONFIGURATION DRAWER

Clicking a node opens a right-side panel.

Example:

Manager Approval

Type:
Approval

Role:
Manager

Timeout:
24 hours

On Approval:
Continue

On Rejection:
Stop Workflow

Buttons:

Save Changes
Delete Node

Changes should update the visual workflow.

14. VERIFICATION SYSTEM

Add a prominent button:

Verify Workflow

Clicking it should start an animated graph scan.

Animate the workflow edges/nodes sequentially as if the verification engine is inspecting them.

Show:

Checking structure...

Checking graph reachability...

Checking circular dependencies...

Checking authorization policies...

Checking ambiguous conditions...

Checking termination paths...

Then open the Verification Center.

15. VERIFICATION CENTER

Create a professional compiler-like validation interface.

Header:

Workflow Verification

Show:

Verification Score

Example:

78 / 100

Status:

⚠ Issues Detected

Cards:

Structural Integrity
Graph Integrity
Authorization
Business Rules
Ambiguity
Execution Safety

Example results:

✓ Trigger Valid

Workflow contains a valid starting event.

✓ Authorization Valid

Manager approval role exists.

⚠ Undefined Rejection Path

The workflow defines what happens when approval succeeds but does not define what happens when the manager rejects the request.

Affected node:

Manager Approval

🔴 Possible Circular Dependency

Notification → Approval → Notification

Display:

Affected nodes
Reason
Severity
Suggested fix

16. VISUAL ERROR HIGHLIGHTING

When verification detects a problem, visually highlight the affected workflow node.

Example:

Manager Approval

RED BORDER

Warning badge:

Missing rejection path

Clicking the warning should center the graph on the affected node.

17. AI FIX EXPERIENCE

For each issue provide:

Fix with AI

Example:

Issue

Manager Approval has no rejection path.

Suggested Fix

Add:

Manager Approval
↓ REJECTED
Notify Requester
↓
End Workflow

Buttons:

Apply Fix

Modify

Ignore

When Apply Fix is clicked:

Animate a new node appearing on the workflow canvas and automatically connect it.

Then re-run verification.

18. VERIFIED STATE

Once all critical issues are resolved, create a satisfying visual transition.

Show:

✓ Workflow Verified

Subtitle:

"Your workflow passed structural, logical and policy verification."

Example:

Verification Score

100 / 100

Checks:

✓ Valid Trigger
✓ All Nodes Reachable
✓ No Circular Dependencies
✓ Authorization Valid
✓ All Branches Terminate
✓ No Critical Ambiguities

Change the workflow status in the top bar to:

VERIFIED

Primary CTA:

Run Workflow

19. EXECUTION / LIVE WORKFLOW SCREEN

This screen needs to be extremely visually impressive.

Show the workflow graph.

When:

Run Workflow

is clicked, simulate actual workflow execution.

Example:

Purchase Request

↓

Check Amount

↓

Amount > ₹50K

↓

Manager Approval

↓

Create PO

↓

Notify Finance

↓

Complete

Animate execution moving between nodes.

Use an animated pulse travelling along workflow edges.

Node states:

GRAY = Waiting

BLUE/PURPLE = Running

GREEN = Completed

RED = Failed

AMBER = Waiting for human action

Example:

Purchase Request
✓ Completed

Check Amount
✓ Completed

Amount > ₹50K
✓ TRUE

Manager Approval
⏳ Waiting for approval

Provide buttons:

Approve
Reject

Click Approve.

Then continue animation:

Create Purchase Order
✓ Completed

Notify Finance
✓ Completed

END
✓ Workflow Completed

20. EXECUTION LOG

Right-side panel:

Live Execution

Example:

10:42:01 Workflow started

10:42:01 Purchase request received

10:42:02 Amount extracted: ₹72,000

10:42:02 Condition evaluated

Result: TRUE

10:42:03 Waiting for Manager Approval

10:42:08 Manager approved

10:42:09 Purchase order created

10:42:10 Finance notified

10:42:10 Workflow completed

Show:

Duration
Executed Nodes
API Calls
Status

21. WORKFLOW INTEGRATION

After successful execution show:

Deploy Workflow

Subtitle:

"Connect this workflow to any application."

Integration options:

Webhook

Provide a fake frontend demonstration endpoint:

POST
/api/workflows/{workflow-id}/trigger

Copy button.

REST API

Show example request.

JavaScript SDK

Show placeholder integration snippet.

Export JSON

Download/export workflow configuration.

Embed

Show conceptual embedding option.

Cards:

Website
Mobile App
Backend
CRM
ERP
Custom Application

Make it clear that these are frontend demonstrations for now and can later connect to a real execution backend.

22. WORKFLOW LIBRARY

Create a page showing saved workflows.

Cards:

Purchase Approval

Employee Onboarding

Invoice Processing

Customer Complaint Handling

Vendor Verification

Show:

Status
Nodes
Last execution
Success rate
Version

Buttons:

Open
Run
Duplicate
Export

23. POLICY CENTER

Create a Policies page.

Example policy:

Purchase Authorization

₹0 – ₹50,000

Employee

₹50,001 – ₹500,000

Manager

Above ₹500,000

Finance Head

Another example:

Data Access

Employee:
Read

Manager:
Read / Modify

Admin:
Full Access

These policies will eventually be used by the verification engine.

24. INTERMEDIATE REPRESENTATION VIEW

Because this application is a compiler rather than only an automation builder, provide an optional developer panel:

Workflow IR

Display formatted JSON representing the generated workflow.

Tabs:

Visual
IR
Verification
Execution

Example conceptual structure:

{
"trigger": {},
"nodes": [],
"edges": [],
"variables": {},
"policies": {}
}

Include:

Copy IR
Download JSON

This panel should help make the compiler architecture obvious during the hackathon presentation.

25. DEMO MODE

Add a Demo Workflow button.

Clicking it should automatically demonstrate the complete experience using:

Purchase Approval Workflow

Input:

"When a new purchase request arrives, check the amount. If it exceeds ₹50,000, obtain manager approval. If approved, create the purchase order and notify finance."

Automatically simulate:

Natural Language

→ NLP Analysis

→ Stage Detection

→ Compilation

→ Workflow Generation

→ Verification

→ Detection of missing rejection path

→ AI Fix

→ Re-verification

→ 100% Verified

→ Execution

This will be used during the hackathon presentation.

26. ANIMATION REQUIREMENTS

Use polished but purposeful animations.

Important animations:

AI thinking indicator

Speech waveform

Text → token transformation

NLP stages completing

Nodes appearing during compilation

Edges connecting

Graph verification scan

Error highlighting

AI fix inserting nodes

Execution pulse travelling along edges

Node status changes

Workflow completion animation

Use Framer Motion or lightweight CSS animations where appropriate.

Animations should feel professional and fast.

27. RESPONSIVENESS

Primary target:

Desktop / laptop hackathon presentation.

Optimize especially for:

1366×768
1440×900
1920×1080

Still make the interface reasonably responsive for tablets.

Workflow Studio should prioritize desktop interaction.

28. FRONTEND ARCHITECTURE

Use:

React

Vite

TypeScript where appropriate

Tailwind CSS

React Flow / XYFlow

Lucide icons

Framer Motion where useful

Use reusable components.

Suggested structure:

components/

WorkflowNode
WorkflowCanvas
ChatInput
VoiceInput
AnalysisPipeline
VerificationPanel
ExecutionPanel
NodeConfiguration
Sidebar
Topbar
StatusBadge

pages/

Dashboard
Compiler
WorkflowStudio
Verification
Executions
Integrations
WorkflowLibrary
Policies
Settings

29. MOCK DATA ARCHITECTURE

Keep mock data separate from UI components.

Create reusable TypeScript models/interfaces for:

Workflow

WorkflowNode

WorkflowEdge

Policy

VerificationIssue

Execution

ExecutionEvent

NLPAnalysis

Do not hardcode all demo content directly into individual React components.

We will replace mock services with real APIs later.

30. IMPORTANT DEVELOPMENT RULES

This is currently FRONTEND FIRST.

Do NOT attempt to implement:

a real LLM

a real NLP model

production workflow execution

real email sending

real database actions

real external API execution

complex backend infrastructure

Simulate these operations realistically.

However:

The workflow canvas itself should be genuinely interactive.

The verification demo should actually react to the mock workflow structure where practical.

The execution animation should actually traverse the mock graph rather than simply playing a video.

Architecture must make future backend integration straightforward.

31. USER JOURNEY

The complete frontend experience must feel like one continuous story:

1. User opens FlowForge AI

↓

2. User clicks Create with AI

↓

3. User types or speaks instructions

↓

4. AI Analysis screen processes the language

↓

5. System displays extracted trigger/actions/conditions/actors

↓

6. System lists detected workflow stages

↓

7. User clicks Compile Workflow

↓

8. Nodes automatically appear and connect on canvas

↓

9. User clicks Verify

↓

10. Verification engine scans workflow

↓

11. Problems are detected and highlighted

↓

12. AI proposes fixes

↓

13. User applies fixes

↓

14. Workflow becomes VERIFIED

↓

15. User clicks Run

↓

16. Animated execution moves through every node

↓

17. Human approval pauses execution where necessary

↓

18. User approves

↓

19. Execution continues

↓

20. Workflow completes

↓

21. User sees integration/export options

This journey is the most important part of the frontend.

32. FINAL PRODUCT FEEL

The application should immediately communicate:

"I can describe a process in normal language and this system will understand it, convert it into a formal workflow, detect mistakes, fix those mistakes, verify the result and make the workflow executable."

Do not make this look like a generic admin dashboard.

The core visual identity must revolve around:

Language → Intelligence → Compilation → Graph → Verification → Execution

The workflow canvas, AI analysis, verification system and live execution visualization should receive the most design attention.

Build all screens with realistic mock interactions so the complete P-03 concept can be demonstrated before any backend or AI services are connected.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fb9295d1-19b4-4d36-9c8f-797b5567cf02).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Canonical rules: rules/RULE_BOOK.md
Certified persistence: workflows are saved only after the full mandatory execution suite passes. Portable files use .flowforge.json.

## v7.17 optimized rule architecture
- Replaced the previous rules entirely with **FlowForge Optimized Rule Book v1.0** in `rules/RULE_BOOK.md`.
- Single hierarchy: `USER EXPLICIT INTENT > L0 > L1 > L2 > L3`.
- Planner, verifier, and test prompts are phase instructions, not independent rule books.
- Canonical semantic contract is the single source of truth before graph generation.
- Deterministic rules own correctness; Gemma is restricted to semantic interpretation and complete-candidate reconstruction.
- Root-cause-first repair order is authoritative and capped at 3 repair rounds.
- Notification classification now distinguishes communication from ordinary business actions such as Create Core Accounts.
- Full deterministic mandatory suite remains required for certification; failed/incomplete execution never creates a reusable saved workflow.
- Certified workflows remain portable through `.flowforge.json`.


## v7.18 regenerate-never-patch architecture
- Replaced the v7.17 repair hierarchy with **FlowForge Rule Book v2.0**.
- Verification now returns only RIGHT, WRONG, or NEEDS_INPUT.
- WRONG workflows are regenerated completely from the original requirement; verification never applies targeted node/edge patches.
- Complete replacements are applied atomically only after deterministic acceptance.
- Removed targeted planner completion and the unused requirement-completer module.
- Fixed manual node attribute persistence and prevented silent manual node-type reclassification.
- Added explicit edge deletion using Delete/Backspace and double-click.
- Certification/save behavior remains fail-closed: all mandatory tests must pass before persistence/export.
- See `AUDIT_v7.18.md` for the design and predicted model behavior audit.
=======
# CH26-P03-MINIONS
>>>>>>> 2278559c0a3af3cc1a38f89d82fdfbf92cfe3b90
