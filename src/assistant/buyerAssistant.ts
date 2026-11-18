// Server-only: the buyer chat assistant ("إيه العقار اللي في بالك؟" panel). The model reads what the buyer writes in
// Egyptian Arabic or English and returns a short reply plus the wizard fields it understood (structured output);
// the browser fills the 7-step request form with them. It never collects names, phones or e-mails (the account does).
import {env} from 'cloudflare:workers';
import {eq} from 'drizzle-orm';
import {getDb} from '@/db';
import {loginAttempts} from '@/db/schema';
import {label} from '../content';
import {areas,features,propertyTypes,residential} from '../data';

// Model is overridable with the OPENAI_MODEL setting; the default is a small, cheap model that suits form-filling chat.
export const DEFAULT_MODEL='gpt-5-mini';
const MAX_TURNS=20,MAX_CHARS=600,PER_IP_PER_HOUR=60;
export const assistantConfigured=()=>!!env.OPENAI_API_KEY;
export class AssistantInputError extends Error{}

export type ChatTurn={role:'user'|'assistant';text:string};
export type AssistantFields={type:string|null;locations:string[];budgetMin:number|null;budgetMax:number|null;sizeMin:number|null;sizeMax:number|null;bedrooms:number|null;bathrooms:number|null;features:string[];notes:string|null};
export type AssistantReply={reply:string;fields:AssistantFields;ready:boolean};

const options=(keys:string[])=>keys.map(k=>`${k} = ${label(k,'ar')} / ${label(k,'en')}`).join('\n');
// Stable system prompt (cached): the allowed values come from src/data.ts so the form and the assistant always agree.
const SYSTEM=`You are the request assistant on belmazad.com, an Egyptian real-estate site where BUYERS post what they want to buy and owners and brokers answer. You help one buyer describe the property they want, in a short friendly chat, and you fill in their request form.

Language: reply in the buyer's language. If they write Arabic (any dialect), reply in simple Egyptian Arabic; if English, reply in English. Keep every reply to one to three short sentences. Ask at most one question per reply.

What to collect, in this order of importance: property type, areas, budget (EGP), area size (m²). Then, only if natural: bedrooms and bathrooms (apartments, villas and chalets only), must-haves, other wishes. When type, at least one area, a budget and a size are known, set ready=true and tell the buyer to check the form and publish. Do not keep asking once ready.

Rules:
- Buying only. If they want to rent or to sell, say kindly that this form is for buyers looking to buy (sellers can use the "بتبيع / Selling" tab), and continue only with a purchase.
- Never ask for or repeat a name, phone number, e-mail or address; the buyer's account already has their contact details. If they share contact details, do not put them anywhere.
- Use only these values. If the buyer names an area that is not in the list, choose the closest listed area only if it is clearly the same place; otherwise leave it out and mention it in notes.
- Money is in Egyptian pounds as whole numbers: "8 مليون" = 8000000, "مليون ونص" = 1500000, "500 ألف" = 500000. A single budget like "حوالي 8 مليون" means budgetMin 7000000 and budgetMax 9000000 (about ±12%). "لحد 10 مليون" means budgetMax 10000000 and budgetMin about 60% of it. Same idea for size in m²; one feddan = 4200 m².
- Return the COMPLETE form as you now understand it from the whole conversation (not only the latest message). Keep earlier answers unless the buyer changes them. Use null or [] for anything unknown.
- notes: one short sentence in the buyer's language with wishes that do not fit the other fields (view, floor, finishing details, timing). No contact details. null if none.

Property types (type):
${options(propertyTypes)}

Areas (locations):
${options(areas)}

Must-haves (features):
${options(features)}`;

const nullable=(schema:object)=>({anyOf:[schema,{type:'null'}]});
const SCHEMA={type:'object',additionalProperties:false,required:['reply','fields','ready'],properties:{
 reply:{type:'string',description:'Your short message to the buyer.'},
 ready:{type:'boolean',description:'True when type, at least one area, budget and size are known.'},
 fields:{type:'object',additionalProperties:false,required:['type','locations','budgetMin','budgetMax','sizeMin','sizeMax','bedrooms','bathrooms','features','notes'],properties:{
  type:nullable({type:'string',enum:propertyTypes}),
  locations:{type:'array',items:{type:'string',enum:areas}},
  budgetMin:nullable({type:'integer'}),budgetMax:nullable({type:'integer'}),
  sizeMin:nullable({type:'integer'}),sizeMax:nullable({type:'integer'}),
  bedrooms:nullable({type:'integer'}),bathrooms:nullable({type:'integer'}),
  features:{type:'array',items:{type:'string',enum:features}},
  notes:nullable({type:'string'})}}}};

