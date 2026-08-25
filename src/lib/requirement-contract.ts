export type RequirementBranch = "TRUE"|"FALSE"|"APPROVED"|"REJECTED"|"TIMEOUT";
export interface RequirementOrderConstraint { before:string; after:string; source:string; }
export interface RequirementBranchConstraint { anchor:string; branch:RequirementBranch; actions:string[]; source:string; }
export interface RequirementRoleConstraint { approvalPhrase:string; role?:string; requiresUserInput:boolean; source:string; }
export interface RequirementContract {
  mustFollow: RequirementOrderConstraint[];
  branches: RequirementBranchConstraint[];
  approvalRoles: RequirementRoleConstraint[];
  requiredActions:string[];
  explicitParallel:boolean;
  loopIntent:boolean;
}

const ACTION=/\b(create|assign|notify|email|message|alert|schedule|classify|escalate|route|send|check|verify|validate|update|save|store|call|request|obtain|extract|match|process|record|open|close|calculate|compute|fetch|get|read|write|generate|publish|archive|sync|run|execute|upload|download|transform|convert)\b/i;
function clean(v:string){return String(v||"").replace(/\s+/g," ").replace(/^[,;:.\s]+|[,;:.\s]+$/g,"").trim();}
export function splitRequirementActions(clause:string):string[]{
  const c=clean(clause).replace(/\b(?:in parallel|simultaneously|concurrently|at the same time)\b/ig,"");
  return c.split(/\s*,\s*|\s+(?:and then|then)\s+|\s+and\s+(?=(?:create|assign|notify|email|message|alert|schedule|classify|escalate|route|send|check|verify|validate|update|save|store|call|request|obtain|extract|match|process|record|open|close|calculate|compute|fetch|get|read|write|generate|publish|archive|sync|run|execute|upload|download|transform|convert)\b)/i).map(clean).filter(x=>ACTION.test(x));
}
function roleFrom(text:string){
  return text.match(/\b(manager|supervisor|admin(?:istrator)?|finance|accounts?|support lead|team lead|owner|director|officer|hr|it|customer|vendor|supplier)\b/i)?.[0];
}
export function buildRequirementContract(prompt:string):RequirementContract{
  const text=String(prompt||"").replace(/\s+/g," ").trim();
  const contract:RequirementContract={mustFollow:[],branches:[],approvalRoles:[],requiredActions:[],explicitParallel:/\b(in parallel|simultaneously|concurrently|at the same time)\b/i.test(text),loopIntent:/\b(repeat|repeating|retry|again|keep checking|keep repeating|continue until|until|while|loop)\b/i.test(text)};
  const sentences=text.split(/(?<=[.!?])\s+/).map(clean).filter(Boolean);
  let previousOrdinaryLast:string|undefined;
  for(let i=0;i<sentences.length;i++){
    let sentence=sentences[i];
    if(i===0) sentence=clean(sentence.replace(/^(?:when|whenever|once|on)\s+.+?,\s*/i,""));
    const approval=sentence.match(/^if\s+(?:(?:it\s+is\s+)?(approved|accepted|rejected|denied|declined|timeout)|(?:it\s+)?(times?\s*out))\s*,?\s*(?:then\s+)?(.+)$/i);
    if(approval){
      const outcome=approval[1]||approval[2];const branch:RequirementBranch = /approved|accepted/i.test(outcome)?"APPROVED":/timeout|times?\s*out/i.test(outcome)?"TIMEOUT":"REJECTED";
      const actions=splitRequirementActions(approval[3]);
      contract.branches.push({anchor:"approval",branch,actions,source:sentences[i]});
      if(!contract.explicitParallel) for(let j=1;j<actions.length;j++) contract.mustFollow.push({before:actions[j-1],after:actions[j],source:sentences[i]});
      previousOrdinaryLast=actions.at(-1)||previousOrdinaryLast;
      continue;
    }
    const cond=sentence.match(/^if\s+(.+?)(?:,|\bthen\b)\s*(.+?)(?:\s*(?:,|;)\s*(?:else|otherwise)\s+(.+))?$/i);
    if(cond){
      const t=splitRequirementActions(cond[2]); const f=splitRequirementActions(cond[3]||"");
      contract.branches.push({anchor:clean(cond[1]),branch:"TRUE",actions:t,source:sentences[i]});
      if(f.length)contract.branches.push({anchor:clean(cond[1]),branch:"FALSE",actions:f,source:sentences[i]});
      if(!contract.explicitParallel){for(let j=1;j<t.length;j++)contract.mustFollow.push({before:t[j-1],after:t[j],source:sentences[i]});for(let j=1;j<f.length;j++)contract.mustFollow.push({before:f[j-1],after:f[j],source:sentences[i]});}
      // Approval role intent inside the TRUE action.
      for(const a of t){ if(/\bapproval|approve|authorize|review\b/i.test(a)){const role=roleFrom(a);contract.approvalRoles.push({approvalPhrase:a,role,requiresUserInput:!role,source:sentences[i]});} }
      previousOrdinaryLast=undefined;
      continue;
    }
    const actions=splitRequirementActions(sentence);
    if(actions.length){
      const explicitParallel=/\b(in parallel|simultaneously|concurrently|at the same time)\b/i.test(sentence);
      if(!explicitParallel){
        for(let j=1;j<actions.length;j++)contract.mustFollow.push({before:actions[j-1],after:actions[j],source:sentences[i]});
        if(previousOrdinaryLast)contract.mustFollow.push({before:previousOrdinaryLast,after:actions[0],source:`${sentences[i-1]||""} ${sentences[i]}`.trim()});
      }
      for(const a of actions){if(/\bapproval|approve|authorize|review\b/i.test(a)){const role=roleFrom(a);contract.approvalRoles.push({approvalPhrase:a,role,requiresUserInput:!role,source:sentences[i]});}}
      previousOrdinaryLast=actions.at(-1);
    }
  }
  const all:string[]=[];
  for(const sentence0 of sentences){let sentence=sentence0.replace(/^(?:when|whenever|once|on)\s+.+?,\s*/i,"");const cond=sentence.match(/^if\s+(.+?)(?:,|\bthen\b)\s*(.+?)(?:\s*(?:,|;)\s*(?:else|otherwise)\s+(.+))?$/i);if(cond){all.push(...splitRequirementActions(cond[2]),...splitRequirementActions(cond[3]||""));continue;}const app=sentence.match(/^if\s+(?:(?:it\s+is\s+)?(?:approved|accepted|rejected|denied|declined|timeout)|(?:it\s+)?times?\s*out)\s*,?\s*(?:then\s+)?(.+)$/i);if(app){all.push(...splitRequirementActions(app[1]));continue;}all.push(...splitRequirementActions(sentence));}
  contract.requiredActions=[...new Set(all.map(clean).filter(Boolean))];
  return contract;
}
