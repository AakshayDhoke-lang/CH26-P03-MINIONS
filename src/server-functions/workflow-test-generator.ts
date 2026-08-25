import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TEST_DESIGNER_PROMPT } from "./prompts/test-prompts";
import { LLM_TOKEN_BUDGETS } from "./prompts/llm-budgets";
import { callConfiguredLLM } from "./llm-provider";


const Req=z.object({originalPrompt:z.string().min(1),workflow:z.any(),baselineTests:z.array(z.any()).default([]),provider:z.enum(["lmstudio","nvidia"]).optional()});

function extractJson(text:string){
  const clean=text.replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/<analysis>[\s\S]*?<\/analysis>/gi,"").replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim();
  try{return JSON.parse(clean);}catch{}
  const a=clean.indexOf("{");const b=clean.lastIndexOf("}");if(a>=0&&b>a)return JSON.parse(clean.slice(a,b+1));
  throw new Error("AI test generator did not return parseable JSON.");
}

export const generateWorkflowTestsWithLocalLLM=createServerFn({method:"POST"})
.validator(Req)
.handler(async({data})=>{
  const user=`ORIGINAL REQUIREMENT:\n${data.originalPrompt}\n\nCURRENT VERIFIED WORKFLOW:\n${JSON.stringify(data.workflow)}\n\nDETERMINISTIC BASELINE TESTS (improve/extend; do not blindly copy):\n${JSON.stringify(data.baselineTests)}\n\nReturn the test JSON now.`;
  async function ask(extra=""){
    const result=await callConfiguredLLM({system:TEST_DESIGNER_PROMPT,user:`${user}${extra}`,maxTokens:extra ? LLM_TOKEN_BUDGETS.testRetry : LLM_TOKEN_BUDGETS.testGenerator,temperature:0,topP:.9,provider:data.provider});
    const parsed=extractJson(result.content);return {tests:Array.isArray(parsed?.tests)?parsed.tests:[],model:result.model,provider:result.provider};
  }
  let result=await ask();
  if(result.tests.length<2){
    const retry=await ask(`\n\nYour first attempt produced fewer than two scenarios. Return 2-8 distinct, executable scenarios grounded in the CURRENT WORKFLOW.`);
    if(retry.tests.length>result.tests.length)result=retry;
  }
  return result;
});
