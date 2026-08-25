export type LLMProviderKind = "lmstudio" | "nvidia";

export interface LLMProviderConfig {
  kind: LLMProviderKind;
  label: string;
  baseUrl: string;
  endpoint: string;
  apiKey: string;
  model: string;
  structuredOutput: "auto" | "on" | "off";
  enableThinking: boolean;
}

const trimSlash = (value: string) => value.replace(/\/$/, "");

export function getLLMProviderConfig(override?: LLMProviderKind): LLMProviderConfig {
  const rawProvider = (override || process.env.AI_PROVIDER || process.env.FLOWFORGE_AI_PROVIDER || "lmstudio").trim().toLowerCase();
  const kind: LLMProviderKind = ["nvidia", "nvidia_nim", "nim"].includes(rawProvider) ? "nvidia" : "lmstudio";

  if (kind === "nvidia") {
    const baseUrl = trimSlash(process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1");
    return {
      kind,
      label: "NVIDIA NIM",
      baseUrl,
      endpoint: `${baseUrl}/chat/completions`,
      apiKey: process.env.NVIDIA_API_KEY || "",
      model: process.env.NVIDIA_MODEL || "google/gemma-4-31b-it",
      // NVIDIA's endpoint is OpenAI-compatible, but JSON-schema response_format support can vary by model.
      // FlowForge's adaptive JSON/DSL parser is safer as the default for hosted NIM.
      structuredOutput: ((process.env.NVIDIA_STRUCTURED_OUTPUT || "off").toLowerCase() as "auto" | "on" | "off"),
      // FlowForge wants concise machine-readable output. Disable hidden/visible reasoning by default
      // so reasoning tokens do not consume planner output budget.
      enableThinking: /^(1|true|yes|on)$/i.test(process.env.NVIDIA_ENABLE_THINKING || "false"),
    };
  }

  const baseUrl = trimSlash(process.env.LM_STUDIO_BASE_URL || "http://127.0.0.1:1234/v1");
  return {
    kind,
    label: "LM Studio (Local)",
    baseUrl,
    endpoint: `${baseUrl}/chat/completions`,
    apiKey: process.env.LM_STUDIO_API_KEY || "lm-studio",
    model: process.env.LM_STUDIO_MODEL || "auto",
    structuredOutput: ((process.env.LM_STUDIO_STRUCTURED_OUTPUT || "auto").toLowerCase() as "auto" | "on" | "off"),
    enableThinking: false,
  };
}

let resolvedLocalModel: string | null = null;

export async function resolveConfiguredModel(config = getLLMProviderConfig()): Promise<string> {
  if (config.kind === "nvidia") {
    if (!config.apiKey) throw new Error("NVIDIA_API_KEY is not configured on the FlowForge server. Add it to .env and restart npm run dev.");
    return config.model;
  }

  if (config.model && !["auto", "local-model"].includes(config.model.toLowerCase())) return config.model;
  if (resolvedLocalModel) return resolvedLocalModel;

  const response = await fetch(`${config.baseUrl}/models`, {
    headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`LM Studio model discovery failed with HTTP ${response.status}: ${raw.slice(0, 500)}`);
  let payload: any;
  try { payload = JSON.parse(raw); } catch { throw new Error(`LM Studio /models did not return JSON: ${raw.slice(0, 500)}`); }
  const id = payload?.data?.[0]?.id;
  if (!id) throw new Error("LM Studio is reachable, but no loaded model was found. Load a model and start the local server.");
  resolvedLocalModel = id;
  return id;
}

export interface ChatCompletionArgs {
  provider?: LLMProviderKind;
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
  topP?: number;
  responseFormat?: unknown;
  timeoutMs?: number;
}

export interface ChatCompletionResult {
  content: string;
  finishReason?: string;
  model: string;
  provider: string;
  rawPayload: any;
}

export async function callConfiguredLLM(args: ChatCompletionArgs): Promise<ChatCompletionResult> {
  const config = getLLMProviderConfig(args.provider);
  const model = await resolveConfiguredModel(config);
  const body: any = {
    model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    temperature: args.temperature ?? 0,
    top_p: args.topP ?? 0.9,
    max_tokens: args.maxTokens,
    stream: false,
  };
  if (args.responseFormat) body.response_format = args.responseFormat;
  if (config.kind === "nvidia") {
    body.chat_template_kwargs = { enable_thinking: config.enableThinking };
  }

  let response: Response;
  try {
    response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(args.timeoutMs ?? 120_000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (config.kind === "nvidia") throw new Error(`Cannot reach NVIDIA NIM at ${config.baseUrl}. ${detail}`);
    throw new Error(`Cannot reach LM Studio at ${config.baseUrl}. Start the local server and load the model. ${detail}`);
  }

  const rawText = await response.text();
  let payload: any = null;
  try { payload = JSON.parse(rawText); } catch {}
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.detail || rawText || "Unknown LLM provider error";
    throw new Error(`${config.label} HTTP ${response.status}: ${String(detail).slice(0, 900)}`);
  }

  const choice = payload?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== "string") throw new Error(`${config.label} returned an empty or non-text response.`);
  return {
    content,
    finishReason: choice?.finish_reason,
    model: payload?.model || model,
    provider: config.label,
    rawPayload: payload,
  };
}

export function configuredStructuredOutputMode(provider?: LLMProviderKind) {
  return getLLMProviderConfig(provider).structuredOutput;
}
