# FlowForge AI — Judge Demo Guide

## Goal
Show one complete, reliable story: natural language → workflow → verification → simulated execution → certification → saved workflow.

## Before the demo
1. Copy `.env.example` to `.env`.
2. Keep `FLOWFORGE_JUDGE_MODE=true`.
3. NVIDIA/LM Studio is optional for the five curated demo scenarios. You may still configure either provider for arbitrary prompts.
4. Run `npm install` once on your own machine with internet access.
5. Start with `npm run dev`.

## Best demo prompt
Use **Customer Complaint** from the example cards:

> When a customer submits a complaint, classify the severity. If it is critical, escalate to a support lead, otherwise assign it to the support queue and email the customer.

Expected graph:
Customer Complaint Received → Classify Severity → Is Severity Critical?
- TRUE → Escalate to Support Lead
- FALSE → Assign to Support Queue → Email Customer

## Presentation clicks
1. **AI Compiler** → choose the Customer Complaint example → **Analyze & Plan**.
2. Let the compiler animation complete → it opens **Workflow Studio**.
3. Briefly point to the generated nodes/branches.
4. Open **Verification** → click **Verify + Regenerate if Wrong**.
5. Show **Verified**, score 100/100, and zero unresolved issues.
6. Click **Run Verified Workflow**.
7. On **Executions**, select/run the TRUE and FALSE generated scenarios if desired.
8. Click **Certify + Save**. FlowForge runs the mandatory coverage suite automatically.
9. Show the green certification gate and open **Workflow Library** to show the saved certified workflow.

## Five guaranteed judge-safe scenarios
- Customer Complaint
- Purchase Approval
- Leave Approval
- Support Ticket
- Employee Onboarding

These are deliberately protected by deterministic semantic templates in judge mode. Arbitrary prompts still use the configured LLM and fall back gracefully if the provider is unavailable.

## 30-second explanation
“FlowForge converts a natural-language business requirement into an executable workflow graph. Unlike a simple AI diagram generator, it validates the graph structure, verifies it against the requirement, simulates all mandatory branches, and only certifies and saves the workflow after those tests pass. For the prototype, external integrations are simulated so the complete verification lifecycle can be demonstrated safely and repeatably.”

## What not to demo
Avoid unfinished integration/policy/settings screens during judging. The sidebar intentionally focuses on the six presentation-ready areas: Compiler, Studio, Verification, Executions, Library, and Dashboard.
