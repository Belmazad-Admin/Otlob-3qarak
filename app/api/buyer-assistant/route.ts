import {sameOrigin} from '@/src/auth/accounts';
import {AssistantInputError,askAssistant,assistantConfigured,overLimit,validateChat} from '@/src/assistant/buyerAssistant';
import {overBudget,recordRefused} from '@/src/assistant/usage';

// Buyer chat assistant. GET: is it available? POST {messages:[{role,text}],lang}: reply + understood wizard fields.
// Open to visitors (sign-in is only needed to publish); limited per IP and by a hard daily spend cap.
// Message text is never logged; only token totals per day are stored (src/assistant/usage.ts).
const noStore={'cache-control':'no-store'};
export function GET(){return Response.json({enabled:assistantConfigured()},{headers:noStore});}
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({status:'forbidden'},{status:403,headers:noStore});
 if(!assistantConfigured())return Response.json({status:'unconfigured'},{status:503,headers:noStore});
 let chat;
 try{chat=validateChat(await request.json() as Record<string,unknown>);}
 catch(error){return Response.json({status:'invalid',field:error instanceof AssistantInputError?error.message:'body'},{status:400,headers:noStore});}
 // Spend cap first, and fail closed: if today's spend cannot be read, OpenAI is not called.
 let paused=true;
 try{paused=await overBudget();}catch(error){console.error('assistant budget:',error instanceof Error?error.message:error);}
 if(paused){await recordRefused();return Response.json({status:'paused'},{status:503,headers:noStore});}
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'local';
 try{if(await overLimit(ip))return Response.json({status:'limit'},{status:429,headers:noStore});}
 catch(error){console.error('assistant limit:',error instanceof Error?error.message:error);}
 try{return Response.json({status:'ok',...await askAssistant(chat.turns,chat.lang)},{headers:noStore});}
 catch(error){console.error('assistant:',error instanceof Error?error.message:error);return Response.json({status:'error'},{status:502,headers:noStore});}
}
