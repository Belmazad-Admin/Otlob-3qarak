'use client';
// "My account" (/account): the buyer/seller's details, password, and every request and offer they sent with its status.
import {useCallback,useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,Globe2,LogOut,UserRound,LockKeyhole,FileText,Handshake} from 'lucide-react';
import {content,label,type Lang} from '../content';
import BrandLogo,{brandName} from '../BrandLogo';
import ThemeToggle from '../ThemeToggle';
import PropertyIcon from '../PropertyIcon';
import AuthDialog,{authMessage} from './AuthDialog';
import {useAccount,type AccountUser} from './useAccount';

type Item={id:number;kind:'buyer_request'|'offer'|'keep_looking';ref:string;createdAt:number;summary:Record<string,unknown>;status:string};
type Data={user:AccountUser;joinedAt:number;items:Item[]};

export default function AccountApp(){
 const [lang,setLang]=useState<Lang>('ar');const t=content[lang];const l=(k:string)=>label(k,lang);
 const account=useAccount();const me=account.user;
 const [data,setData]=useState<Data|null>(null),[loadError,setLoadError]=useState(false);
 useEffect(()=>{document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.documentElement.lang=lang;document.title=`${t.myAccount} | belmazad.com`;},[lang,t.myAccount]);
 const {setUser}=account;
 const load=useCallback(()=>{fetch('/api/account',{cache:'no-store'}).then(async r=>{if(r.status===401){setUser(null);setData(null);return;}if(!r.ok)throw new Error();setData(await r.json() as Data);setLoadError(false);}).catch(()=>setLoadError(true));},[setUser]);
 useEffect(()=>{if(me)load();},[me,load]);
 const [showAuth,setShowAuth]=useState(true);
 const Arrow=lang==='ar'?ArrowRight:ArrowLeft;
 const num=(n:number)=>new Intl.NumberFormat(lang==='ar'?'ar-EG':'en-EG').format(n);
 const million=(n:number)=>`${num(Math.round(n/1e5)/10)} ${t.million}`;
 const date=(ms:number)=>new Intl.DateTimeFormat(lang==='ar'?'ar-EG':'en-GB',{day:'numeric',month:'short',year:'numeric'}).format(ms);
 const statusText=(i:Item)=>(t as Record<string,unknown>)[`${i.kind==='buyer_request'?'st':'os'}_${i.status}`] as string|undefined??t.st_unknown;
 const requests=data?.items.filter(i=>i.kind==='buyer_request')??[],offers=data?.items.filter(i=>i.kind!=='buyer_request')??[];

 const header=<header className="account-top shell"><a href="/request-property" className="logo" aria-label={brandName(lang)}><BrandLogo lang={lang}/></a>
  <span className="account-top-actions"><ThemeToggle label={t.themeLabel}/><button className="language" onClick={()=>setLang(lang==='ar'?'en':'ar')}><Globe2 size={16}/>{lang==='ar'?'EN':'العربية'}</button>
  {me&&<button className="text-button" onClick={()=>account.signOut()}><LogOut size={16}/>{t.signOut}</button>}</span></header>;

 if(me===undefined)return <>{header}<main className="account shell"><p role="status">{t.feedLoading}</p></main></>;
 if(me===null)return <>{header}<main className="account shell"><div className="account-card account-signed-out"><UserRound size={30}/><h1>{t.myAccount}</h1><p>{t.accountSignedOut}</p><button className="button primary" onClick={()=>setShowAuth(true)}>{t.signIn}</button><a href="/request-property" className="text-button"><Arrow size={16}/>{t.backToSite}</a></div></main>
  <AuthDialog open={showAuth} lang={lang} reason="account" onClose={()=>setShowAuth(false)} onDone={u=>account.setUser(u)}/></>;

 return <>{header}<main className="account shell">
  <a href="/request-property" className="text-button account-back"><Arrow size={16}/>{t.backToSite}</a>
  <h1>{t.myAccount}</h1>
  {data&&<p className="account-sub">{me.name} · {t.joined} {date(data.joinedAt)}</p>}
  {loadError&&<p className="error" role="alert">{t.accountLoadError} <button className="text-button" onClick={load}>{t.retry}</button></p>}
  <div className="account-grid">
   <section className="account-card" aria-labelledby="my-requests"><h2 id="my-requests"><FileText size={18}/>{t.myRequests}</h2>
    {!data?<p role="status">{t.feedLoading}</p>:!requests.length?<p className="account-empty">{t.noRequests} <a className="text-button" href="/request-property#request">{t.cta}</a></p>:
    <ul className="account-items">{requests.map(i=>{const s=i.summary as {type?:string;locations?:string[];sizeMin?:number;sizeMax?:number;budgetMin?:number;budgetMax?:number};
     return <li key={i.id}><PropertyIcon type={s.type??'other'} size={36}/><div><strong>{l(s.type??'other')} <span>{(s.locations??[]).map(l).join(lang==='ar'?'، ':', ')}</span></strong>
      <small>{s.sizeMin?`${num(s.sizeMin)}–${num(s.sizeMax??s.sizeMin)} ${t.sqm}`:''}{s.budgetMax?` · ${million(s.budgetMin??0)} – ${million(s.budgetMax)}`:''}</small>
      <small><bdi>{i.ref}</bdi> · {t.sentOn} {date(i.createdAt)}</small></div><span className={`account-status s-${i.status}`}>{statusText(i)}</span></li>;})}</ul>}
   </section>
   <section className="account-card" aria-labelledby="my-offers"><h2 id="my-offers"><Handshake size={18}/>{t.myOffers}</h2>
    {!data?<p role="status">{t.feedLoading}</p>:!offers.length?<p className="account-empty">{t.noOffers}</p>:
    <ul className="account-items">{offers.map(i=>{const s=i.summary as {requestId?:string;type?:string;location?:string;size?:number;price?:number};
     return <li key={i.id}><PropertyIcon type={s.type??'other'} size={36}/><div><strong>{i.kind==='offer'?<>{t.offerOn} <bdi>{s.requestId}</bdi></>:<>{t.keepTitle} <span>{l(s.type??'other')} · {l(s.location??'')}</span></>}</strong>
      <small>{s.size?`${num(s.size)} ${t.sqm}`:''}{s.price?` · ${million(s.price)}`:''}</small><small>{t.sentOn} {date(i.createdAt)}</small></div><span className={`account-status s-${i.status}`}>{statusText(i)}</span></li>;})}</ul>}
   </section>
   <Profile key={JSON.stringify(me)} me={me} lang={lang} onSaved={u=>account.setUser(u)}/>
   <Password lang={lang}/>
  </div></main></>;
}

