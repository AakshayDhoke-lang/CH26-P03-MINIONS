import { PLANNER_SYSTEM_PROMPT } from "./planner-prompts";

// v5 understanding path deliberately uses one planner contract for normal and advanced
// prompts. This prevents the "fast path" and the main planner from interpreting the same
// requirement differently.
export const NORMAL_PLANNER_SYSTEM_PROMPT = PLANNER_SYSTEM_PROMPT;
