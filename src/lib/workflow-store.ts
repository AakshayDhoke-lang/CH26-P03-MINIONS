import { useSyncExternalStore } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { WorkflowIR } from "./workflow-ir";
import { verifyWorkflowWithLocalLLM } from "@/server-functions/workflow-verifier";
import { generateWorkflowTestsWithLocalLLM } from "@/server-functions/workflow-test-generator";
import { compileNaturalLanguage, compilationFromWorkflowIR, coverageKey, deriveExpectedExecution, evaluateCondition, findParallelJoinPlan, generateTests, requiredCoverageTargets, verifyGraph, type GeneratedTestCase, type PromptCompilation } from "./workflow-engine";
import type { DetectedStage, ExecutionEvent, NLPAnalysis, NodeKind, NodeRunStatus, SemanticVerificationProposal, VerificationIssue, WorkflowDiffItem, WorkflowNodeData, WorkflowStatus } from "./types";
import { completeNodeConfig, isCommunicationIntent, validateNodeMock } from "./node-contracts";
import { FLOWFORGE_FILE_FORMAT, FLOWFORGE_FILE_VERSION, getSavedWorkflow, saveCertifiedWorkflow, type CertifiedTestResult, type SavedWorkflow } from "./workflow-library";

export type WFNode = Node<WorkflowNodeData>;

const n = (id:string,kind:NodeKind,name:string,x:number,y:number,subtitle?:string,config:Record<string,string>={}):WFNode => ({id,type:"workflow",position:{x,y},data:{kind,name,subtitle,status:"idle",issue:null,config}});
const e = (source:string,target:string,label?:string,sourceHandle?:string):Edge => ({id:`edge-${Math.random().toString(36).slice(2,8)}`,source,target,label,sourceHandle,type:"smoothstep",animated:false});

export interface TestRunResult { passed:boolean; reason:string; path:string[]; terminal?:string; testId?:string; testName?:string; failureKind?:"workflow"|"assertion"|"test-definition"; }
export interface FlowState {
  workflowName:string; version:string; status:WorkflowStatus; prompt:string;
  analysis:NLPAnalysis|null; stages:DetectedStage[]; compilerNotes:string[];
  nodes:WFNode[]; edges:Edge[]; compiled:boolean; issues:VerificationIssue[]; score:number; verifiedAt:number|null; verifying:boolean; verifyLog:string[]; selectedNodeId:string|null;
  generatedTests:GeneratedTestCase[]; activeTestId:string|null; testScript:string; lastTestResult:TestRunResult|null;
  execution:{running:boolean;finished:boolean;awaiting:string|null;log:ExecutionEvent[];activeEdges:string[];executedNodes:number;apiCalls:number;startedAt:number|null;durationMs:number|null;path:string[];inputs:Record<string,any>;approvals:Record<string,"approved"|"rejected"|"timeout">;nodeMocks:Record<string,Record<string,any>>;expectedPathIncludes:string[];expectedTerminal?:string;testName?:string;coverageTarget?:GeneratedTestCase["coverageTarget"];conditionVisits:Record<string,number>;visitCounts:Record<string,number>;virtualElapsedMs:number;outputs:Record<string,any>;};
  demoMode:boolean; aiProvider:"lmstudio"|"nvidia";
  semanticReviewRunning:boolean; semanticReviewError:string|null; semanticProposal:SemanticVerificationProposal|null;
  executionFeedback:{testName?:string;reason:string;path:string[];terminal?:string;inputs:Record<string,any>;approvals:Record<string,any>}|null;
  validationPhases:{structure:"pending"|"pass"|"fail";semantics:"pending"|"pass"|"fail";execution:"pending"|"pass"|"fail"};
  certificationRunning:boolean; certificationResults:CertifiedTestResult[]; certifiedAt:number|null; savedWorkflowId:string|null;
}
const emptyAnalysis:NLPAnalysis={trigger:"",actors:[],variables:[],conditions:[],actions:[]};
const initialExec=():FlowState["execution"]=>({running:false,finished:false,awaiting:null,log:[],activeEdges:[],executedNodes:0,apiCalls:0,startedAt:null,durationMs:null,path:[],inputs:{},approvals:{},nodeMocks:{},expectedPathIncludes:[],expectedTerminal:undefined,testName:undefined,coverageTarget:undefined,conditionVisits:{},visitCounts:{},virtualElapsedMs:0,outputs:{}});
let state:FlowState={workflowName:"Untitled Workflow",version:"v1.0",status:"DRAFT",prompt:"",analysis:null,stages:[],compilerNotes:[],nodes:[],edges:[],compiled:false,issues:[],score:0,verifiedAt:null,verifying:false,verifyLog:[],selectedNodeId:null,generatedTests:[],activeTestId:null,testScript:"[]",lastTestResult:null,execution:initialExec(),demoMode:false,aiProvider:"lmstudio",semanticReviewRunning:false,semanticReviewError:null,semanticProposal:null,executionFeedback:null,validationPhases:{structure:"pending",semantics:"pending",execution:"pending"},certificationRunning:false,certificationResults:[],certifiedAt:null,savedWorkflowId:null};
const listeners=new Set<()=>void>();
function set(patch:Partial<FlowState>){state={...state,...patch};listeners.forEach(l=>l());}
function subscribe(l:()=>void){listeners.add(l);return()=>listeners.delete(l);}
const getSnapshot=()=>state;
export function useFlow<T>(selector:(s:FlowState)=>T):T{return useSyncExternalStore(subscribe,()=>selector(state),()=>selector(state));}
export const useFlowState=()=>useSyncExternalStore(subscribe,getSnapshot,()=>state);
export const getFlow=()=>state;
const stamp=()=>new Date().toLocaleTimeString("en-GB",{hour12:false}); const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const TEST_DELAY_CAP_MS=5000; // test-mode cap: long real waits are simulated in at most 5 seconds
function parseDurationMs(config:Record<string,string>|undefined){
  const cfg=config||{}; const raw=String(cfg.Duration??cfg.duration??cfg.Delay??cfg.delay??"").trim(); const unit=String(cfg.Unit??cfg.unit??"").trim().toLowerCase();
  const m=raw.match(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d)?/i);
  if(!m)return null; const value=Number(m[1]); const u=(m[2]||unit||"seconds").toLowerCase();
  const mult=/^(d|day)/.test(u)?86400000:/^(h|hr|hour)/.test(u)?3600000:/^(m|min|minute)/.test(u)?60000:1000; return Math.max(0,value*mult);
}
function humanDuration(ms:number){if(ms>=86400000)return `${ms/86400000} day(s)`;if(ms>=3600000)return `${ms/3600000} hour(s)`;if(ms>=60000)return `${ms/60000} minute(s)`;return `${ms/1000} second(s)`;}
function truthyConfig(v:any){return ["true","1","yes","fail","failed","error"].includes(String(v??"").trim().toLowerCase());}
function renderTemplate(value:any,vars:Record<string,any>){return String(value??"").replace(/\{\{\s*([a-zA-Z_][\w.-]*)\s*\}\}/g,(_,key)=>{const parts=String(key).split(".");let v:any=vars;for(const p of parts)v=v?.[p];return v==null?`{{${key}}}`:typeof v==="object"?JSON.stringify(v):String(v);});}
function parseMockResponse(raw:any){const t=String(raw??"{}").trim();try{return JSON.parse(t);}catch{return t;}}
function testIoOutcome(node:WFNode,vars:Record<string,any>,override:Record<string,any>={}):{ok:boolean;message:string;detail?:string;outputKey?:string;output?:any;branch?:"TRUE"|"FALSE"}{
  const c=completeNodeConfig(node.data.kind,node.data.name,node.data.subtitle||"",{...(node.data.config||{}),...Object.fromEntries(Object.entries(override||{}).map(([k,v])=>[k,String(v)]))});
  if(truthyConfig(c.MockFailure??c.mockFailure))return {ok:false,message:`${node.data.name} — simulated failure`,detail:"MockFailure is enabled for this test node.",branch:"FALSE"};
  if(node.data.kind==="api"){const status=Number(c.MockStatus??c.mockStatus??200);const key=String(c.SaveResponseAs||"api_response");const output=parseMockResponse(c.MockResponse);return {ok:status<400,message:`${node.data.name} — API simulated`,detail:`${c.Method||"REQUEST"} ${renderTemplate(c.URL||c.Endpoint||c.Operation||"logical endpoint",vars)} → HTTP ${status}; saved as ${key}`,outputKey:key,output,branch:status<400?"TRUE":"FALSE"};}
  if(node.data.kind==="notification"){const recipient=renderTemplate(c.Recipient||c.RecipientRole||"logical recipient",vars);const message=renderTemplate(c.Message||c.Operation||node.data.name,vars);return {ok:true,message:`${node.data.name} — notification simulated`,detail:`To: ${recipient}; channel: ${c.Channel||"deployment-configured"}; message: ${message}`,branch:"TRUE"};}
  if(node.data.kind==="database")return {ok:true,message:`${node.data.name} — database operation simulated`,detail:`${c.Operation||"operation"} on ${c.Table||c.Collection||c.Resource||"logical resource"}`,branch:"TRUE"};
  if(node.data.kind==="webhook")return {ok:true,message:`${node.data.name} — webhook simulated`,detail:`${c.Mode||"send/receive"}: ${c.URL||c.Path||c.Event||c.Operation||"logical webhook"}`,branch:"TRUE"};
  return {ok:true,message:`${node.data.name} — completed`,branch:"TRUE"};
}

