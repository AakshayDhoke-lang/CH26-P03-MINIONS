import type { NodeKind } from './types';

export type NodeConfig = Record<string,string>;

const firstText = (...values: unknown[]) => values.map(v=>String(v??'').trim()).find(Boolean) || '';

export function isCommunicationIntent(text:string){
  return /\b(?:notify|notification|email|e-mail|alert|sms|slack|inform|contact)\b|\bmessage\b(?!\s+(?:queue|broker|bus|payload|body|id)\b)|\bsend\s+(?:an?\s+)?(?:email|message|notification|sms|alert|confirmation)\b/i.test(String(text||''));
}

function inferRecipient(text:string){
  const m=text.match(/(?:notify|email|e-mail|message|alert|sms|inform|contact)\s+(?:the\s+)?(.+?)(?:\s+(?:that|about|of|when|with|and|then)\b|$)/i);
  return m?.[1]?.trim() || '';
}
function inferApiMethod(text:string){
  const t=text.toLowerCase();
  if(/\b(get|fetch|read|check|retrieve|lookup|query)\b/.test(t)) return 'GET';
  if(/\b(update|replace)\b/.test(t)) return 'PUT';
  if(/\b(delete|remove)\b/.test(t)) return 'DELETE';
  if(/\b(patch)\b/.test(t)) return 'PATCH';
  return 'POST';
}

/**
 * Adds safe logical defaults only. It deliberately does NOT invent real URLs,
 * email addresses, credentials, database connections, or business rules.
 */
export function completeNodeConfig(kind:NodeKind,name:string,subtitle='',raw:NodeConfig={}):NodeConfig{
  const cfg:NodeConfig={...raw}; const semantic=`${name} ${subtitle}`.trim();
  if(kind==='api'){
    cfg.Operation ||= name || 'API request';
    cfg.Method ||= inferApiMethod(semantic);
    cfg.ExecutionMode ||= 'TEST';
    cfg.SaveResponseAs ||= `${(name||'api').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') || 'api'}_response`;
    cfg.MockStatus ||= '200';
    cfg.MockResponse ||= '{}';
  }
  if(kind==='notification'){
    cfg.Operation ||= 'SendNotification';
    cfg.RecipientRole ||= inferRecipient(name) || inferRecipient(subtitle) || firstText(cfg.Recipient,cfg.recipient) || '';
    cfg.Channel ||= /\b(?:email|e-mail)\b/i.test(semantic) ? 'Email' : /\bsms\b/i.test(semantic) ? 'SMS' : /\bslack\b/i.test(semantic) ? 'Slack' : 'deployment-configured';
    cfg.Message ||= subtitle || name || 'Notification';
    cfg.ExecutionMode ||= 'TEST';
  }
  if(kind==='delay'){
    const m=semantic.match(/(?:wait|delay|pause)\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(seconds?|minutes?|hours?|days?)/i);
    if(m && !cfg.Duration){cfg.Duration=m[1];cfg.Unit=m[2].toLowerCase();}
  }
  if(kind==='database') cfg.Operation ||= name || 'Database operation';
  if(kind==='webhook') cfg.Operation ||= name || 'Webhook operation';
  if(kind==='action') cfg.Operation ||= name || 'Action';
  if(kind==='condition') cfg.Expression ||= '';
  if(kind==='approval') cfg.Role ||= '';
  if(kind==='trigger') cfg.Event ||= name || 'manual.trigger';
  return cfg;
}

export interface ContractFinding {severity:'error'|'warning';reason:string;fix:string;}
export function nodeContractIssues(kind:NodeKind,name:string,subtitle:string|undefined,raw:NodeConfig={}):ContractFinding[]{
  const c=completeNodeConfig(kind,name,subtitle||'',raw); const issues:ContractFinding[]=[];
  const has=(...ks:string[])=>ks.some(k=>String(c[k]??'').trim());
  if(kind==='api'){
    if(!has('Operation')) issues.push({severity:'error',reason:'API node has no logical operation.',fix:'Define what the API call is intended to do.'});
    if(!has('Method')) issues.push({severity:'error',reason:'API node has no HTTP method.',fix:'Set Method to GET, POST, PUT, PATCH, or DELETE.'});
    if(!['GET','POST','PUT','PATCH','DELETE'].includes(String(c.Method||'').toUpperCase())) issues.push({severity:'error',reason:`Unsupported API method '${c.Method}'.`,fix:'Use GET, POST, PUT, PATCH, or DELETE.'});
    if(!has('URL','Url','url','Endpoint','endpoint')) issues.push({severity:'warning',reason:'API has no concrete URL/endpoint yet. Test mode can simulate it, but LIVE execution needs a destination.',fix:'Provide URL/Endpoint before switching this node to LIVE mode.'});
    if(String(c.ExecutionMode||'TEST').toUpperCase()==='LIVE'&&!has('URL','Url','url','Endpoint','endpoint')) issues.push({severity:'error',reason:'LIVE API node cannot run without a URL/endpoint.',fix:'Configure a destination URL or switch ExecutionMode to TEST.'});
  }
  if(kind==='notification'){
    if(!has('Recipient','recipient','RecipientRole','recipientRole')) issues.push({severity:'error',reason:'Notification has no recipient or recipient role.',fix:'Set Recipient or RecipientRole. Do not invent an address if the requirement only names a role.'});
    if(!has('Message','message','Operation')) issues.push({severity:'error',reason:'Notification has no message/delivery intent.',fix:'Set Message or an explicit notification Operation.'});
    if(!has('Channel','channel')) issues.push({severity:'warning',reason:'Notification channel is not selected.',fix:'Choose Email, SMS, Slack, In-App, or keep it deployment-configured for test mode.'});
  }
  if(kind==='delay'&&!has('Duration','duration','Delay','delay','Until','until')) issues.push({severity:'error',reason:'Delay node has no duration or target time.',fix:'Set Duration + Unit, or an Until timestamp.'});
  return issues;
}

const BOOLISH=new Set(['true','false','1','0','yes','no','fail','failed','error','success']);
export function validateNodeMock(kind:NodeKind, mock:Record<string,unknown>={}):string[]{
  const errors:string[]=[]; const keys=Object.keys(mock);
  const allowed=kind==='api'?new Set(['MockStatus','mockStatus','MockFailure','mockFailure','MockResponse','mockResponse']):new Set(['MockFailure','mockFailure']);
  for(const k of keys)if(!allowed.has(k))errors.push(`Unsupported mock field '${k}' for ${kind} node.`);
  const failure=mock.MockFailure??mock.mockFailure;if(failure!==undefined&&!BOOLISH.has(String(failure).trim().toLowerCase()))errors.push(`MockFailure must be boolean-like (true/false), received '${String(failure)}'.`);
  if(kind==='api'){
    const raw=mock.MockStatus??mock.mockStatus;
    if(raw!==undefined){const status=Number(raw);if(!Number.isInteger(status)||status<100||status>599)errors.push(`MockStatus must be an integer HTTP status from 100 to 599, received '${String(raw)}'.`);}
  }
  return errors;
}
