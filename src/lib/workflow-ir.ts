import { z } from "zod";

export const NodeKindSchema = z.enum([
  "trigger",
  "action",
  "condition",
  "approval",
  "api",
  "webhook",
  "database",
  "notification",
  "delay",
  "join",
  "end",
]);

const PrimitiveSchema = z.union([z.string(), z.number(), z.boolean()]);

export const WorkflowIRNodeSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, "Use stable machine-safe IDs"),
  type: NodeKindSchema,
  name: z.string().min(1),
  description: z.string().default(""),
  config: z.record(PrimitiveSchema).default({}),
  requirementActionId: z.string().optional(),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
});

export const WorkflowIREdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  branch: z.enum(["DEFAULT", "TRUE", "FALSE", "APPROVED", "REJECTED", "TIMEOUT"]).default("DEFAULT"),
});

export const WorkflowIRInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "date", "object"]),
  description: z.string().default(""),
  required: z.boolean().default(true),
  allowedValues: z.array(PrimitiveSchema).optional(),
});

export const WorkflowIRAmbiguitySchema = z.object({
  text: z.string().min(1),
  reason: z.string().min(1),
  requiresUserInput: z.boolean().default(true),
});


export const RequirementPlanActionSchema = z.object({
  id: z.string().min(1),
  intent: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().default(true),
});
export const RequirementPlanSchema = z.object({
  actions: z.array(RequirementPlanActionSchema).default([]),
  ordering: z.array(z.object({ before:z.string().min(1), after:z.string().min(1), source:z.string().default("") })).default([]),
  decisions: z.array(z.object({ id:z.string().min(1), expression:z.string().min(1), outcomes:z.array(z.string()).default(["TRUE","FALSE"]), source:z.string().default("") })).default([]),
  parallelGroups: z.array(z.object({ id:z.string().min(1), actions:z.array(z.string()), requiresJoin:z.boolean().default(false), source:z.string().default("") })).default([]),
});

export const WorkflowIRSchema = z.object({
  workflowName: z.string().min(1),
  purpose: z.string().min(1),
  summary: z.string().default("Workflow generated from the user process"),
  triggerDescription: z.string().default("Workflow trigger"),
  actors: z.array(z.string()).default([]),
  inputs: z.array(WorkflowIRInputSchema).default([]),
  conditions: z.array(z.string()).default([]),
  actions: z.array(z.string()).default([]),
  nodes: z.array(WorkflowIRNodeSchema).min(2),
  edges: z.array(WorkflowIREdgeSchema).default([]),
  ambiguities: z.array(WorkflowIRAmbiguitySchema).default([]),
  assumptions: z.array(z.string()).default([]),
  requirementPlan: RequirementPlanSchema.optional(),
}).superRefine((ir, ctx) => {
  const ids = new Set<string>();
  for (const node of ir.nodes) {
    if (ids.has(node.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate node id: ${node.id}` });
    ids.add(node.id);
  }
  for (const edge of ir.edges) {
    if (!ids.has(edge.source)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown edge source: ${edge.source}` });
    if (!ids.has(edge.target)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown edge target: ${edge.target}` });
  }
  if (!ir.nodes.some((node) => node.type === "trigger")) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Workflow must contain a trigger node" });
  // An explicit END node is optional. A workflow may terminate on a final
  // side-effect/action node (notification/API/webhook/database/action).
  // Terminal-path safety is enforced by the graph verifier, not the IR parser.
});

export const WorkflowPlanRequestSchema = z.object({
  text: z.string().trim().min(8).max(20_000),
  provider: z.enum(["lmstudio", "nvidia"]).optional(),
});

export type WorkflowIR = z.infer<typeof WorkflowIRSchema>;
