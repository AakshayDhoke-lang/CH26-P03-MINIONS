function positiveInt(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function budget(genericName: string, legacyName: string, fallback: number) {
  return positiveInt(process.env[genericName] || process.env[legacyName], fallback);
}

export const LLM_TOKEN_BUDGETS = {
  planner: budget("AI_PLANNER_MAX_TOKENS", "LM_STUDIO_PLANNER_MAX_TOKENS", 1800),
  verifierReview: budget("AI_VERIFIER_REVIEW_MAX_TOKENS", "LM_STUDIO_VERIFIER_REVIEW_MAX_TOKENS", 900),
  verifierRepair: budget("AI_VERIFIER_REPAIR_MAX_TOKENS", "LM_STUDIO_VERIFIER_REPAIR_MAX_TOKENS", 900),
  verifierRetry: budget("AI_VERIFIER_RETRY_MAX_TOKENS", "LM_STUDIO_VERIFIER_RETRY_MAX_TOKENS", 650),
  testGenerator: budget("AI_TEST_MAX_TOKENS", "LM_STUDIO_TEST_MAX_TOKENS", 1000),
  testRetry: budget("AI_TEST_RETRY_MAX_TOKENS", "LM_STUDIO_TEST_RETRY_MAX_TOKENS", 700),
};


export function plannerTokenBudget(provider?: "lmstudio" | "nvidia") {
  if (provider === "nvidia") return positiveInt(process.env.NVIDIA_PLANNER_MAX_TOKENS, 3200);
  return LLM_TOKEN_BUDGETS.planner;
}