function patchNode(id:string,data:Partial<WorkflowNodeData>){set({nodes:state.nodes.map(nd=>nd.id===id?{...nd,data:{...nd.data,...data}}:nd)});}
function sanitizeAiTests(raw:any[], baseline:GeneratedTestCase[]):GeneratedTestCase[]{
  const ids=new Set(state.nodes.map(n=>n.id)); const approvalIds=new Set(state.nodes.filter(n=>n.data.kind==="approval").map(n=>n.id));
  const out:GeneratedTestCase[]=[]; let seq=0;
  for(const t of raw||[]){if(!t||typeof t!=="object")continue;
    const approvals:Record<string,"approved"|"rejected"|"timeout">={}; for(const [id,v] of Object.entries(t.approvals||{})){const val=String(v).toLowerCase();if(approvalIds.has(id)&&(val==="approved"||val==="rejected"||val==="timeout"))approvals[id]=val as any;}
    const mocks:Record<string,Record<string,any>>={};let invalidMock=false;for(const [id,cfg] of Object.entries(t.nodeMocks||{})){const nd=state.nodes.find(n=>n.id===id);if(nd&&cfg&&typeof cfg==="object"&&!Array.isArray(cfg)){const errs=validateNodeMock(nd.data.kind,cfg as Record<string,unknown>);if(errs.length){invalidMock=true;break;}mocks[id]=cfg as any;}}if(invalidMock)continue;
    const candidate:GeneratedTestCase={id:`ai-test-${++seq}-${Math.random().toString(36).slice(2,6)}`,source:"ai",name:String(t.name||`AI scenario ${seq}`),description:String(t.description||"AI-generated execution scenario"),inputs:(t.inputs&&typeof t.inputs==="object")?t.inputs:{},approvals,nodeMocks:mocks,expectedPathIncludes:[],coverageTarget:(t.coverageTarget&&ids.has(String(t.coverageTarget.nodeId))&&["TRUE","FALSE","APPROVED","REJECTED","TIMEOUT","SUCCESS","FAILURE","LOOP_REPEAT","LOOP_EXIT"].includes(String(t.coverageTarget.branch).toUpperCase()))?{nodeId:String(t.coverageTarget.nodeId),branch:String(t.coverageTarget.branch).toUpperCase() as any}:undefined};
    const oracle=deriveExpectedExecution(state.nodes,state.edges,candidate);
    // Reject scenarios that cannot actually drive the current verified graph.
    if(!oracle.valid)continue;
    candidate.expectedPathIncludes=oracle.pathNames;
    if(oracle.terminal && !oracle.terminal.startsWith("FAILED:"))candidate.expectedTerminal=oracle.terminal;
    out.push(candidate);
  }
  const normalizedBaseline=baseline.map(t=>{const c={...t,source:t.source||"deterministic" as const};const oracle=deriveExpectedExecution(state.nodes,state.edges,c);return oracle.valid?{...c,expectedPathIncludes:oracle.pathNames,expectedTerminal:oracle.terminal&&!oracle.terminal.startsWith("FAILED:")?oracle.terminal:c.expectedTerminal}:c;});
  const key=(t:GeneratedTestCase)=>`${t.name.toLowerCase()}|${JSON.stringify(t.inputs)}|${JSON.stringify(t.approvals)}|${JSON.stringify(t.nodeMocks||{})}`; const seen=new Set<string>(); const merged=[...normalizedBaseline,...out].filter(t=>{const k=key(t);if(seen.has(k))return false;seen.add(k);return true;});
  return merged.slice(0,10);
}
async function generateTestsHybrid(){
  const baseline=generateTests(state.nodes,state.edges,state.prompt);
  if(!state.prompt.trim()||!state.nodes.length)return baseline;
  try{const res=await generateWorkflowTestsWithLocalLLM({data:{originalPrompt:state.prompt,workflow:currentWorkflowIR(),baselineTests:baseline,provider:state.aiProvider}});const merged=sanitizeAiTests(res.tests,baseline);set({compilerNotes:[...state.compilerNotes,`AI execution tests generated by ${res.model}; ${merged.length} validated scenario(s) available.`]});return merged;}catch(err){set({compilerNotes:[...state.compilerNotes,`AI execution-test generation failed; deterministic tests preserved. ${err instanceof Error?err.message:String(err)}`]});return baseline;}
}
function graphDirty(){set({status:"DRAFT",verifiedAt:null,score:0,issues:[],lastTestResult:null,semanticProposal:null,semanticReviewError:null,executionFeedback:null,generatedTests:generateTests(state.nodes,state.edges,state.prompt),validationPhases:{structure:"pending",semantics:"pending",execution:"pending"},certificationRunning:false,certificationResults:[],certifiedAt:null,savedWorkflowId:null});}
function resetNodeStatuses(){set({nodes:state.nodes.map(nd=>({...nd,data:{...nd.data,status:"idle",scanning:false}}))});}
function nextPosition(){const maxY=Math.max(0,...state.nodes.map(x=>x.position.y));return {x:360,y:maxY+140};}

