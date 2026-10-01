// Server-only: team login for /admin. One shared password (ADMIN_PASSWORD) for now; each session also
// carries the reviewer's name so approvals are attributed. Sessions are HMAC-signed, HttpOnly cookies.
// Production plan: put Cloudflare Access in front of /admin as well (see HANDOFF.md).
import {env} from 'cloudflare:workers';

const COOKIE='bm_admin',SESSION_MS=12*60*60_000;
const enc=new TextEncoder();
const b64=(buf:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

async function key(){
 const secret=env.ADMIN_SESSION_SECRET||`${env.ADMIN_PASSWORD}:${env.HUBSPOT_ACCESS_TOKEN}`; // rotating either logs everyone out
 return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(secret)),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function sign(payload:string){return b64(await crypto.subtle.sign('HMAC',await key(),enc.encode(payload)));}
async function equal(a:string,b:string){ // constant-time comparison via HMAC of both values
 const k=await key();const [x,y]=await Promise.all([crypto.subtle.sign('HMAC',k,enc.encode(a)),crypto.subtle.sign('HMAC',k,enc.encode(b))]);
 const u=new Uint8Array(x),v=new Uint8Array(y);let diff=0;for(let i=0;i<u.length;i++)diff|=u[i]^v[i];return diff===0;
}

export const adminConfigured=()=>!!env.ADMIN_PASSWORD&&env.ADMIN_PASSWORD.length>=12;

const attempts=new Map<string,{count:number;since:number}>(); // simple brute-force brake per client IP
export function tooManyAttempts(ip:string){const a=attempts.get(ip);return !!a&&a.count>=5&&Date.now()-a.since<15*60_000;}
function noteFailure(ip:string){const a=attempts.get(ip);if(!a||Date.now()-a.since>15*60_000)attempts.set(ip,{count:1,since:Date.now()});else a.count++;}

export async function login(password:string,name:string,ip:string,secure:boolean){
 if(!adminConfigured()||!(await equal(password,env.ADMIN_PASSWORD!))){noteFailure(ip);return null;}
 attempts.delete(ip);
 const payload=b64(enc.encode(JSON.stringify({name:name.trim().slice(0,60),exp:Date.now()+SESSION_MS})));
 return `${COOKIE}=${payload}.${await sign(payload)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS/1000}${secure?'; Secure':''}`;
}
export const logoutCookie=`${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

export async function session(request:Request):Promise<{name:string}|null>{
 if(!adminConfigured())return null;
 const raw=request.headers.get('cookie')?.split(/;\s*/).find(c=>c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
 const [payload,sig]=raw?.split('.')??[];
 if(!payload||!sig||!(await equal(sig,await sign(payload))))return null;
 try{const data=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/'))) as {name:string;exp:number};return data.exp>Date.now()?{name:data.name||'Team'}:null;}
 catch{return null;}
}

// Wraps an admin API handler: 401 without a valid session; cross-site POSTs rejected.
export function adminRoute<A extends unknown[]>(handler:(request:Request,user:{name:string},...rest:A)=>Promise<Response>){
 return async(request:Request,...rest:A)=>{
  if(request.method!=='GET'){const origin=request.headers.get('origin');if(origin&&new URL(origin).host!==new URL(request.url).host)return Response.json({error:'forbidden'},{status:403});}
  const user=await session(request);
  if(!user)return Response.json({error:'unauthorized'},{status:401,headers:{'cache-control':'no-store'}});
  try{const res=await handler(request,user,...rest);res.headers.set('cache-control','no-store');return res;}
  catch(error){console.error('admin:',error instanceof Error?error.message:error);return Response.json({error:'server'},{status:502,headers:{'cache-control':'no-store'}});}
 };
}