const text=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
export function validateChat(input:Record<string,unknown>):{turns:ChatTurn[];lang:'ar'|'en'}{
 const raw=Array.isArray(input.messages)?input.messages:[];
 const turns=raw.map(m=>m as Record<string,unknown>).map(m=>({role:m.role==='assistant'?'assistant' as const:'user' as const,text:text(m.text,MAX_CHARS)})).filter(m=>m.text);
 if(!turns.length||turns[turns.length-1].role!=='user')throw new AssistantInputError('messages');
 if(turns.length>MAX_TURNS)throw new AssistantInputError('too-long');
 return {turns,lang:input.lang==='en'?'en':'ar'};
}

// Brake on cost: N requests per IP per hour, shared by all Worker instances (same D1 table as the sign-in brake).
export async function overLimit(ip:string){
 const db=getDb(),key=`chat:${ip}`,now=Date.now();
 const a=await db.select().from(loginAttempts).where(eq(loginAttempts.key,key)).get();
 if(!a||now-a.windowStart>60*60_000){await db.insert(loginAttempts).values({key,count:1,windowStart:now}).onConflictDoUpdate({target:loginAttempts.key,set:{count:1,windowStart:now}});return false;}
 if(a.count>=PER_IP_PER_HOUR)return true;
 await db.update(loginAttempts).set({count:a.count+1}).where(eq(loginAttempts.key,key));
 return false;
}

const int=(v:unknown,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<max?Math.round(v):null;
// Never trust model output blindly: keep only known values and sane numbers.
function clean(out:AssistantReply):AssistantReply{
 const f=out.fields??{} as AssistantFields;
 const type=typeof f.type==='string'&&propertyTypes.includes(f.type)?f.type:null;
 const rooms=type&&!residential.includes(type);
 let budgetMin=int(f.budgetMin,5e9),budgetMax=int(f.budgetMax,5e9),sizeMin=int(f.sizeMin,5e7),sizeMax=int(f.sizeMax,5e7);
 if(budgetMin&&budgetMax&&budgetMin>budgetMax)[budgetMin,budgetMax]=[budgetMax,budgetMin];
 if(sizeMin&&sizeMax&&sizeMin>sizeMax)[sizeMin,sizeMax]=[sizeMax,sizeMin];
 return {reply:text(out.reply,800),ready:out.ready===true,fields:{type,
  locations:[...new Set((f.locations??[]).filter(l=>areas.includes(l)))].slice(0,12),
  budgetMin,budgetMax,sizeMin,sizeMax,
  bedrooms:rooms?null:int(f.bedrooms,31),bathrooms:rooms?null:int(f.bathrooms,31),
  features:[...new Set((f.features??[]).filter(x=>features.includes(x)))].slice(0,20),
  notes:text(f.notes,700)||null}};
}

export async function askAssistant(turns:ChatTurn[],lang:'ar'|'en'):Promise<AssistantReply>{
 const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',
  headers:{'content-type':'application/json',authorization:`Bearer ${env.OPENAI_API_KEY}`},
  body:JSON.stringify({
   model:env.OPENAI_MODEL||DEFAULT_MODEL,max_completion_tokens:8000,reasoning_effort:'low',
   messages:[{role:'system',content:SYSTEM},...turns.map(t=>({role:t.role,content:t.text}))],
   response_format:{type:'json_schema',json_schema:{name:'buyer_assistant_reply',strict:true,schema:SCHEMA}}})});
 if(!res.ok)throw new Error(`assistant: OpenAI HTTP ${res.status}`);
 const data=await res.json() as {choices?:{finish_reason?:string;message?:{content?:string|null;refusal?:string|null}}[]};
 const choice=data.choices?.[0];
 if(!choice?.message?.content||choice.message.refusal||choice.finish_reason==='length'||choice.finish_reason==='content_filter')throw new Error(`assistant stopped: ${choice?.finish_reason??'no choice'}`);
 const out=clean(JSON.parse(choice.message.content) as AssistantReply);
 if(!out.reply)out.reply=lang==='ar'?'تمام، كمّل لي.':'Got it, tell me more.';
 return out;
}