function currentWorkflowIR(): Record<string, any> {
  return {
    workflowName: state.workflowName,
    purpose: state.analysis?.actions?.length ? `Execute ${state.workflowName}` : state.workflowName,
    summary: `Current editable FlowForge graph for ${state.workflowName}`,
    triggerDescription: state.analysis?.trigger || state.nodes.find(n=>n.data.kind==="trigger")?.data.name || "Workflow trigger",
    actors: state.analysis?.actors || [],
    inputs: (state.analysis?.variables || []).map(name=>({name,type:"string",description:"Workflow input",required:true})),
    conditions: state.analysis?.conditions || [],
    actions: state.analysis?.actions || [],
    nodes: state.nodes.map(nd=>({
      id:nd.id,type:nd.data.kind,name:nd.data.name,description:nd.data.subtitle||"",config:nd.data.config||{},
      requirementActionId:nd.data.provenance?.requirementRefs?.[0],
      inputs:String(nd.data.config?.Consumes||"").split(",").map(x=>x.trim()).filter(Boolean),
      outputs:String(nd.data.config?.Produces||"").split(",").map(x=>x.trim()).filter(Boolean),
    })),
    edges: state.edges.map(ed=>({source:ed.source,target:ed.target,branch:String(ed.label||ed.sourceHandle||"DEFAULT").toUpperCase()})),
    ambiguities: [], assumptions: [],
  };
}

function edgeKey(edge:any){return `${edge.source}->${edge.target}:${String(edge.branch||edge.label||edge.sourceHandle||"DEFAULT").toUpperCase()}`;}

function normalizeText(value:any){return String(value??"").trim().replace(/\s+/g," ");}
function normalizeConfig(config:any){
  const ignored=new Set(["position","x","y","width","height","selected","status","issue","scanning","runtime","verification","generated"]);
  const out:Record<string,string>={};
  for(const [rawKey,rawValue] of Object.entries(config||{})){
    const key=normalizeText(rawKey).toLowerCase().replace(/[\s_-]+/g," ");
    if(!key||ignored.has(key))continue;
    const value=normalizeText(rawValue);
    if(value!=="")out[key]=value;
  }
  return Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b)));
}
function semanticNodeShape(node:any){return {type:String(node?.type||"").toLowerCase(),name:normalizeText(node?.name),description:normalizeText(node?.description),config:normalizeConfig(node?.config)};}
function materialNodeChanges(old:any,next:any){
  const a=semanticNodeShape(old),b=semanticNodeShape(next);const changed:string[]=[];
  if(a.type!==b.type)changed.push(`type ${a.type||"?"} → ${b.type||"?"}`);
  if(a.name!==b.name)changed.push(`name “${a.name}” → “${b.name}”`);
  const keys=[...new Set([...Object.keys(a.config),...Object.keys(b.config)])];
  const configChanged=keys.filter(k=>a.config[k]!==b.config[k]);
  if(configChanged.length)changed.push(`config: ${configChanged.join(", ")}`);
  return changed;
}
function workflowDiff(current:Record<string,any>, proposed:WorkflowIR):WorkflowDiffItem[]{
  const out:WorkflowDiffItem[]=[];
  const currentNodes=new Map((current.nodes||[]).map((n:any)=>[n.id,n]));
  const proposedNodes=new Map(proposed.nodes.map(n=>[n.id,n]));
  for(const [id,node] of proposedNodes){
    const old=currentNodes.get(id) as any;
    if(!old) out.push({kind:"node",change:"added",id,label:(node as any).name,detail:`Add ${(node as any).type} node`});
    else {
      const changes=materialNodeChanges(old,node);
      if(changes.length) out.push({kind:"node",change:"modified",id,label:(node as any).name,detail:`Change ${changes.join("; ")}`});
    }
  }
  for(const [id,node] of currentNodes) if(!proposedNodes.has(id as string)) out.push({kind:"node",change:"removed",id:id as string,label:(node as any).name||String(id),detail:"Remove node not present in corrected workflow"});
  const curEdges=new Map((current.edges||[]).map((ed:any)=>[edgeKey(ed),ed]));
  const newEdges=new Map(proposed.edges.map(ed=>[edgeKey(ed),ed]));
  for(const [key,ed] of newEdges) if(!curEdges.has(key)) out.push({kind:"edge",change:"added",id:key,label:`${(ed as any).source} → ${(ed as any).target}`,detail:`Add ${(ed as any).branch} connection`});
  for(const [key,ed] of curEdges) if(!newEdges.has(key)) out.push({kind:"edge",change:"removed",id:key,label:`${(ed as any).source} → ${(ed as any).target}`,detail:`Remove ${String((ed as any).branch||"DEFAULT")} connection`});
  return out;
}

