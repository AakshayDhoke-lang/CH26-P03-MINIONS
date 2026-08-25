import type { WorkflowIR } from "@/lib/workflow-ir";

type Node = WorkflowIR["nodes"][number];
type Edge = WorkflowIR["edges"][number];
const n=(id:string,type:Node["type"],name:string,description:string,config:Node["config"]={}):Node=>({id,type,name,description,config});
const e=(source:string,target:string,branch:Edge["branch"]="DEFAULT"):Edge=>({source,target,branch});
const end=(id:string,name:string):Node=>n(id,"end",name,`Workflow terminates: ${name}`,{});

function complaint():WorkflowIR{
  return {
    workflowName:"Customer Complaint Triage",purpose:"Classify incoming complaints and route them according to severity.",summary:"Complaint intake, severity classification, conditional escalation or queue assignment, and customer notification.",triggerDescription:"A customer complaint arrives",actors:["Customer","Support Lead","Support Queue"],inputs:[{name:"severity",type:"string",description:"Classified complaint severity",required:true,allowedValues:["critical","normal"]}],conditions:["severity == critical"],actions:["Classify Severity","Escalate to Support Lead","Assign to Support Queue","Email Customer"],ambiguities:[],assumptions:["Non-critical complaints follow the FALSE branch."],
    nodes:[n("complaint_received","trigger","Customer Complaint Received","Starts when a customer complaint arrives",{Event:"customer.complaint.received"}),n("classify_severity","action","Classify Severity","Determine complaint severity",{Operation:"Classify Severity"}),n("severity_critical","condition","Is Severity Critical?","Check whether the classified severity is critical",{Expression:'severity == "critical"'}),n("escalate_support_lead","action","Escalate to Support Lead","Escalate critical complaints to the support lead",{Operation:"Escalate to Support Lead"}),n("assign_support_queue","action","Assign to Support Queue","Assign non-critical complaints to the support queue",{Operation:"Assign to Support Queue"}),n("email_customer","notification","Email Customer","Send the customer a complaint acknowledgement",{Operation:"SendNotification",RecipientRole:"Customer",Channel:"Email",Message:"Your complaint has been received and assigned.",ExecutionMode:"TEST"})],
    edges:[e("complaint_received","classify_severity"),e("classify_severity","severity_critical"),e("severity_critical","escalate_support_lead","TRUE"),e("severity_critical","assign_support_queue","FALSE"),e("assign_support_queue","email_customer")]
  };
}

function purchase():WorkflowIR{
  return {
    workflowName:"Purchase Request Approval",purpose:"Route high-value purchase requests through manager approval and notify finance after approval.",summary:"Purchase request intake, amount check, manager approval for high-value requests, purchase-order creation, and finance notification.",triggerDescription:"A purchase request arrives",actors:["Requester","Manager","Finance"],inputs:[{name:"amount",type:"number",description:"Purchase request amount",required:true}],conditions:["amount > 50000"],actions:["Check Amount","Manager Approval","Create Purchase Order","Notify Finance"],ambiguities:[],assumptions:["Requests at or below ₹50,000 terminate after the amount check because no further action was specified."],
    nodes:[n("purchase_received","trigger","Purchase Request Received","Starts when a new purchase request arrives",{Event:"purchase.request.received"}),n("check_amount","action","Check Amount","Read and validate the purchase amount",{Operation:"Check Amount"}),n("amount_high","condition","Is Amount Above ₹50,000?","Route requests above ₹50,000 for approval",{Expression:"amount > 50000"}),n("manager_approval","approval","Manager Approval","Request manager approval",{Role:"Manager"}),n("create_po","action","Create Purchase Order","Create the purchase order after approval",{Operation:"Create Purchase Order"}),n("notify_finance","notification","Notify Finance","Notify finance that the purchase order was created",{Operation:"SendNotification",RecipientRole:"Finance",Channel:"deployment-configured",Message:"Purchase order created after approval.",ExecutionMode:"TEST"}),end("not_required","No Further Approval Required"),end("rejected","Purchase Request Rejected")],
    edges:[e("purchase_received","check_amount"),e("check_amount","amount_high"),e("amount_high","manager_approval","TRUE"),e("amount_high","not_required","FALSE"),e("manager_approval","create_po","APPROVED"),e("manager_approval","rejected","REJECTED"),e("create_po","notify_finance")]
  };
}

