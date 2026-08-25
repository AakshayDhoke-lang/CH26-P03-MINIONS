# FlowForge + NVIDIA NIM

FlowForge can use NVIDIA's hosted OpenAI-compatible chat-completions API.

## Recommended model

`google/gemma-4-31b-it`

## .env

```env
AI_PROVIDER=nvidia
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=google/gemma-4-31b-it
NVIDIA_API_KEY=nvapi-your-real-key
NVIDIA_STRUCTURED_OUTPUT=off
```

Restart `npm run dev` after editing `.env`.

The NVIDIA key is server-only. Never prefix it with `VITE_` and never commit it.

## Switching back to LM Studio

```env
AI_PROVIDER=lmstudio
LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1
LM_STUDIO_MODEL=auto
LM_STUDIO_API_KEY=lm-studio
LM_STUDIO_STRUCTURED_OUTPUT=auto
```

Planner, verifier/repair, and AI test generation all use the selected provider through the same adapter.
