// Server-only: buyer-chat spend tracking and the hard daily spend cap. Only token totals per UTC day are stored
// (table assistant_usage); no message text, IP or account is recorded here.
import {eq,desc,sql,type AnyColumn} from 'drizzle-orm';
import {getDb} from '@/db';
import {assistantUsage} from '@/db/schema';
import {env} from '@/src/env';

// US dollars per million tokens (standard tier). gpt-5-mini figures as listed in November 2026 (several price
// trackers agree; confirm on openai.com/api/pricing when prices change). Unknown models are charged at the gpt-5
// rate, so the cap errs on the safe side.
const PRICES:Record<string,{input:number;cached:number;output:number}>={
 'gpt-5-mini':{input:0.25,cached:0.025,output:2},
 'gpt-5-nano':{input:0.05,cached:0.005,output:0.4},
 'gpt-5':{input:1.25,cached:0.125,output:10},
};
const priceOf=(model:string)=>PRICES[model]??PRICES[Object.keys(PRICES).find(k=>model.startsWith(`${k}-`))??'gpt-5'];

/** Daily cap in US dollars (OPENAI_DAILY_BUDGET_USD, default 5). 0 turns the chat off. */
export function dailyBudgetUsd(){
 const raw=env.OPENAI_DAILY_BUDGET_USD,n=raw===undefined?NaN:Number(raw);
 return Number.isFinite(n)&&n>=0?n:5;
}
export const today=()=>new Date().toISOString().slice(0,10);

export type OpenAIUsage={prompt_tokens?:number;completion_tokens?:number;prompt_tokens_details?:{cached_tokens?:number};completion_tokens_details?:{reasoning_tokens?:number}};
const n=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0?Math.round(v):0;

export function costMicros(model:string,u:OpenAIUsage){
 const p=priceOf(model),input=n(u.prompt_tokens),cached=Math.min(n(u.prompt_tokens_details?.cached_tokens),input);
 return Math.ceil((input-cached)*p.input+cached*p.cached+n(u.completion_tokens)*p.output); // tokens × $/M = µ$
}

/** True when today's estimated spend has reached the cap. Throws if the database cannot be read (caller refuses). */
export async function overBudget(){
 const cap=dailyBudgetUsd();
 if(cap<=0)return true;
 const row=await getDb().select({cost:assistantUsage.costMicros}).from(assistantUsage).where(eq(assistantUsage.day,today())).then(r=>r[0]);
 return (row?.cost??0)>=cap*1e6;
}

type Delta={requests?:number;failed?:number;refused?:number;inputTokens?:number;cachedTokens?:number;outputTokens?:number;reasoningTokens?:number;costMicros?:number};
async function add(d:Delta){
 const v={requests:0,failed:0,refused:0,inputTokens:0,cachedTokens:0,outputTokens:0,reasoningTokens:0,costMicros:0,...d};
 const t=assistantUsage,inc=(col:AnyColumn,by:number)=>sql`${col} + ${by}`;
 await getDb().insert(t).values({day:today(),...v}).onConflictDoUpdate({target:t.day,set:{
  requests:inc(t.requests,v.requests),failed:inc(t.failed,v.failed),refused:inc(t.refused,v.refused),
  inputTokens:inc(t.inputTokens,v.inputTokens),cachedTokens:inc(t.cachedTokens,v.cachedTokens),
  outputTokens:inc(t.outputTokens,v.outputTokens),reasoningTokens:inc(t.reasoningTokens,v.reasoningTokens),
  costMicros:inc(t.costMicros,v.costMicros)}});
}

/** Record one billed OpenAI reply. Never throws: a logging failure must not lose the buyer's reply. */
export async function recordUsage(model:string,u:OpenAIUsage|undefined,failed:boolean){
 const usage=u??{};
 try{await add({requests:1,failed:failed?1:0,inputTokens:n(usage.prompt_tokens),cachedTokens:n(usage.prompt_tokens_details?.cached_tokens),
  outputTokens:n(usage.completion_tokens),reasoningTokens:n(usage.completion_tokens_details?.reasoning_tokens),costMicros:costMicros(model,usage)});}
 catch(error){console.error('assistant usage:',error instanceof Error?error.message:error);}
}
export async function recordRefused(){try{await add({refused:1});}catch{/* the refusal itself already happened */}}

/** Admin: the last `days` days (newest first) plus today's spend against the cap. */
export async function usageReport(days=30){
 const rows=await getDb().select().from(assistantUsage).orderBy(desc(assistantUsage.day)).limit(days);
 const day=today(),now=rows.find(r=>r.day===day);
 return {today:day,budgetUsd:dailyBudgetUsd(),model:env.OPENAI_MODEL||'gpt-5-mini',todayCostUsd:(now?.costMicros??0)/1e6,
  days:rows.map(r=>({...r,costUsd:r.costMicros/1e6}))};
}