function leave():WorkflowIR{
  return {
    workflowName:"Leave Request Approval",purpose:"Evaluate leave duration and route longer leave requests for manager approval.",summary:"Leave request intake, duration check, manager approval when needed, and employee/HR notification.",triggerDescription:"A leave request arrives",actors:["Employee","Manager","HR"],inputs:[{name:"leave_days",type:"number",description:"Requested leave duration in days",required:true}],conditions:["leave_days > 5"],actions:["Check Leave Days","Manager Approval","Notify HR","Notify Employee"],ambiguities:[],assumptions:["Leave requests of five days or fewer are accepted through the normal path and the employee is notified."],
    nodes:[n("leave_received","trigger","Leave Request Received","Starts when an employee submits a leave request",{Event:"leave.request.received"}),n("check_days","action","Check Leave Days","Check requested leave duration",{Operation:"Check Leave Days"}),n("long_leave","condition","Is Leave More Than 5 Days?","Determine whether manager approval is required",{Expression:"leave_days > 5"}),n("manager_approval","approval","Manager Approval","Request approval for long leave",{Role:"Manager"}),n("notify_hr","notification","Notify HR","Notify HR after manager approval",{Operation:"SendNotification",RecipientRole:"HR",Channel:"deployment-configured",Message:"Long leave request approved.",ExecutionMode:"TEST"}),n("notify_employee","notification","Notify Employee","Notify the employee when manager approval is not required or is rejected",{Operation:"SendNotification",RecipientRole:"Employee",Channel:"deployment-configured",Message:"Your leave request has been processed.",ExecutionMode:"TEST"})],
    edges:[e("leave_received","check_days"),e("check_days","long_leave"),e("long_leave","manager_approval","TRUE"),e("long_leave","notify_employee","FALSE"),e("manager_approval","notify_hr","APPROVED"),e("manager_approval","notify_employee","REJECTED")]
  };
}

function supportTicket():WorkflowIR{
  return {
    workflowName:"Support Ticket Routing",purpose:"Prioritize and route incoming support tickets.",summary:"Ticket intake, priority classification, urgent escalation, normal queue assignment, and requester notification.",triggerDescription:"A support ticket arrives",actors:["Support Team","Support Lead","Requester"],inputs:[{name:"priority",type:"string",description:"Ticket priority",required:true,allowedValues:["urgent","normal"]}],conditions:["priority == urgent"],actions:["Classify Priority","Escalate Urgent Ticket","Assign Support Queue","Notify Requester"],ambiguities:[],assumptions:[],
    nodes:[n("ticket_received","trigger","Support Ticket Received","Starts when a support ticket arrives",{Event:"support.ticket.received"}),n("classify_priority","action","Classify Priority","Classify the support ticket priority",{Operation:"Classify Priority"}),n("is_urgent","condition","Is Ticket Urgent?","Check whether priority is urgent",{Expression:'priority == "urgent"'}),n("escalate_ticket","action","Escalate Urgent Ticket","Escalate urgent ticket to support lead",{Operation:"Escalate Urgent Ticket"}),n("assign_queue","action","Assign Support Queue","Assign normal ticket to support queue",{Operation:"Assign Support Queue"}),n("notify_requester","notification","Notify Requester","Notify requester that the ticket has been assigned",{Operation:"SendNotification",RecipientRole:"Requester",Channel:"deployment-configured",Message:"Your support ticket has been assigned.",ExecutionMode:"TEST"})],
    edges:[e("ticket_received","classify_priority"),e("classify_priority","is_urgent"),e("is_urgent","escalate_ticket","TRUE"),e("is_urgent","assign_queue","FALSE"),e("assign_queue","notify_requester")]
  };
}

