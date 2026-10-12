// Server-only: website accounts for buyers and sellers (Cloudflare D1, db/schema.ts).
// E-mail + password sign-in; sessions are random tokens in an HttpOnly cookie, stored hashed in D1 so signing out
// or disabling an account takes effect at once. Every request or offer is tied to the signed-in account.
import {eq,lt} from 'drizzle-orm';
import {getDb} from '@/db';
import {users,sessions,loginAttempts,submissions,type User} from '@/db/schema';
import {b64,hashPassword,verifyPassword,DUMMY_HASH} from './password';
import {brokerFields,egyptianMobile,InputError} from '../hubspot/sellerResponse';

const COOKIE='bm_user',SESSION_MS=30*24*60*60_000;
// 5 failures lock an e-mail; an IP gets 30, because mobile networks share one IP between many people.
const LOCK_MS=15*60_000,lockAfter=(key:string)=>key.startsWith('ip:')?30:5;
const text=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
const sha256=async(s:string)=>b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));

// What the browser may see about the signed-in account (never the hash or HubSpot IDs).
export type PublicUser={name:string;email:string;phone:string;broker:boolean;company:string};
export const publicUser=(u:User):PublicUser=>({name:u.name,email:u.email,phone:'0'+u.phone,broker:u.isBroker,company:u.company});

export function validEmail(v:unknown){
 const email=text(v,200).toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))throw new InputError('email');
 return email;
}
export function validPassword(v:unknown){
 const password=typeof v==='string'?v:'';
 if(password.length<8||password.length>200)throw new InputError('password');
 return password;
}
// Name, mobile and broker details: shared by sign-up and the "My account" profile form.
export function validProfile(input:Record<string,unknown>){
 const name=text(input.name,100),phone=egyptianMobile(text(input.phone,25));
 if(name.length<2)throw new InputError('name');
 if(!phone)throw new InputError('phone');
 const {broker,company}=brokerFields(input);
 return {name,phone,isBroker:broker,company};
}