function Profile({me,lang,onSaved}:{me:AccountUser;lang:Lang;onSaved:(u:AccountUser)=>void}){
 const t=content[lang];const [broker,setBroker]=useState(me.broker),[busy,setBusy]=useState(false),[msg,setMsg]=useState<{ok:boolean;text:string}|null>(null);
 async function save(form:HTMLFormElement){
  const f=new FormData(form),v=(k:string)=>String(f.get(k)??'');setBusy(true);setMsg(null);
  try{const res=await fetch('/api/account',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:v('name'),phone:v('phone'),broker,company:broker?v('company'):''})});
   const data=await res.json().catch(()=>({})) as {status?:string;field?:string;user?:AccountUser};
   if(res.ok&&data.user){onSaved(data.user);setMsg({ok:true,text:t.saved});}else setMsg({ok:false,text:authMessage(t,data)});}
  catch{setMsg({ok:false,text:t.authError});}finally{setBusy(false);}
 }
 return <section className="account-card" aria-labelledby="my-profile"><h2 id="my-profile"><UserRound size={18}/>{t.profileTitle}</h2>
  <form onSubmit={e=>{e.preventDefault();save(e.currentTarget);}}>
   <label className="field"><span>{t.email}</span><input value={me.email} dir="ltr" readOnly disabled/></label>
   <label className="field"><span>{t.name}</span><input name="name" defaultValue={me.name} autoComplete="name" required minLength={2} maxLength={100}/></label>
   <label className="field"><span>{t.phone}</span><input name="phone" defaultValue={me.phone} type="tel" dir="ltr" autoComplete="tel" required pattern="(\+?20|0)?1[0125][0-9]{8}"/></label>
   <label className="check-option consent"><input type="checkbox" checked={broker} onChange={e=>setBroker(e.target.checked)}/>{t.brokerQuestion}</label>
   {broker&&<label className="field"><span>{t.brokerCompany}</span><input name="company" defaultValue={me.company} required minLength={2} maxLength={100} autoComplete="organization"/></label>}
   {msg&&<p className={msg.ok?'account-ok':'error'} role={msg.ok?'status':'alert'}>{msg.text}</p>}
   <button className="button primary" type="submit" disabled={busy}>{busy?t.authBusy:t.saveProfile}</button>
  </form></section>;
}

function Password({lang}:{lang:Lang}){
 const t=content[lang];const [busy,setBusy]=useState(false),[msg,setMsg]=useState<{ok:boolean;text:string}|null>(null);
 async function change(form:HTMLFormElement){
  const f=new FormData(form);setBusy(true);setMsg(null);
  try{const res=await fetch('/api/account/password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({current:f.get('current'),password:f.get('password')})});
   const data=await res.json().catch(()=>({})) as {status?:string;field?:string};
   if(res.ok){form.reset();setMsg({ok:true,text:t.passwordChanged});}else setMsg({ok:false,text:data.status==='invalid'&&!data.field?t.wrongCurrent:authMessage(t,data)});}
  catch{setMsg({ok:false,text:t.authError});}finally{setBusy(false);}
 }
 return <section className="account-card" aria-labelledby="my-password"><h2 id="my-password"><LockKeyhole size={18}/>{t.passwordTitle}</h2>
  <form onSubmit={e=>{e.preventDefault();change(e.currentTarget);}}>
   <label className="field"><span>{t.currentPassword}</span><input name="current" type="password" dir="ltr" autoComplete="current-password" required/></label>
   <label className="field"><span>{t.newPassword}</span><input name="password" type="password" dir="ltr" autoComplete="new-password" required minLength={8} maxLength={200}/><small className="field-hint">{t.passwordHint}</small></label>
   {msg&&<p className={msg.ok?'account-ok':'error'} role={msg.ok?'status':'alert'}>{msg.text}</p>}
   <button className="button outline" type="submit" disabled={busy}>{busy?t.authBusy:t.changePassword}</button>
  </form></section>;
}