function onboarding():WorkflowIR{
  return {
    workflowName:"Employee Onboarding",purpose:"Coordinate a simple employee onboarding process.",summary:"New-hire intake followed by account creation, orientation scheduling, and welcome notification.",triggerDescription:"A new employee joins",actors:["HR","IT","Employee"],inputs:[],conditions:[],actions:["Create Employee Record","Create Core Accounts","Schedule Orientation","Send Welcome Email"],ambiguities:[],assumptions:["Steps run sequentially unless parallel execution is explicitly requested."],
    nodes:[n("employee_joined","trigger","New Employee Joined","Starts when a new employee joins",{Event:"employee.joined"}),n("create_record","action","Create Employee Record","Create the onboarding record",{Operation:"Create Employee Record"}),n("create_accounts","action","Create Core Accounts","Create required employee accounts",{Operation:"Create Core Accounts"}),n("schedule_orientation","action","Schedule Orientation","Schedule the employee orientation",{Operation:"Schedule Orientation"}),n("welcome_email","notification","Send Welcome Email","Send the employee a welcome message",{Operation:"SendNotification",RecipientRole:"Employee",Channel:"Email",Message:"Welcome to the organization.",ExecutionMode:"TEST"})],
    edges:[e("employee_joined","create_record"),e("create_record","create_accounts"),e("create_accounts","schedule_orientation"),e("schedule_orientation","welcome_email")]
  };
}

function generic(text:string):WorkflowIR{
  const clean=text.replace(/\s+/g," ").trim();
  const triggerMatch=clean.match(/^(?:when|whenever|once|on)\s+(.+?)(?:,|\.|\bthen\b)/i);
  const triggerLabel=triggerMatch?.[1]?.trim()||"Process Requested";
  const verbs=/\b(classify|check|verify|validate|assign|route|escalate|create|update|save|store|record|calculate|fetch|generate|schedule|process|notify|email|inform|send)\b/i;
  const clauses=clean.split(/(?:\.|;|,\s*then\s+|\bthen\b)/i).map(x=>x.trim()).filter(Boolean);
  const actions=clauses.filter(c=>verbs.test(c)).slice(0,5);
  const chosen=actions.length?actions:["Process Request"];
  const nodes:Node[]=[n("trigger","trigger",triggerLabel.replace(/^a\s+/i,"").replace(/\barrives?$/i,"Received"),`Starts when ${triggerLabel}`,{Event:"process.received"})];
  const edges:Edge[]=[]; let prev="trigger";
  chosen.forEach((a,i)=>{const comm=/\b(notify|email|inform|send)\b/i.test(a);const id=`step_${i+1}`;const name=a.replace(/^(and|then)\s+/i,"").replace(/^./,c=>c.toUpperCase());nodes.push(n(id,comm?"notification":"action",name,name,comm?{Operation:"SendNotification",RecipientRole:"Stakeholder",Channel:"deployment-configured",Message:name,ExecutionMode:"TEST"}:{Operation:name}));edges.push(e(prev,id));prev=id;});
  return {workflowName:"Generated Business Workflow",purpose:clean,summary:"Deterministic demo-safe workflow generated from the supplied process.",triggerDescription:triggerLabel,actors:[],inputs:[],conditions:[],actions:chosen,nodes,edges,ambiguities:[],assumptions:["Demo-safe fallback used because the configured AI provider was unavailable or returned unusable output."]};
}

export function buildDemoSafeWorkflow(text:string):WorkflowIR{
  const t=text.toLowerCase();
  if(/complaint/.test(t)&&/(severity|critical|support lead|support queue)/.test(t)) return complaint();
  if(/purchase/.test(t)&&/(50\s*,?\s*000|manager|purchase order|finance)/.test(t)) return purchase();
  if(/leave/.test(t)&&/(manager|days|hr|employee)/.test(t)) return leave();
  if(/support ticket|ticket/.test(t)&&/(priority|urgent|queue|requester)/.test(t)) return supportTicket();
  if(/onboard|new employee|employee joins/.test(t)) return onboarding();
  return generic(text);
}

export function isDemoSafeScenario(text:string):boolean{
  const t=text.toLowerCase();
  return (/complaint/.test(t)&&/(severity|critical|support lead|support queue)/.test(t)) ||
    (/purchase/.test(t)&&/(50\s*,?\s*000|manager|purchase order|finance)/.test(t)) ||
    (/leave/.test(t)&&/(manager|days|hr|employee)/.test(t)) ||
    (/support ticket|ticket/.test(t)&&/(priority|urgent|queue|requester)/.test(t)) ||
    (/onboard|new employee|employee joins/.test(t));
}
