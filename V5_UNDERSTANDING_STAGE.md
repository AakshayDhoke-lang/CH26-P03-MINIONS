# FlowForge — v5 Understanding Stage

This build keeps the Judge Prototype UI and changes only the compiler/planner path.

Pipeline:
Natural-language requirement → selected LLM (LM Studio default) → requirement plan + complete workflow graph → adaptive normalization → stable requirement-action mapping → deterministic completeness checks → Judge UI canvas.

Key rules implemented:
- sequential by default; `and` is not parallel
- explicit ordering preserved
- conditions only for actual decision logic
- generic business operations remain ACTION nodes
- communication remains NOTIFICATION
- final business actions may terminate; END is optional
- no fake failure branches / joins / business actions
- action identities A1/A2/... map requirement meaning to graph nodes
- node inputs/outputs preserve downstream data intent
- local model gets first generation attempt; deterministic templates are fallback-only
- one clean full regeneration may occur after deterministic failure; no patch chain

This stage intentionally does not redesign Verification/Execution yet. Those are the next migration stage.
