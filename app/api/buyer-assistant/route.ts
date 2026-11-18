import {sameOrigin} from '@/src/auth/accounts';
import {AssistantInputError,askAssistant,assistantConfigured,overLimit,validateChat} from '@/src/assistant/buyerAssistant';

// Buyer chat assistant. GET: is it available? POST {messages:[{role,text}],lang}: reply + understood wizard fields.
// Open to visitors (sign-in is only needed to publish); limited per IP. Message text is never logged.
const noStore={'cache-control':'no-store'};
export function GET(){return Response.json({enabled:assistantConfigured()},{headers:noStore});}
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({status:'forbidden'},{status:403,headers:noStore});
 if(!assistantConfigured())return Response.json({status:'unconfigured'},{status:503,headers:noStore});
 let chat;
 try{chat=validateChat(await request.json() as Record<string,unknown>);}
 catch(error){return Response.json({status:'invalid',field:error instanceof AssistantInputError?error.message:'body'},{status:400,headers:noStore});}
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'local';
 try{if(await overLimit(ip))return Response.json({status:'limit'},{status:429,headers:noStore});}
 catch(error){console.error('assistant limit:',error instanceof Error?error.message:error);}
 try{return Response.json({status:'ok',...await askAssistant(chat.turns,chat.lang)},{headers:noStore});}
 catch(error){console.error('assistant:',error instanceof Error?error.message:error);return Response.json({status:'error'},{status:502,headers:noStore});}
}
