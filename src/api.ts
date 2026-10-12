import type {PropertyRequest} from './data';
// The session ended (or never started): the caller opens the sign-in window and retries.
export class SignInRequired extends Error{}
// Buyer wizard submission (signed-in account required; name, mobile and broker details come from the account).
// With HubSpot connected, the request becomes a HubSpot contact (Pending) plus a review task, and is public only after
// the team approves it in /admin. Without HubSpot (demo mode) nothing is sent.
export async function submitRequest(request:PropertyRequest):Promise<{reference:string;demo:boolean;duplicate?:boolean}>{
 const res=await fetch('/api/buyer-request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)});
 if(res.status===401)throw new SignInRequired();
 const data=await res.json().catch(()=>({})) as {status?:string;reference?:string};
 if(data.status==='unconfigured')return {reference:`BM-DEMO-${Date.now().toString().slice(-6)}`,demo:true};
 if(!res.ok||!data.reference)throw new Error(data.status||'error');
 return {reference:data.reference,demo:false,duplicate:data.status==='duplicate'};
}
