const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');let pass=0,fail=0;
function read(p){return fs.readFileSync(path.join(root,p),'utf8')}
function check(ok,msg){if(ok){pass++;console.log('PASS',msg)}else{fail++;console.error('FAIL',msg)}}
const rules=read('rules/RULE_BOOK.md');
const core=read('src/lib/flowforge-core-contract.ts');
const verifier=read('src/server-functions/workflow-verifier.ts');
const vp=read('src/server-functions/prompts/verifier-prompts.ts');
const planner=read('src/server-functions/workflow-planner.ts');
const pp=read('src/server-functions/prompts/planner-prompts.ts');
const store=read('src/lib/workflow-store.ts');
const canvas=read('src/components/workflow/WorkflowCanvas.tsx');
const config=read('src/components/workflow/NodeConfiguration.tsx');
const library=read('src/lib/workflow-library.ts');

check(rules.includes('Regenerate, Never Patch'),'single rule book defines regenerate-never-patch architecture');
check(core.includes('RIGHT, WRONG, or NEEDS_INPUT'),'runtime contract exposes exactly three semantic verdicts');
check(vp.includes('WHOLE WORKFLOW VERDICT ONLY')&&vp.includes('Do NOT regenerate it in this phase'),'verifier is verdict-only and cannot mix judgment with generation');
check(vp.includes('Never return workflow JSON, patch operations, repair instructions'),'verdict model is explicitly forbidden from workflow generation and targeted repair DSL');
check(!verifier.includes('ADD_NODE|')&&!verifier.includes('REMOVE_EDGE|')&&!verifier.includes('SET_CONFIG|'),'verifier implementation contains no graph patch DSL');
check(verifier.includes('verifier judges only')&&verifier.includes('PLANNER_SYSTEM_PROMPT'),'WRONG verdict routes regeneration through the planner contract');
check(verifier.includes('Deterministic facts overrule an optimistic model verdict'),'model RIGHT verdict cannot override deterministic failures');
check(verifier.includes('One fresh full-generation retry is allowed')&&!verifier.includes('for (let attempt'),'verifier has no iterative repair loop');

const normalizer=read('src/lib/workflow-ir-normalizer.ts');
const structural=read('src/lib/workflow-structural-rules.ts');
check(normalizer.includes('Only decision nodes own semantic outcome branches')&&normalizer.includes('return "DEFAULT"'),'non-decision branch labels are canonicalized to DEFAULT');
check(structural.includes('Invalid Outcome Branch On Non-Decision Node')&&!structural.includes('I/O nodes use TRUE for success and FALSE for failure'),'old conflicting I/O TRUE/FALSE branch rule was removed');
check(verifier.includes('parseWorkflowCandidate')&&verifier.includes('raw?.workflow')&&verifier.includes('normalizeWorkflow(raw:unknown)'),'regeneration tolerates harmless wrapper format drift and always canonicalizes');
check(verifier.includes('dedupeFindings'),'duplicate model/deterministic issue cards are deduplicated');
check(!planner.includes('targetedPlannerCompletion')&&!planner.includes('parsePlannerCompletionOps'),'planner targeted patch completion was removed');
check(planner.includes('One clean full regeneration. Never patch an incomplete initial graph.'),'invalid initial plan gets full regeneration');
check(!pp.includes('PLANNER_COMPLETION_PROMPT'),'conflicting planner patch prompt removed');
check(pp.includes('"RecipientRole":"Finance"'),'planner example no longer contradicts Notification recipient rule');
check(store.includes('Manual Studio edits are authoritative')&&store.includes('completeNodeConfig(kind,name,subtitle,config)'),'manual node type/value edits are not silently reclassified');
check(config.includes('node?.data.name')&&config.includes('node?.data.config'),'node configuration form resynchronizes after saved attribute changes');
check(canvas.includes('onEdgeDoubleClick')&&canvas.includes('deleteKeyCode')&&store.includes('deleteEdge(id:string)'),'edges are explicitly deletable by double-click and Delete/Backspace');
check(store.includes('Atomic replacement')&&store.includes('previous graph discarded as a repair target'),'accepted regeneration atomically replaces the graph');
check(store.includes('if(!response.accepted)')&&store.includes('old graph preserved'),'rejected regeneration never partially changes the graph');
check(store.includes('status:"VERIFIED"')&&store.includes('validationPhases:{structure:"pass",semantics:"pass",execution:"pending"}'),'execution remains pending after verification');
check(store.includes('if(!r?.passed)')&&store.indexOf('saveCertifiedWorkflow(record)')>store.indexOf('if(!r?.passed)'),'certified workflow is saved only after every mandatory test passes');
check(library.includes('FLOWFORGE_FILE_FORMAT')&&library.includes('download'),'certified workflow export remains versioned/downloadable');

console.log(`\n${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
