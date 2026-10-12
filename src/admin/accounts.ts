// Server-only: data and actions for the admin "Accounts" section — every buyer/seller website account with all the
// requests and offers it sent, and links from Buyers/Sellers rows back to the account.
import {count,eq,isNotNull} from 'drizzle-orm';
import {getDb} from '@/db';
import {users,submissions} from '@/db/schema';
import {hashPassword,temporaryPassword} from '../auth/password';
import {endAllSessions} from '../auth/accounts';
import {submissionsOf,track} from '../auth/tracking';
import {contactUrl} from './buyers';
import {dealUrl} from '../hubspot/offers';

export class AccountError extends Error{}

export async function listAccounts(){
 const db=getDb();
 const [all,perKind]=await Promise.all([
  db.select().from(users).all(),
  db.select({userId:submissions.userId,kind:submissions.kind,n:count()}).from(submissions).groupBy(submissions.userId,submissions.kind).all()]);
 const counts=new Map<number,{requests:number;offers:number}>();
 for(const r of perKind){const c=counts.get(r.userId)??{requests:0,offers:0};if(r.kind==='buyer_request')c.requests+=r.n;else c.offers+=r.n;counts.set(r.userId,c);}
 return all.sort((a,b)=>b.createdAt-a.createdAt).map(u=>({id:u.id,name:u.name,email:u.email,phone:'0'+u.phone,broker:u.isBroker,company:u.company,disabled:u.disabled,
  createdAt:u.createdAt,lastLoginAt:u.lastLoginAt,hubspotUrl:u.hubspotContactId?contactUrl(u.hubspotContactId):'',...(counts.get(u.id)??{requests:0,offers:0})}));
}

export async function accountDetail(id:number){
 const user=await getDb().select().from(users).where(eq(users.id,id)).get();
 if(!user)throw new AccountError('not-found');
 const items=(await track(await submissionsOf([id]))).map(s=>({...s,contactUrl:s.contactId?contactUrl(s.contactId):'',dealUrl:s.dealId?dealUrl(s.dealId):''}));
 return {id:user.id,items};
}

// A one-time temporary password for the team to give the user; every session of the account is signed out.
export async function resetPassword(id:number){
 const password=temporaryPassword();
 const r=await getDb().update(users).set({passwordHash:await hashPassword(password)}).where(eq(users.id,id)).returning({id:users.id}).get();
 if(!r)throw new AccountError('not-found');
 await endAllSessions(id);
 return password;
}

export async function setDisabled(id:number,disabled:boolean){
 const r=await getDb().update(users).set({disabled}).where(eq(users.id,id)).returning({id:users.id}).get();
 if(!r)throw new AccountError('not-found');
 if(disabled)await endAllSessions(id);
}

// HubSpot contact ID → website account, for the "Account" link on Buyers and Sellers rows.
export async function accountsByContact(){
 const out=new Map<string,{id:number;email:string}>();
 try{
  const db=getDb();
  const [fromUsers,fromSubs]=await Promise.all([
   db.select({contact:users.hubspotContactId,id:users.id,email:users.email}).from(users).where(isNotNull(users.hubspotContactId)).all(),
   db.select({contact:submissions.hubspotContactId,id:users.id,email:users.email}).from(submissions).innerJoin(users,eq(users.id,submissions.userId)).where(isNotNull(submissions.hubspotContactId)).all()]);
  for(const r of [...fromSubs,...fromUsers])if(r.contact)out.set(r.contact,{id:r.id,email:r.email});
 }catch(error){console.error('accounts lookup:',error instanceof Error?error.message:error);} // no database: rows simply have no link
 return out;
}
