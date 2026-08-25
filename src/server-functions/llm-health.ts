import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callConfiguredLLM, getLLMProviderConfig, resolveConfiguredModel } from "./llm-provider";

const Req = z.object({ provider: z.enum(["lmstudio", "nvidia"]) });

export const checkLLMConnection = createServerFn({ method: "POST" })
  .validator(Req)
  .handler(async ({ data }) => {
    const startedAt = Date.now();
    const config = getLLMProviderConfig(data.provider);
    try {
      const model = await resolveConfiguredModel(config);
      const result = await callConfiguredLLM({
        provider: data.provider,
        system: "You are a connectivity probe. Reply with exactly OK.",
        user: "ping",
        maxTokens: 4,
        temperature: 0,
        topP: 1,
        timeoutMs: 20_000,
      });
      return { ok: true, provider: data.provider, label: config.label, model: result.model || model, latencyMs: Date.now() - startedAt, message: "Connected" };
    } catch (error) {
      return { ok: false, provider: data.provider, label: config.label, model: config.model, latencyMs: Date.now() - startedAt, message: error instanceof Error ? error.message : String(error) };
    }
  });
