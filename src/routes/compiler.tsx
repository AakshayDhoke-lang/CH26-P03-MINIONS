import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Cloud, Cpu, LoaderCircle, Mic, RotateCcw, Sparkles, WandSparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EXAMPLE_PROMPTS, NLP_STAGES } from "@/lib/mock-data";
import { compilationFromWorkflowIR } from "@/lib/workflow-engine";
import { flowActions, useFlowState } from "@/lib/workflow-store";
import { planWorkflowWithLocalLLM } from "@/server-functions/workflow-planner";
import { checkLLMConnection } from "@/server-functions/llm-health";

export const Route = createFileRoute("/compiler")({ component: CompilerPage });
type Phase = "input" | "analyze" | "stages" | "compile";

const compilerMessages = [
  "Loading Gemma-generated intermediate representation…",
  "Resolving dependencies and semantic branches…",
  "Generating typed workflow nodes…",
  "Connecting control-flow edges…",
  "Generating tests from conditions and approvals…",
  "Preparing graph for deterministic verification…",
];

function CompilerPage() {
  const s = useFlowState();
  const navigate = useNavigate();
  const [text, setText] = useState(s.prompt || "");
  const [phase, setPhase] = useState<Phase>("input");
  const [step, setStep] = useState(0);
  const [listening, setListening] = useState(false);
  const [compileLine, setCompileLine] = useState(0);
  const [aiReady, setAiReady] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<{ provider: string; model: string; durationMs: number; generationMode?: string; repairPassUsed?: boolean } | null>(null);
  const [connection, setConnection] = useState<{state:"idle"|"checking"|"online"|"offline";message:string;model?:string;latencyMs?:number}>({state:"idle",message:"Not tested"});
  const recognitionRef = useRef<any>(null);
  const transitionRef = useRef(false);
  const canSubmit = useMemo(() => text.trim().length > 8, [text]);

  useEffect(() => {
    if (phase !== "analyze") return;
    setStep(0);
    transitionRef.current = false;
    const timer = setInterval(() => {
      setStep((value) => Math.min(value + 1, NLP_STAGES.length - 1));
    }, 520);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "analyze" || !aiReady || aiError || transitionRef.current) return;
    transitionRef.current = true;
    setStep(NLP_STAGES.length);
    const timer = setTimeout(() => setPhase("stages"), 650);
    return () => clearTimeout(timer);
  }, [phase, aiReady, aiError]);

  useEffect(() => {
    if (phase !== "compile") return;
    setCompileLine(0);
    const timer = setInterval(() => {
      setCompileLine((value) => {
        const next = value + 1;
        if (next >= compilerMessages.length) {
          clearInterval(timer);
          flowActions.finalizeCompilation();
          setTimeout(() => navigate({ to: "/studio" }), 450);
        }
        return Math.min(next, compilerMessages.length);
      });
    }, 320);
    return () => clearInterval(timer);
  }, [phase, navigate]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("flowforge-ai-provider");
      if (saved === "lmstudio" || saved === "nvidia") flowActions.setAIProvider(saved);
    } catch {}
  }, []);

  useEffect(() => { setConnection({state:"idle",message:"Not tested"}); }, [s.aiProvider]);

  const testConnection = async () => {
    setConnection({state:"checking",message:"Checking connection…"});
    try {
      const result = await checkLLMConnection({data:{provider:s.aiProvider}});
      setConnection(result.ok
        ? {state:"online",message:`Connected in ${result.latencyMs} ms`,model:result.model,latencyMs:result.latencyMs}
        : {state:"offline",message:result.message,model:result.model});
    } catch (error) {
      setConnection({state:"offline",message:error instanceof Error?error.message:String(error)});
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    const source = text.trim();
    setAiError(null);
    setAiReady(false);
    setAiMeta(null);
    flowActions.reset();
    flowActions.setPrompt(source);
    setPhase("analyze");
    try {
      const response = await planWorkflowWithLocalLLM({ data: { text: source, provider: s.aiProvider } });
      const compilation = compilationFromWorkflowIR(response.ir, source);
      const normalizationNotes = (response.normalization?.warnings || []).map((warning: string) => `Normalizer: ${warning}`);
      if (normalizationNotes.length) compilation.notes = [...normalizationNotes, ...compilation.notes];
      flowActions.loadCompilation(compilation, source);
      setAiMeta({ provider: response.provider, model: response.model, durationMs: response.durationMs, generationMode: response.generationMode, repairPassUsed: response.repairPassUsed });
      setAiReady(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The AI planner could not generate a valid Workflow IR.";
      setAiError(message);
    }
  };

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }
    const W = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) {
      setListening(true);
      setTimeout(() => setListening(false), 900);
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";
    rec.onresult = (event: any) => {
      let output = "";
      for (let i = 0; i < event.results.length; i++) output += event.results[i][0].transcript;
      setText(output);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };

  const a = s.analysis;
  const stages = s.stages;

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <motion.div key="input" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mx-auto max-w-5xl py-8">
            <div className="text-center">
              <div className="ai-breathe mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--gradient-ai)] text-white shadow-lg"><Sparkles className="h-5 w-5" /></div>
              <h1 className="mt-5 text-4xl font-bold">What should your workflow do?</h1>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Describe a business process naturally. FlowForge uses a hybrid AI + deterministic compiler, then validates, verifies, executes, and certifies the resulting workflow.</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <div className="inline-flex rounded-xl border bg-card/70 p-1">
                  <Button size="sm" variant={s.aiProvider==="nvidia"?"default":"ghost"} onClick={()=>flowActions.setAIProvider("nvidia")} className="h-8 text-xs"><Cloud className="h-3.5 w-3.5"/> NVIDIA Online</Button>
                  <Button size="sm" variant={s.aiProvider==="lmstudio"?"default":"ghost"} onClick={()=>flowActions.setAIProvider("lmstudio")} className="h-8 text-xs"><Cpu className="h-3.5 w-3.5"/> LM Studio Local</Button>
                </div>
                <Button size="sm" variant="outline" onClick={testConnection} disabled={connection.state==="checking"} className="h-8 text-xs">
                  {connection.state==="checking"?<LoaderCircle className="h-3.5 w-3.5 animate-spin"/>:<span className={`h-2.5 w-2.5 rounded-full ${connection.state==="online"?"bg-success":connection.state==="offline"?"bg-danger":"bg-warning"}`}/>}
                  {connection.state==="checking"?"Testing…":connection.state==="online"?"Connected":connection.state==="offline"?"Disconnected":"Test connection"}
                </Button>
              </div>
              <div className={`mx-auto mt-2 max-w-2xl text-[10px] ${connection.state==="offline"?"text-danger":"text-muted-foreground"}`}>
                {s.aiProvider==="nvidia"?"NVIDIA NIM · Gemma 4 31B IT":"LM Studio · loaded local model"} · {connection.message}{connection.model?` · ${connection.model}`:""}
              </div>
            </div>
            <div className="glow-primary dynamic-sheen mt-8 rounded-3xl border border-white/10 bg-card/75 p-4 backdrop-blur-xl">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Example: Every day check each student's attendance. If the student is present, mark present; otherwise mark absent. Save the attendance record." className="min-h-44 resize-none border-0 bg-transparent text-[16px] leading-7 shadow-none focus-visible:ring-0" />
              <div className="flex items-center gap-2 border-t pt-3">
                <Button variant={listening ? "default" : "ghost"} size="icon" onClick={toggleMic} className={listening ? "bg-danger text-white" : ""}><Mic className="h-4 w-4" /></Button>
                {listening && <div className="flex items-center gap-1 text-xs text-danger"><span className="h-2 w-2 animate-ping rounded-full bg-danger" /> Listening…</div>}
                <div className="ml-auto"><Button onClick={submit} disabled={!canSubmit} className="bg-primary text-primary-foreground">Analyze & Plan <ArrowRight className="h-4 w-4" /></Button></div>
              </div>
            </div>
            <div className="mt-7">
              <div className="mb-3 text-xs font-semibold text-muted-foreground">Try an example</div>
              <div className="grid gap-3 md:grid-cols-4">{EXAMPLE_PROMPTS.map((item) => <button key={item.title} onClick={() => setText(item.text)} className="rounded-2xl border border-white/8 bg-card/55 p-4 text-left transition hover:-translate-y-1 hover:border-primary/35"><div className="text-sm font-semibold">{item.title}</div><div className="mt-1 line-clamp-3 text-[11px] leading-5 text-muted-foreground">{item.text}</div></button>)}</div>
            </div>
          </motion.div>
        )}

        {phase === "analyze" && (
          <motion.div key="analyze" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto grid max-w-6xl gap-6 py-6 xl:grid-cols-[1.35fr_.8fr]">
            <div className="rounded-3xl border border-white/10 bg-card/65 p-7">
              <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-ai/15 text-ai"><WandSparkles className="h-5 w-5 animate-pulse" /></span><div><h1 className="text-2xl font-bold">Understanding and planning your process…</h1><p className="text-sm text-muted-foreground">The selected AI provider is performing semantic planning; the output must pass FlowForge's IR schema and shared structural rules before it is accepted.</p></div></div>
              <div className="mt-7 space-y-3">{NLP_STAGES.map((item, i) => { const done = aiReady || i < step; const active = !aiReady && i === step; return <div key={item.id} className={`flex items-center gap-4 rounded-2xl border p-4 ${active ? "border-ai/40 bg-ai/10" : done ? "border-success/25 bg-success/5" : "bg-surface/35"}`}><span className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${done ? "bg-success text-background" : active ? "bg-ai text-background" : "bg-surface-2 text-muted-foreground"}`}>{done ? <Check className="h-4 w-4" /> : item.id}</span><div className="flex-1"><div className="text-sm font-semibold">{item.title}</div><div className="text-[11px] text-muted-foreground">{item.detail}</div></div></div>; })}</div>
              {aiError && <div className="mt-5 rounded-2xl border border-danger/35 bg-danger/8 p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" /><div><div className="text-sm font-semibold text-danger">AI planning failed</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{aiError}</div><Button variant="outline" className="mt-3" onClick={() => setPhase("input")}><RotateCcw className="h-4 w-4" /> Back to prompt</Button></div></div></div>}
              {aiMeta && <div className="mt-4 text-[10px] text-muted-foreground">Accepted IR from {aiMeta.model} via {aiMeta.provider} · {aiMeta.generationMode || "adaptive"}{aiMeta.repairPassUsed ? " + repair pass" : ""} · {(aiMeta.durationMs / 1000).toFixed(1)}s server processing</div>}
            </div>
            <div className="rounded-3xl border border-white/10 bg-card/65 p-6">
              <div className="text-[11px] font-bold tracking-[.18em] text-primary uppercase">Live semantic insights</div><h2 className="mt-1 text-lg font-semibold">{a ? "Accepted Workflow IR" : "Waiting for validated IR…"}</h2>
              <div className="mt-5 space-y-5">{[["Trigger", a?.trigger ? [a.trigger] : []], ["Actors", a?.actors || []], ["Variables", a?.variables || []], ["Conditions", a?.conditions || []], ["Actions", a?.actions || []]].map(([key, values]) => <div key={key as string}><div className="mb-2 text-[10px] font-bold text-muted-foreground uppercase">{key as string}</div><div className="flex flex-wrap gap-2">{(values as string[]).length ? (values as string[]).map((value) => <span key={value} className="rounded-lg border bg-surface-2 px-2.5 py-1 text-xs">{value}</span>) : <span className="text-xs text-muted-foreground">{aiError ? "Unavailable" : "Analyzing…"}</span>}</div></div>)}</div>
            </div>
          </motion.div>
        )}

        {phase === "stages" && (
          <motion.div key="stages" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl py-5">
            <div className="flex items-end justify-between"><div><div className="text-[11px] font-bold tracking-[.2em] text-success uppercase">AI plan accepted</div><h1 className="mt-1 text-3xl font-bold">{aiMeta?.model || (s.aiProvider === "nvidia" ? "NVIDIA Gemma 4" : "Local model")} planned {stages.length} workflow stages</h1><p className="mt-2 text-sm text-muted-foreground">The plan has passed the strict Workflow IR schema. FlowForge will now compile it into editable graph nodes.</p></div><Button variant="outline" onClick={() => setPhase("input")}><RotateCcw className="h-4 w-4" /> Edit prompt</Button></div>
            <div className="mt-7 grid gap-3 md:grid-cols-3">{stages.map((item, i) => <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} key={item.id} className="rounded-2xl border bg-card/70 p-5"><div className="text-[10px] font-bold tracking-widest text-primary uppercase">{String(i + 1).padStart(2, "0")} · {item.type}</div><div className="mt-2 text-sm font-semibold">{item.name}</div></motion.div>)}</div>
            {s.compilerNotes.length > 0 && <div className="mt-5 rounded-2xl border border-warning/30 bg-warning/5 p-4 text-xs leading-6 text-warning">{s.compilerNotes.map((note) => <div key={note}>• {note}</div>)}</div>}
            <div className="mt-8 flex justify-end"><Button size="lg" onClick={() => setPhase("compile")} className="bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /> Compile Workflow</Button></div>
          </motion.div>
        )}

        {phase === "compile" && (
          <motion.div key="compile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-4xl py-16"><div className="rounded-3xl border bg-card/75 p-8"><div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ai/15 text-ai"><WandSparkles className="h-6 w-6 animate-pulse" /></div><h1 className="mt-5 text-3xl font-bold">Compiling the AI plan…</h1><p className="mt-2 text-sm text-muted-foreground">Validated Workflow IR → React Flow graph → Generated tests</p></div><div className="mx-auto mt-8 max-w-2xl rounded-2xl border bg-background/65 p-5 font-mono text-xs leading-7">{compilerMessages.map((message, i) => <div key={message} className={i < compileLine ? "text-success" : "text-muted-foreground/35"}>{i < compileLine ? "✓" : "·"} {message}</div>)}</div></div></motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