export const flowActions={
  setAIProvider(provider:"lmstudio"|"nvidia"){set({aiProvider:provider});try{if(typeof window!=="undefined")window.localStorage.setItem("flowforge-ai-provider",provider);}catch{}},
  setPrompt:(prompt:string)=>set({prompt}), setNodes:(nodes:WFNode[])=>{set({nodes});graphDirty();}, setEdges:(edges:Edge[])=>{set({edges});graphDirty();}, setSelected:(selectedNodeId:string|null)=>set({selectedNodeId}), setName:(workflowName:string)=>set({workflowName}), setDemoMode:(demoMode:boolean)=>set({demoMode}),
  analyze(prompt?:string):PromptCompilation { const source=(prompt??state.prompt).trim(); const result=compileNaturalLanguage(source); set({prompt:source,workflowName:result.workflowName,analysis:result.analysis,stages:result.stages,compilerNotes:result.notes,generatedTests:result.tests,testScript:JSON.stringify(result.tests,null,2),activeTestId:result.tests[0]?.id??null}); return result; },
  loadCompilation(result:PromptCompilation,prompt?:string){const source=(prompt??state.prompt).trim();set({prompt:source,workflowName:result.workflowName,analysis:result.analysis,stages:result.stages,compilerNotes:result.notes,nodes:result.nodes,edges:result.edges,compiled:false,status:"DRAFT",issues:[],score:0,verifiedAt:null,execution:initialExec(),generatedTests:result.tests,testScript:JSON.stringify(result.tests,null,2),activeTestId:result.tests[0]?.id??null,lastTestResult:null,validationPhases:{structure:"pending",semantics:"pending",execution:"pending"},certificationRunning:false,certificationResults:[],certifiedAt:null,savedWorkflowId:null});},
  finalizeCompilation(){set({compiled:true,status:"DRAFT",issues:[],score:0,verifiedAt:null,execution:initialExec(),lastTestResult:null});},
  compile(prompt?:string){const result=flowActions.analyze(prompt);flowActions.loadCompilation(result,prompt);flowActions.finalizeCompilation();},
  updateNode(id:string,kind:NodeKind,name:string,subtitle:string,config:Record<string,string>){
    // Manual Studio edits are authoritative. Never silently reclassify the node the user selected.
    const completed=completeNodeConfig(kind,name,subtitle,config);
    set({nodes:state.nodes.map(nd=>nd.id===id?{...nd,data:{...nd.data,kind,name,subtitle,config:completed}}:nd)});
    graphDirty();
  },
  updateNodeConfig(id:string,name:string,config:Record<string,string>){const nd=state.nodes.find(n=>n.id===id);if(nd)flowActions.updateNode(id,nd.data.kind,name,nd.data.subtitle||"",config);},
  deleteNode(id:string){set({nodes:state.nodes.filter(nd=>nd.id!==id),edges:state.edges.filter(ed=>ed.source!==id&&ed.target!==id),selectedNodeId:null});graphDirty();},
  deleteEdge(id:string){set({edges:state.edges.filter(ed=>ed.id!==id)});graphDirty();},
  addNode(kind:NodeKind,name:string){const effectiveKind:NodeKind=kind==="action"&&isCommunicationIntent(name)?"notification":kind;const id=`${effectiveKind}-${Math.random().toString(36).slice(2,8)}`;const p=nextPosition();const base:Record<string,string>=effectiveKind==="condition"?{Expression:""}:effectiveKind==="approval"?{Role:"","On Approval":"Continue","On Rejection":"Reject"}:effectiveKind==="trigger"?{Event:"manual.trigger"}:{};const defaults=completeNodeConfig(effectiveKind,name,"User-created node",base);set({nodes:[...state.nodes,n(id,effectiveKind,name,p.x,p.y,"User-created node",defaults)],selectedNodeId:id});graphDirty();return id;},
  duplicateNode(id:string){const src=state.nodes.find(n=>n.id===id);if(!src)return;const nid=`${src.data.kind}-${Math.random().toString(36).slice(2,8)}`;set({nodes:[...state.nodes,{...src,id:nid,position:{x:src.position.x+50,y:src.position.y+50},data:{...src.data,name:`${src.data.name} Copy`,config:{...(src.data.config||{})}}}],selectedNodeId:nid});graphDirty();},
  async verify(){if(state.verifying)return;set({verifying:true,verifyLog:[],status:"RUNNING"});for(const nd of state.nodes){patchNode(nd.id,{scanning:true});await wait(90);patchNode(nd.id,{scanning:false});}
    const msgs=["Checking trigger and terminal states…","Calculating graph reachability…","Scanning for orphan nodes and dead ends…","Detecting circular dependencies…","Validating condition branches and expressions…","Checking approval outcomes and authorization roles…","Inspecting executable node configuration…"];
    for(const m of msgs){set({verifyLog:[...state.verifyLog,m]});await wait(120);} const issues=verifyGraph(state.nodes,state.edges,state.prompt);const unresolved=issues.filter(i=>i.severity!=="pass"&&!i.resolved);const errors=unresolved.filter(i=>i.severity==="error").length;const warnings=unresolved.filter(i=>i.severity==="warning").length;const needsStaticInput=unresolved.some(i=>i.category==="User Input Required");const score=Math.max(0,100-errors*12-warnings*4);const clean=errors===0&&!needsStaticInput;
    const marked=state.nodes.map(nd=>{const i=unresolved.find(x=>x.affected.includes(nd.id));return {...nd,data:{...nd.data,issue:i?.title||null,scanning:false}}});const tests=generateTests(marked,state.edges,state.prompt);set({nodes:marked,verifying:false,issues,score,status:needsStaticInput?"NEEDS USER INPUT":(clean?"DRAFT":"ISSUES FOUND"),verifiedAt:null,generatedTests:tests,testScript:JSON.stringify(tests,null,2),activeTestId:tests[0]?.id??null,validationPhases:{...state.validationPhases,structure:clean?"pass":"fail",semantics:"pending",execution:"pending"}});
  },
  async verifyAndReview(){
    if(state.verifying||state.semanticReviewRunning)return;
    await flowActions.verify();
    await flowActions.semanticReview();
  },
  async semanticReview(){
    if(state.semanticReviewRunning||!state.prompt.trim()||!state.nodes.length)return;
    const staticIssues=verifyGraph(state.nodes,state.edges,state.prompt);
    const current=currentWorkflowIR();
    set({semanticReviewRunning:true,semanticReviewError:null,semanticProposal:null,status:"RUNNING",verifyLog:[...state.verifyLog,"Whole-workflow audit started. Incorrect graphs will be regenerated, never patched."]});
    try{
      const response=await verifyWorkflowWithLocalLLM({data:{originalPrompt:state.prompt,workflow:current,staticIssues:staticIssues.map(i=>({id:i.id,title:i.title,category:i.category,severity:i.severity,reason:i.reason,affected:i.affected,suggestedFix:i.suggestedFix})),executionFeedback:state.executionFeedback||undefined,provider:state.aiProvider}});
      const diff=workflowDiff(current,response.correctedWorkflow);
      const proposal:SemanticVerificationProposal={reviewSummary:response.reviewSummary,findings:response.findings,diff,correctedWorkflow:response.correctedWorkflow,provider:response.provider,model:response.model,durationMs:response.durationMs};
      const needsInput=response.verdict==="NEEDS_INPUT"||response.findings.some((f:any)=>f.requiresUserInput)||response.correctedWorkflow.ambiguities.some((a:any)=>a.requiresUserInput);
      if(needsInput){
        set({semanticReviewRunning:false,semanticProposal:proposal,status:"NEEDS USER INPUT",verifiedAt:null,validationPhases:{...state.validationPhases,semantics:"fail",execution:"pending"},verifyLog:[...state.verifyLog,`Model verdict: NEEDS_INPUT. Workflow was not changed.`]});
        return;
      }
      if(!response.accepted){
        set({semanticReviewRunning:false,semanticProposal:proposal,status:"ISSUES FOUND",verifiedAt:null,validationPhases:{...state.validationPhases,semantics:"fail",execution:"pending"},verifyLog:[...state.verifyLog,`Model verdict: ${response.verdict}. Replacement candidate was rejected by deterministic validation; old graph preserved.`]});
        return;
      }

      // Atomic replacement: if verifier regenerated, discard the old repair target entirely.
      const compilation=compilationFromWorkflowIR(response.correctedWorkflow,state.prompt);
      const acceptedIssues=verifyGraph(compilation.nodes,compilation.edges,state.prompt);
      const blocking=acceptedIssues.filter(i=>(i.severity==="error"||i.category==="User Input Required")&&!i.resolved);
      if(blocking.length){
        set({semanticReviewRunning:false,semanticProposal:proposal,status:"ISSUES FOUND",verifiedAt:null,validationPhases:{structure:"fail",semantics:"fail",execution:"pending"},verifyLog:[...state.verifyLog,"Compiler rejected the returned complete candidate; old graph preserved."]});
        return;
      }
      const verifiedAt=Date.now();
      set({workflowName:compilation.workflowName,analysis:compilation.analysis,stages:compilation.stages,nodes:compilation.nodes,edges:compilation.edges,compilerNotes:[...state.compilerNotes,...compilation.notes,response.regenerated?`Full workflow regenerated by ${response.model}; previous graph discarded as a repair target.`:`Whole-workflow verdict RIGHT from ${response.model}.`],semanticReviewRunning:false,semanticProposal:proposal,status:"VERIFIED",verifiedAt,issues:acceptedIssues,score:100,executionFeedback:null,validationPhases:{structure:"pass",semantics:"pass",execution:"pending"},verifyLog:[...state.verifyLog,`Model verdict: ${response.verdict}. ${response.regenerated?"Complete replacement applied atomically.":"Current workflow accepted."}`]});
      const tests=await generateTestsHybrid();
      set({generatedTests:tests,testScript:JSON.stringify(tests,null,2),activeTestId:tests[0]?.id??null,verifyLog:[...state.verifyLog,`Verification complete; ${tests.length} validated execution scenario(s) prepared.`]});
    }catch(error){set({semanticReviewRunning:false,semanticReviewError:error instanceof Error?error.message:String(error),status:"ISSUES FOUND",validationPhases:{...state.validationPhases,semantics:"fail"}});}
  },
  async applySemanticProposal(){
    // Compatibility action: accepted replacements are now applied atomically during verification.
    if(state.semanticProposal&&state.status!=="VERIFIED")await flowActions.semanticReview();
  },
  dismissSemanticProposal(){set({semanticProposal:null,semanticReviewError:null});},
  async applyFix(){
    // Targeted verification repairs were intentionally removed in v2.0.
    await flowActions.semanticReview();
  },
  async fixAll(){await flowActions.semanticReview();},
  ignoreIssue(issueId:string){set({issues:state.issues.map(i=>i.id===issueId?{...i,resolved:true}:i)});},
  async regenerateTests(){const tests=await generateTestsHybrid();set({generatedTests:tests,testScript:JSON.stringify(tests,null,2),activeTestId:tests[0]?.id??null,lastTestResult:null});},
  setTestScript(script:string){set({testScript:script});try{const tests=JSON.parse(script) as GeneratedTestCase[];if(Array.isArray(tests))set({generatedTests:tests,activeTestId:tests[0]?.id??null});}catch{}},
  selectTest(id:string){set({activeTestId:id});},
  resetExecution(){resetNodeStatuses();set({execution:initialExec(),lastTestResult:null});},
  log(message:string,detail?:string,level:ExecutionEvent["level"]="info"){set({execution:{...state.execution,log:[...state.execution.log,{time:stamp(),message,detail,level}]}});},
  async run(testId?:string){
    if(state.execution.running)return;
    const blocking=verifyGraph(state.nodes,state.edges,state.prompt).filter(i=>(i.severity==="error"||i.category==="User Input Required")&&!i.resolved);
    if(blocking.length){
      flowActions.resetExecution();
      const reason=`Execution blocked by verification: ${blocking.slice(0,4).map(i=>i.title).join("; ")}${blocking.length>4?` (+${blocking.length-4} more)`:""}. Re-verify/regenerate the workflow before testing.`;
      const feedback={testName:"Execution preflight",reason,path:[],inputs:{},approvals:{}};
      set({lastTestResult:{passed:false,reason,path:[],testId:testId||state.activeTestId||undefined,testName:"Execution preflight",failureKind:"workflow"},executionFeedback:feedback,status:"DRAFT",verifiedAt:null});
      flowActions.log("Execution blocked",reason,"error");
      return;
    }
    let tests=state.generatedTests;try{const parsed=JSON.parse(state.testScript);if(Array.isArray(parsed))tests=parsed;}catch{flowActions.log("Test script is invalid JSON","Fix the custom test script before running.","error");return;}const requiredCoverage=requiredCoverageTargets(state.nodes,state.edges);const coveredKeys=new Set(tests.filter((t:any)=>t?.coverageTarget).map((t:any)=>coverageKey(t.coverageTarget)));const missingCoverage=requiredCoverage.filter(t=>!coveredKeys.has(coverageKey(t)));if(missingCoverage.length){const reason=`TEST_DEFINITION_INVALID: execution suite is missing required coverage: ${missingCoverage.map(t=>coverageKey(t)).join(", ")}. Regenerate tests before execution.`;set({lastTestResult:{passed:false,reason,path:[],testId:testId||state.activeTestId||undefined,testName:"Coverage preflight",failureKind:"test-definition"},validationPhases:{...state.validationPhases,execution:"fail"}});flowActions.log("Execution coverage incomplete",reason,"warning");return;}const rawTest=tests.find(t=>t.id===(testId||state.activeTestId))||tests[0]||{id:"manual",name:"Manual test",description:"",inputs:{},approvals:{},expectedPathIncludes:[],source:"custom"};const test:GeneratedTestCase={...rawTest,source:rawTest.source||"custom",inputs:rawTest.inputs||{},approvals:rawTest.approvals||{},nodeMocks:rawTest.nodeMocks||{},expectedPathIncludes:[]};for(const [id,mock] of Object.entries(test.nodeMocks||{})){const nd=state.nodes.find(n=>n.id===id);if(!nd){const reason=`Test definition references unknown mock node ${id}.`;set({lastTestResult:{passed:false,reason,path:[],testId:test.id,testName:test.name,failureKind:"test-definition"}});flowActions.log("Test definition invalid",reason,"warning");return;}const errs=validateNodeMock(nd.data.kind,mock as Record<string,unknown>);if(errs.length){const reason=`TEST_DEFINITION_INVALID: ${errs.join(" ")}`;set({lastTestResult:{passed:false,reason,path:[],testId:test.id,testName:test.name,failureKind:"test-definition"}});flowActions.log("Test definition invalid",reason,"warning");return;}}const oracle=deriveExpectedExecution(state.nodes,state.edges,test);flowActions.resetExecution();if(!oracle.valid){const reason=`Test definition cannot drive the verified workflow: ${oracle.reason||"unknown routing problem"}`;set({activeTestId:test.id,lastTestResult:{passed:false,reason,path:oracle.pathIds,testId:test.id,testName:test.name,failureKind:"test-definition"}});flowActions.log("Test definition invalid",reason,"warning");return;}test.expectedPathIncludes=oracle.pathNames;if(oracle.terminal&&!oracle.terminal.startsWith("FAILED:"))test.expectedTerminal=oracle.terminal;set({activeTestId:test.id,status:"RUNNING",execution:{...initialExec(),running:true,startedAt:Date.now(),inputs:test.inputs||{},approvals:test.approvals||{},nodeMocks:test.nodeMocks||{},expectedPathIncludes:test.expectedPathIncludes,expectedTerminal:test.expectedTerminal,testName:test.name,coverageTarget:test.coverageTarget}});flowActions.log(`Test started: ${test.name}`,`${JSON.stringify(test.inputs)}; expected route derived by FlowForge: ${oracle.pathNames.join(" → ")}`,"success");const trigger=state.nodes.find(n=>n.data.kind==="trigger");if(!trigger){flowActions.finishTest(false,"No trigger node exists.");return;}await flowActions.traverse(trigger.id);},
  async traverse(startId:string){let currentId:string|null=startId;const MAX_NODE_VISITS=40;while(currentId){
      const visits=(state.execution.visitCounts[currentId]||0)+1;
      if(visits>MAX_NODE_VISITS){flowActions.finishTest(false,`Execution safety limit reached at ${currentId} after ${MAX_NODE_VISITS} visits. The loop may not converge for this test input.`);return;}
      set({execution:{...state.execution,visitCounts:{...state.execution.visitCounts,[currentId]:visits}}});
      const node=state.nodes.find(nd=>nd.id===currentId);if(!node){flowActions.finishTest(false,`Node ${currentId} does not exist.`);return;}set({execution:{...state.execution,path:[...state.execution.path,node.id]}});
      if(node.data.kind==="approval"){patchNode(node.id,{status:"paused"});const scripted=state.execution.approvals[node.id];if(scripted){flowActions.log(`${node.data.name} — scripted ${scripted}`,undefined,scripted==="approved"?"success":"warning");await wait(350);await flowActions.decideOutcome(scripted);return;}flowActions.log(`Waiting for ${node.data.name}`,`Approval role: ${node.data.config?.Role||"Approver"}`,"warning");set({execution:{...state.execution,awaiting:node.id}});return;}
      patchNode(node.id,{status:"running"});flowActions.log(`${node.data.name} — running`,node.data.config?.Operation);
      if(node.data.kind==="delay"){
        const requested=parseDurationMs(node.data.config); if(requested===null){patchNode(node.id,{status:"failed"});flowActions.finishTest(false,`Delay node ${node.data.name} has no parseable duration.`);return;}
        const simulated=Math.min(requested,TEST_DELAY_CAP_MS);
        flowActions.log("Delay simulated",`${humanDuration(requested)} requested → ${Math.round(simulated/1000*10)/10}s test wait`,"info");
        await wait(simulated); set({execution:{...state.execution,virtualElapsedMs:state.execution.virtualElapsedMs+requested}});
      }else {
        await wait(420);
        if(["api","database","notification","webhook"].includes(node.data.kind)){const io=testIoOutcome(node,{...state.execution.inputs,...state.execution.outputs},state.execution.nodeMocks[node.id]||{});flowActions.log(io.message,io.detail,io.ok?"success":"error");if(io.outputKey)set({execution:{...state.execution,outputs:{...state.execution.outputs,[io.outputKey]:io.output}}});if(!io.ok){const failEdge=state.edges.find(ed=>ed.source===node.id&&String(ed.label||ed.sourceHandle||"").toUpperCase()==="FALSE");if(failEdge){patchNode(node.id,{status:"failed"});set({execution:{...state.execution,activeEdges:[...state.execution.activeEdges,failEdge.id]}});currentId=failEdge.target;continue;}patchNode(node.id,{status:"failed"});flowActions.finishTest(false,io.detail||`${node.data.name} failed.`);return;}}
      }
      patchNode(node.id,{status:"completed"});set({execution:{...state.execution,executedNodes:state.execution.executedNodes+1,apiCalls:state.execution.apiCalls+(["api","database","notification","webhook"].includes(node.data.kind)?1:0)}});
      if(node.data.kind==="end"){flowActions.finishTest(true,`Reached terminal state: ${node.data.name}`,node.data.name);return;}
      let outgoing=state.edges.filter(ed=>ed.source===node.id);
      if(node.data.kind==="condition"){
        const visit=state.execution.conditionVisits[node.id]||0; const ev=evaluateCondition(node.data.config?.Expression||"",state.execution.inputs,visit);
        set({execution:{...state.execution,conditionVisits:{...state.execution.conditionVisits,[node.id]:visit+1}}});
        if(ev.result===null){patchNode(node.id,{status:"failed"});flowActions.log("Condition not evaluable",ev.detail,"error");flowActions.finishTest(false,ev.detail);return;}
        flowActions.log("Condition evaluated",ev.detail,ev.result?"success":"warning");const wanted=ev.result?"TRUE":"FALSE";outgoing=outgoing.filter(ed=>String(ed.label||ed.sourceHandle||"").toUpperCase()===wanted);
      }else {
        const labels=outgoing.map(ed=>String(ed.label||ed.sourceHandle||"").toUpperCase());
        if(["api","database","notification","webhook"].includes(node.data.kind) && labels.includes("TRUE")) outgoing=outgoing.filter(ed=>String(ed.label||ed.sourceHandle||"").toUpperCase()==="TRUE");
        else outgoing=outgoing.filter(ed=>String(ed.label||"").toUpperCase()!=="REJECTED"&&String(ed.label||ed.sourceHandle||"").toUpperCase()!=="FALSE");
      }
      if(outgoing.length>1){
        const joinPlan=findParallelJoinPlan(state.nodes,state.edges,node.id);
        if(joinPlan){flowActions.log("Parallel fan-out",`${node.data.name} → ${joinPlan.branches.length} branches → ${state.nodes.find(n=>n.id===joinPlan.joinId)?.data.name||joinPlan.joinId}`,"info");for(const branch of joinPlan.branches){for(const id of branch.nodeIds){const bn=state.nodes.find(n=>n.id===id)!;set({execution:{...state.execution,path:[...state.execution.path,id],activeEdges:[...state.execution.activeEdges,...branch.edgeIds]}});patchNode(id,{status:"running"});flowActions.log(`${bn.data.name} — parallel branch running`,bn.data.config?.Operation);if(bn.data.kind==="delay"){const requested=parseDurationMs(bn.data.config);if(requested===null){patchNode(id,{status:"failed"});flowActions.finishTest(false,`Delay node ${bn.data.name} has no parseable duration.`);return;}await wait(Math.min(requested,TEST_DELAY_CAP_MS));set({execution:{...state.execution,virtualElapsedMs:state.execution.virtualElapsedMs+requested}});}else{await wait(260);if(["api","database","notification","webhook"].includes(bn.data.kind)){const io=testIoOutcome(bn,{...state.execution.inputs,...state.execution.outputs},state.execution.nodeMocks[id]||{});flowActions.log(io.message,io.detail,io.ok?"success":"error");if(io.outputKey)set({execution:{...state.execution,outputs:{...state.execution.outputs,[io.outputKey]:io.output}}});if(!io.ok){patchNode(id,{status:"failed"});flowActions.finishTest(false,io.detail||`${bn.data.name} failed.`);return;}}}patchNode(id,{status:"completed"});set({execution:{...state.execution,executedNodes:state.execution.executedNodes+1}});}}const join=state.nodes.find(n=>n.id===joinPlan.joinId)!;set({execution:{...state.execution,path:[...state.execution.path,join.id]}});patchNode(join.id,{status:"completed"});flowActions.log(`${join.data.name} — all parallel branches synchronized`,undefined,"success");const nextJoin=state.edges.find(e=>e.source===join.id);if(!nextJoin){flowActions.finishTest(false,`Join ${join.data.name} has no continuation.`);return;}set({execution:{...state.execution,activeEdges:[...state.execution.activeEdges,nextJoin.id]}});currentId=nextJoin.target;continue;}
        const targets=outgoing.map(ed=>({ed,target:state.nodes.find(n=>n.id===ed.target)}));
        const fanoutSafe=targets.every(x=>x.target&&["action","api","webhook","database","notification"].includes(x.target.data.kind)&&!state.edges.some(ed=>ed.source===x.target!.id));
        if(!fanoutSafe){flowActions.finishTest(false,`Parallel fan-out from ${node.data.name} does not converge on a supported Join barrier.`);return;}
        flowActions.log("Parallel fan-out",`${node.data.name} → ${targets.map(x=>x.target!.data.name).join(" | ")}`,"info");
        for(const {ed,target} of targets){
          const leaf=target!;set({execution:{...state.execution,activeEdges:[...state.execution.activeEdges,ed.id],path:[...state.execution.path,leaf.id]}});patchNode(leaf.id,{status:"running"});flowActions.log(`${leaf.data.name} — running`,leaf.data.config?.Operation);await wait(300);
          if(["api","database","notification","webhook"].includes(leaf.data.kind)){const io=testIoOutcome(leaf,{...state.execution.inputs,...state.execution.outputs},state.execution.nodeMocks[leaf.id]||{});flowActions.log(io.message,io.detail,io.ok?"success":"error");if(io.outputKey)set({execution:{...state.execution,outputs:{...state.execution.outputs,[io.outputKey]:io.output}}});if(!io.ok){patchNode(leaf.id,{status:"failed"});flowActions.finishTest(false,io.detail||`${leaf.data.name} failed.`);return;}}
          patchNode(leaf.id,{status:"completed"});set({execution:{...state.execution,executedNodes:state.execution.executedNodes+1,apiCalls:state.execution.apiCalls+(["api","database","notification","webhook"].includes(leaf.data.kind)?1:0)}});
        }
        flowActions.finishTest(true,`Parallel branches completed: ${targets.map(x=>x.target!.data.name).join(", ")}`,"Parallel branches completed");return;
      }
      const next=outgoing[0];if(!next){
        if(["action","api","webhook","database","notification"].includes(node.data.kind)){flowActions.finishTest(true,`Workflow completed after terminal action: ${node.data.name}`,node.data.name);return;}
        flowActions.finishTest(false,`No valid outgoing path from ${node.data.name}.`);return;}set({execution:{...state.execution,activeEdges:[...state.execution.activeEdges,next.id]}});await wait(250);currentId=next.target;}
  },
  async decideOutcome(outcome:"approved"|"rejected"|"timeout"){const id=state.execution.awaiting||state.nodes.find(n=>n.data.kind==="approval"&&n.data.status==="paused")?.id;if(!id)return;const wanted=outcome==="approved"?"APPROVED":outcome==="timeout"?"TIMEOUT":"REJECTED";patchNode(id,{status:outcome==="approved"?"completed":"failed"});set({execution:{...state.execution,awaiting:null,executedNodes:state.execution.executedNodes+1}});flowActions.log(outcome==="approved"?"Approval accepted":outcome==="timeout"?"Approval timed out":"Approval rejected",undefined,outcome==="approved"?"success":"warning");const edge=state.edges.find(ed=>ed.source===id&&String(ed.label||ed.sourceHandle||"").toUpperCase()===wanted);if(!edge){flowActions.finishTest(false,`Missing ${wanted} branch from approval.`);return;}set({execution:{...state.execution,activeEdges:[...state.execution.activeEdges,edge.id]}});await wait(250);await flowActions.traverse(edge.target);},
  async decide(approved:boolean){await flowActions.decideOutcome(approved?"approved":"rejected");},
  finishTest(basePassed:boolean,reason:string,terminal?:string){
    const expected=state.execution.expectedPathIncludes;
    const names=state.execution.path.map(id=>state.nodes.find(n=>n.id===id)?.data.name||id);
    const missing=expected.filter(x=>!names.includes(x));
    const expectedTerminal=state.execution.expectedTerminal;
    const terminalMismatch=Boolean(expectedTerminal&&terminal&&expectedTerminal!==terminal);
    // Expected-path assertions are derived by FlowForge before execution. If an old/custom
    // script still contains stale expectations, classify it as a TEST DEFINITION problem
    // rather than falsely blaming a workflow that completed correctly.
    const target=state.execution.coverageTarget;const targetBranch=target?.branch==="LOOP_REPEAT"?"TRUE":target?.branch==="LOOP_EXIT"?"FALSE":target?.branch==="SUCCESS"?"TRUE":target?.branch==="FAILURE"?"FALSE":target?.branch;const coverageSatisfied=!target||state.execution.activeEdges.some(id=>{const ed=state.edges.find(e=>e.id===id);return ed?.source===target.nodeId&&String(ed.label||ed.sourceHandle||"DEFAULT").toUpperCase()===targetBranch;});
    const assertionMismatch=missing.length>0||terminalMismatch||!coverageSatisfied;
    const testDefinitionInvalid=/^TEST_DEFINITION_INVALID:/i.test(reason);
    const passed=basePassed&&!assertionMismatch&&!testDefinitionInvalid;
    const finalReason=testDefinitionInvalid?reason:missing.length?`${reason} Test definition expected stages that were not reached: ${missing.join(", ")}.`:terminalMismatch?`${reason} Test definition expected terminal ${expectedTerminal}, reached ${terminal}.`:!coverageSatisfied&&target?`${reason} Coverage target ${target.nodeId}/${target.branch} was not actually visited.`:reason;
    const failureKind:TestRunResult["failureKind"]=passed?undefined:testDefinitionInvalid?"test-definition":basePassed?"assertion":"workflow";
    flowActions.log(passed?"Test passed":failureKind==="test-definition"?"Test definition mismatch":"Test failed",finalReason,passed?"success":failureKind==="test-definition"?"warning":"error");
    const feedback=!passed&&failureKind==="workflow"?{testName:state.execution.testName,reason:finalReason,path:[...state.execution.path],terminal,inputs:{...state.execution.inputs},approvals:{...state.execution.approvals}}:state.executionFeedback;
    set({status:state.verifiedAt?"VERIFIED":state.status,execution:{...state.execution,running:false,finished:true,durationMs:state.execution.startedAt?Date.now()-state.execution.startedAt:null},lastTestResult:{passed,reason:finalReason,path:[...state.execution.path],terminal,testId:state.activeTestId||undefined,testName:state.execution.testName,failureKind},executionFeedback:feedback,validationPhases:{...state.validationPhases,execution:state.certificationRunning&&!passed?"fail":state.validationPhases.execution}});
  },
  flagLastFailureForVerification(){
    if(state.lastTestResult?.passed)return;
    const feedback={testName:state.lastTestResult?.testName||state.execution.testName,reason:state.lastTestResult?.reason||"Execution test failed",path:[...state.execution.path],terminal:state.lastTestResult?.terminal,inputs:{...state.execution.inputs},approvals:{...state.execution.approvals}};
    set({executionFeedback:feedback,status:"DRAFT",verifiedAt:null,verifyLog:[...state.verifyLog,`Execution failure queued for semantic re-verification: ${feedback.reason}`]});
  },
  async certifyAndSave(){
    if(state.certificationRunning||state.execution.running)return;
    if(state.status!=="VERIFIED"||state.validationPhases.structure!=="pass"||state.validationPhases.semantics!=="pass"||!state.verifiedAt){
      set({lastTestResult:{passed:false,reason:"Certification blocked: structural and semantic verification must pass before execution certification.",path:[],testName:"Certification preflight",failureKind:"workflow"},validationPhases:{...state.validationPhases,execution:"fail"}});return;
    }
    const tests=generateTests(state.nodes,state.edges,state.prompt);
    const required=requiredCoverageTargets(state.nodes,state.edges);const covered=new Set(tests.filter(t=>t.coverageTarget).map(t=>coverageKey(t.coverageTarget!)));
    const missing=required.filter(t=>!covered.has(coverageKey(t)));
    if(missing.length){set({lastTestResult:{passed:false,reason:`Certification blocked: mandatory coverage missing: ${missing.map(coverageKey).join(", ")}.`,path:[],testName:"Certification coverage",failureKind:"test-definition"},validationPhases:{...state.validationPhases,execution:"fail"}});return;}
    set({certificationRunning:true,certificationResults:[],certifiedAt:null,savedWorkflowId:null,generatedTests:tests,testScript:JSON.stringify(tests,null,2),activeTestId:tests[0]?.id??null,validationPhases:{...state.validationPhases,execution:"pending"}});
    const results:CertifiedTestResult[]=[];
    for(const test of tests){
      await flowActions.run(test.id);
      const r=state.lastTestResult;
      if(state.execution.running||state.execution.awaiting){
        set({certificationRunning:false,certificationResults:results,lastTestResult:{passed:false,reason:`Certification failed: ${test.name} requires unscripted human input.`,path:[...state.execution.path],testId:test.id,testName:test.name,failureKind:"test-definition"},validationPhases:{...state.validationPhases,execution:"fail"}});return;
      }
      if(!r?.passed){set({certificationRunning:false,certificationResults:results,certifiedAt:null,savedWorkflowId:null,validationPhases:{...state.validationPhases,execution:"fail"}});return;}
      results.push({testId:test.id,testName:test.name,passed:true,reason:r.reason,path:[...r.path],terminal:r.terminal});
    }
    const certifiedAt=Date.now();const id=`wf-${state.workflowName.toLowerCase().replace(/\W+/g,"-").replace(/^-+|-+$/g,"")||"workflow"}-${certifiedAt}`;
    const record:SavedWorkflow={format:FLOWFORGE_FILE_FORMAT,formatVersion:FLOWFORGE_FILE_VERSION,id,name:state.workflowName,version:state.version,sourcePrompt:state.prompt,status:"VERIFIED",createdAt:certifiedAt,certifiedAt,verification:{score:state.score,verifiedAt:state.verifiedAt!,phases:{structure:"pass",semantics:"pass",execution:"pass"}},analysis:state.analysis,stages:state.stages,nodes:state.nodes.map(n=>({...n,data:{...n.data,status:"idle",scanning:false}})),edges:state.edges,tests,certificationResults:results,compilerNotes:state.compilerNotes};
    saveCertifiedWorkflow(record);
    set({certificationRunning:false,certificationResults:results,certifiedAt,savedWorkflowId:id,validationPhases:{structure:"pass",semantics:"pass",execution:"pass"},status:"VERIFIED"});
  },
  loadSavedWorkflow(id:string){const w=getSavedWorkflow(id);if(!w)return false;set({workflowName:w.name,version:w.version,status:"VERIFIED",prompt:w.sourcePrompt,analysis:w.analysis,stages:w.stages,compilerNotes:w.compilerNotes||[],nodes:w.nodes.map(n=>({...n,data:{...n.data,status:"idle",scanning:false}})),edges:w.edges,compiled:true,issues:[],score:w.verification.score,verifiedAt:w.verification.verifiedAt,verifying:false,verifyLog:["Loaded certified workflow from library."],selectedNodeId:null,generatedTests:w.tests,activeTestId:w.tests[0]?.id??null,testScript:JSON.stringify(w.tests,null,2),lastTestResult:null,execution:initialExec(),semanticReviewRunning:false,semanticReviewError:null,semanticProposal:null,executionFeedback:null,validationPhases:{structure:"pass",semantics:"pass",execution:"pass"},certificationRunning:false,certificationResults:w.certificationResults,certifiedAt:w.certifiedAt,savedWorkflowId:w.id});return true;},
  setNodeStatus(id:string,status:NodeRunStatus){patchNode(id,{status});},
  reset(){set({workflowName:"Untitled Workflow",status:"DRAFT",prompt:"",analysis:emptyAnalysis,stages:[],compilerNotes:[],nodes:[],edges:[],compiled:false,issues:[],score:0,verifiedAt:null,verifyLog:[],execution:initialExec(),generatedTests:[],testScript:"[]",lastTestResult:null,semanticReviewRunning:false,semanticReviewError:null,semanticProposal:null,validationPhases:{structure:"pending",semantics:"pending",execution:"pending"},certificationRunning:false,certificationResults:[],certifiedAt:null,savedWorkflowId:null});}
};

export function buildIR(s:FlowState){return {workflow:{id:`wf-${s.workflowName.toLowerCase().replace(/\W+/g,"-")}`,name:s.workflowName,version:s.version,status:s.status,sourcePrompt:s.prompt},analysis:s.analysis,trigger:s.nodes.filter(nd=>nd.data.kind==="trigger").map(nd=>({id:nd.id,event:nd.data.config?.Event??"custom.event"}))[0]??{},nodes:s.nodes.map(nd=>({id:nd.id,type:nd.data.kind,name:nd.data.name,description:nd.data.subtitle,config:nd.data.config??{}})),edges:s.edges.map(ed=>({id:ed.id,from:ed.source,to:ed.target,condition:ed.label??ed.sourceHandle??null})),tests:s.generatedTests};}
