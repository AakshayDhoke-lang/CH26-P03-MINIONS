# FlowForge — Local LM Studio / Gemma 4 E4B reasoning-distilled Setup

This build uses a local OpenAI-compatible LM Studio server instead of NVIDIA NIM.

## 1. Load the model

In LM Studio, download/load your Gemma 4 E4B reasoning-distilled 4 E2B GGUF model (for example Q4_K_M).

## 2. Start the LM Studio local server

Open **Developer / Local Server** in LM Studio and start the OpenAI-compatible server.
The usual address is:

`http://127.0.0.1:1234/v1`

Keep LM Studio running while FlowForge is running.

## 3. Create `.env`

From the FlowForge project root:

```powershell
Copy-Item .env.example .env
```

Default `.env`:

```env
LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1
LM_STUDIO_MODEL=nassimjp/gemma-4-e4b-claude-4.6-opus-reasoning-distilled@q4_k_m
LM_STUDIO_API_KEY=lm-studio
```

If FlowForge reports an unknown/missing model, find the exact model identifier exposed by LM Studio:

```powershell
Invoke-RestMethod http://127.0.0.1:1234/v1/models
```

Copy the relevant `id` value into `LM_STUDIO_MODEL` in `.env`, then restart FlowForge.

Example:

```env
LM_STUDIO_MODEL=your-exact-lm-studio-model-id
```

## 4. Test LM Studio before FlowForge

```powershell
$body = @{
  model = "local-model"
  messages = @(
    @{ role = "user"; content = "Reply with only: LOCAL MODEL OK" }
  )
  max_tokens = 20
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "http://127.0.0.1:1234/v1/chat/completions" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body $body
```

If `local-model` is not accepted, replace it with the id returned by `/v1/models`.

## 5. Start FlowForge

```powershell
npm install
npm run dev
```

## What the model receives

FlowForge sends:

1. a system instruction defining the strict Workflow IR;
2. two compact few-shot examples (condition branching and approval branching);
3. the user's exact current textbox content.

The model returns JSON only. FlowForge validates that JSON with Zod before compiling it into the Workflow Studio.

## Notes for a 4.6B / Q4 model

A small quantized local model is fast and private, but may be less reliable than a large hosted model. FlowForge therefore:

- uses a very explicit output contract;
- supplies few-shot examples;
- uses low temperature;
- validates every result;
- performs one automatic schema-repair retry if needed.

## Output length for reasoning-distilled models

This build defaults to:

```env
LM_STUDIO_MAX_TOKENS=5000
```

If LM Studio reports that generation stopped because the output limit was reached, increase it (for example to `7000`) and restart `npm run dev`.
