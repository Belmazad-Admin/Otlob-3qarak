'use client';
// Sign in / create account window. Opens before a seller sends an offer (or "keep looking"), before a buyer's request
// is published, and from the header. On success it hands the account back so the waiting action can continue.
import {useState} from 'react';
import {X,LockKeyhole} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {content,type Lang} from '../content';
import type {AccountUser} from './useAccount';

export type AuthReason='offer'|'request'|'account';
type T=typeof content.ar;
const FIELD_ERRORS:Record<string,keyof T>={email:'emailError',password:'passwordError',name:'nameError',phone:'mobileError',company:'companyError'};
const STATUS_ERRORS:Record<string,keyof T>={exists:'authExists',invalid:'authInvalid',locked:'authLocked',disabled:'authDisabled'};
// Maps an /api/auth/* or /api/account* error response to its message.
export const authMessage=(t:T,data:{status?:string;field?:string})=>t[(data.field&&FIELD_ERRORS[data.field])||(data.status&&STATUS_ERRORS[data.status])||'authError'] as string;

export default function AuthDialog({open,lang,reason,onClose,onDone}:{open:boolean;lang:Lang;reason:AuthReason;onClose:()=>void;onDone:(user:AccountUser)=>void}){
 const t=content[lang];
 const [mode,setMode]=useState<'in'|'up'>('up'),[broker,setBroker]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const close=()=>{setError('');setBusy(false);onClose();};
 const switchMode=(m:'in'|'up')=>{setMode(m);setError('');};
 async function submit(form:HTMLFormElement){
  const f=new FormData(form),v=(k:string)=>String(f.get(k)??'');
  const body=mode==='in'?{email:v('email'),password:v('password')}:{name:v('name'),email:v('email'),phone:v('phone'),password:v('password'),broker,company:broker?v('company'):''};
  setBusy(true);setError('');
  try{
   const res=await fetch(mode==='in'?'/api/auth/login':'/api/auth/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   const data=await res.json().catch(()=>({})) as {status?:string;field?:string;user?:AccountUser};
   if(res.ok&&data.user){setError('');onDone(data.user);return;}
   setError(authMessage(t,data));
  }catch{setError(t.authError);}
  finally{setBusy(false);}
 }
 const why=reason==='offer'?t.authWhyOffer:reason==='request'?t.authWhyRequest:t.authWhy;
 return <Dialog open={open} onOpenChange={o=>{if(!o)close();}}><DialogContent className="request-dialog auth-dialog" dir={lang==='ar'?'rtl':'ltr'} showCloseButton={false}>
  <button className="dialog-close" aria-label={t.close} onClick={close}><X/></button>
  <DialogTitle>{mode==='in'?t.authTitleIn:t.authTitleUp}</DialogTitle><DialogDescription>{why}</DialogDescription>
  <div className="auth-tabs" role="group" aria-label={t.myAccount}>{(['up','in'] as const).map(m=><button type="button" key={m} aria-pressed={mode===m} className={mode===m?'selected':''} onClick={()=>switchMode(m)}>{m==='in'?t.signIn:t.signUp}</button>)}</div>
  <form key={mode} onSubmit={e=>{e.preventDefault();submit(e.currentTarget);}}>
   {mode==='up'&&<label className="field"><span>{t.name}</span><input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label>}
   <label className="field"><span>{t.email}</span><input name="email" type="email" dir="ltr" autoComplete="email" required maxLength={200}/></label>
   {mode==='up'&&<label className="field"><span>{t.phone}</span><input name="phone" type="tel" dir="ltr" autoComplete="tel" placeholder="010 0000 0000" required pattern="(\+?20|0)?1[0125][0-9]{8}"/></label>}
   <label className="field"><span>{t.password}</span><input name="password" type="password" dir="ltr" autoComplete={mode==='in'?'current-password':'new-password'} required minLength={mode==='up'?8:1} maxLength={200}/>{mode==='up'&&<small className="field-hint">{t.passwordHint}</small>}</label>
   {mode==='up'&&<><label className="check-option consent"><input type="checkbox" checked={broker} onChange={e=>setBroker(e.target.checked)}/>{t.brokerQuestion}</label>
    {broker&&<label className="field"><span>{t.brokerCompany}</span><input name="company" required minLength={2} maxLength={100} autoComplete="organization"/></label>}</>}
   {error&&<p className="error" role="alert">{error}</p>}
   <button className="button primary full" type="submit" disabled={busy}>{busy?t.authBusy:mode==='in'?t.signIn:t.signUp}</button>
   <p className="auth-switch">{mode==='in'?t.noAccount:t.haveAccount} <button type="button" className="text-button" onClick={()=>switchMode(mode==='in'?'up':'in')}>{mode==='in'?t.signUp:t.signIn}</button></p>
   {mode==='in'&&<p className="micro-note auth-forgot">{t.forgotNote}</p>}
   <p className="form-privacy"><LockKeyhole size={16}/>{t.sellContactLive}</p>
  </form>
 </DialogContent></Dialog>;
}