// ---- sessions ----
const cookieFor=(token:string,secure:boolean)=>`${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS/1000}${secure?'; Secure':''}`;
export const clearCookie=`${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
const tokenOf=(request:Request)=>request.headers.get('cookie')?.split(/;\s*/).find(c=>c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1)||'';

async function startSession(userId:number,request:Request){
 const token=b64(crypto.getRandomValues(new Uint8Array(32))),now=Date.now(),db=getDb();
 await db.insert(sessions).values({tokenHash:await sha256(token),userId,expiresAt:now+SESSION_MS,createdAt:now});
 await db.update(users).set({lastLoginAt:now}).where(eq(users.id,userId));
 await db.delete(sessions).where(lt(sessions.expiresAt,now)); // housekeeping
 return cookieFor(token,new URL(request.url).protocol==='https:');
}

export async function currentUser(request:Request):Promise<User|null>{
 const token=tokenOf(request);if(!token)return null;
 const db=getDb();
 const row=await db.select({user:users,expiresAt:sessions.expiresAt}).from(sessions).innerJoin(users,eq(users.id,sessions.userId)).where(eq(sessions.tokenHash,await sha256(token))).get();
 if(!row||row.expiresAt<Date.now()||row.user.disabled)return null;
 return row.user;
}

export async function endSession(request:Request){
 const token=tokenOf(request);
 if(token)await getDb().delete(sessions).where(eq(sessions.tokenHash,await sha256(token)));
}
export async function endAllSessions(userId:number){await getDb().delete(sessions).where(eq(sessions.userId,userId));}

// ---- brute-force brake: failed sign-ins per e-mail and per IP in 15 minutes ----
async function locked(keys:string[]){
 const db=getDb(),now=Date.now();
 for(const key of keys){const a=await db.select().from(loginAttempts).where(eq(loginAttempts.key,key)).get();if(a&&a.count>=lockAfter(key)&&now-a.windowStart<LOCK_MS)return true;}
 return false;
}
async function noteFailure(keys:string[]){
 const db=getDb(),now=Date.now();
 for(const key of keys){
  const a=await db.select().from(loginAttempts).where(eq(loginAttempts.key,key)).get();
  if(!a)await db.insert(loginAttempts).values({key,count:1,windowStart:now});
  else await db.update(loginAttempts).set(now-a.windowStart>LOCK_MS?{count:1,windowStart:now}:{count:a.count+1}).where(eq(loginAttempts.key,key));
 }
}
const clientIp=(request:Request)=>request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'local';

export class AuthError extends Error{} // 'exists' | 'invalid' | 'locked' | 'disabled'

export async function signUp(input:Record<string,unknown>,request:Request){
 const email=validEmail(input.email),password=validPassword(input.password),profile=validProfile(input);
 const db=getDb();
 if(await db.select({id:users.id}).from(users).where(eq(users.email,email)).get())throw new AuthError('exists');
 const user=await db.insert(users).values({email,passwordHash:await hashPassword(password),...profile,createdAt:Date.now()}).returning().get();
 return {user,cookie:await startSession(user.id,request)};
}

export async function signIn(input:Record<string,unknown>,request:Request){
 const email=text(input.email,200).toLowerCase(),password=typeof input.password==='string'?input.password:'';
 const keys=[`ip:${clientIp(request)}`,`email:${email}`];
 if(await locked(keys))throw new AuthError('locked');
 const user=await getDb().select().from(users).where(eq(users.email,email)).get();
 const ok=await verifyPassword(password,user?.passwordHash??DUMMY_HASH);
 if(!user||!ok){await noteFailure(keys);throw new AuthError('invalid');}
 if(user.disabled)throw new AuthError('disabled');
 await getDb().delete(loginAttempts).where(eq(loginAttempts.key,keys[1]));
 return {user,cookie:await startSession(user.id,request)};
}

export async function updateProfile(user:User,input:Record<string,unknown>){
 return getDb().update(users).set(validProfile(input)).where(eq(users.id,user.id)).returning().get();
}

export async function changePassword(user:User,input:Record<string,unknown>,request:Request){
 if(!(await verifyPassword(typeof input.current==='string'?input.current:'',user.passwordHash)))throw new AuthError('invalid');
 await getDb().update(users).set({passwordHash:await hashPassword(validPassword(input.password))}).where(eq(users.id,user.id));
 await endAllSessions(user.id); // signs out other devices
 return startSession(user.id,request);
}

// ---- submissions ----
export type SubmissionKind='buyer_request'|'offer'|'keep_looking';
export async function recordSubmission(user:User,s:{kind:SubmissionKind;ref:string;contactId?:string|null;dealId?:string|null;summary:Record<string,unknown>}){
 const db=getDb();
 await db.insert(submissions).values({userId:user.id,kind:s.kind,ref:s.ref,hubspotContactId:s.contactId??null,hubspotDealId:s.dealId??null,summaryJson:JSON.stringify(s.summary),createdAt:Date.now()});
 // The account's own HubSpot contact: the buyer contact of their request, or the seller contact of their offer.
 if(s.contactId&&user.hubspotContactId!==s.contactId)await db.update(users).set({hubspotContactId:s.contactId}).where(eq(users.id,user.id));
}

// ---- route wrapper ----
const noStore={'cache-control':'no-store'};
export const sameOrigin=(request:Request)=>{const origin=request.headers.get('origin');return !origin||new URL(origin).host===new URL(request.url).host;};
// Wraps a signed-in user's API handler: cross-site writes rejected, 401 without a session, never cached.
export function userRoute<A extends unknown[]>(handler:(request:Request,user:User,...rest:A)=>Promise<Response>){
 return async(request:Request,...rest:A)=>{
  if(request.method!=='GET'&&!sameOrigin(request))return Response.json({status:'forbidden'},{status:403,headers:noStore});
  const user=await currentUser(request);
  if(!user)return Response.json({status:'signin'},{status:401,headers:noStore});
  try{const res=await handler(request,user,...rest);res.headers.set('cache-control','no-store');return res;}
  catch(error){
   if(error instanceof InputError)return Response.json({status:'invalid',field:error.message},{status:400,headers:noStore});
   if(error instanceof AuthError)return Response.json({status:error.message},{status:error.message==='locked'?429:400,headers:noStore});
   console.error('account:',error instanceof Error?error.message:error);return Response.json({status:'error'},{status:502,headers:noStore});
  }
 };
}
