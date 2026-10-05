'use client';
// Team admin: Buyers (wishlist approvals) and Sellers (offers). All data comes from /api/admin/* (HubSpot-backed).
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Check,X,MessageSquare,ExternalLink,LogOut,RefreshCw,Search,MapPin,Phone,LockKeyhole,Eye,RotateCcw,Save,Send,Users,Home} from 'lucide-react';
import {label} from '../content';
import PropertyIcon from '../PropertyIcon';
import {propertyTypes,type Demand} from '../data';
import './admin.css';
import ThemeToggle from '../ThemeToggle';

type Status='pending'|'approved'|'changes_requested'|'rejected';
type Buyer={contactId:string;ref:string;hubspotUrl:string;name:string;phone:string;email:string;broker:{company:string}|null;fromWebsite:boolean;createdAt?:string|null;status:Status;warning:string|null;comment:string;reviewedBy:string;reviewedAt:string;
 original:{type:string;locations:string;budget:string;note:string;userType:string};publicPost:Demand;automatic:Demand;edited:boolean};
type Stage={id:string;label:string;closed:boolean};
type Offer={id:string;hubspotUrl:string;kind:'offer'|'keep_looking';createdAt?:string|null;stageId?:string|null;stage?:string|null;seller:{id:string;url:string;name:string;phone:string};buyer:{id:string;url:string;name:string}|null;
 request:{ref:string;summary:string}|null;property:string;area:number;price:number;details:string;notes:string;brokerCompany:string};
const BrokerBadge=({company}:{company:string})=><span className="badge broker">Broker{company?` · ${company}`:''}</span>;
type Fields={type:string;locations:string[];sizeMin:number|null;sizeMax:number|null;budgetMin:number|null;budgetMax:number|null;features:string[]};

const STATUS:Record<Status,string>={pending:'Pending',approved:'Approved',changes_requested:'Changes requested',rejected:'Rejected'};
const en=(k:string)=>label(k,'en');
const date=(iso?:string|null)=>iso?new Date(iso).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const egp=(n:number)=>n?`${(n/1e6).toLocaleString('en-US',{maximumFractionDigits:2})}M EGP`:'—';
const fieldsOf=(d:Demand):Fields=>({type:d.type,locations:d.locations,sizeMin:d.sizeMin||null,sizeMax:d.sizeMax||null,budgetMin:d.approx||d.min?d.min||null:null,budgetMax:d.max||null,features:d.features});
async function api<T>(url:string,init?:RequestInit):Promise<T>{
 const res=await fetch(url,{...init,headers:{'content-type':'application/json',...init?.headers},cache:'no-store'});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Object.assign(new Error((data as {error?:string}).error||String(res.status)),{status:res.status});
 return data as T;
}

export default function AdminApp(){
 const [me,setMe]=useState<{configured:boolean;user:{name:string}|null}|null>(null);
 const [tab,setTab]=useState<'buyers'|'sellers'>('buyers');
 const check=useCallback(()=>{api<{configured:boolean;user:{name:string}|null}>('/api/admin/session').then(setMe).catch(()=>setMe({configured:false,user:null}));},[]);
 useEffect(()=>{check();document.documentElement.dir='ltr';document.documentElement.lang='en';},[check]);
 if(!me)return <div className="adm-center">Loading…</div>;
 if(!me.user)return <Login configured={me.configured} onDone={check}/>;
 return <div className="adm">
  <header className="adm-top"><span className="adm-brand" dir="ltr">belmazad<b>.com</b> <small>team admin</small></span>
   <nav className="adm-tabs" aria-label="Sections"><button aria-pressed={tab==='buyers'} className={tab==='buyers'?'on':''} onClick={()=>setTab('buyers')}><Users size={16}/>Buyers</button><button aria-pressed={tab==='sellers'} className={tab==='sellers'?'on':''} onClick={()=>setTab('sellers')}><Home size={16}/>Sellers</button></nav>
   <ThemeToggle label="Switch light and dark mode"/><span className="adm-user"><LockKeyhole size={14}/>{me.user.name}<button className="adm-link" onClick={()=>api('/api/admin/session',{method:'DELETE'}).then(check)}><LogOut size={15}/>Log out</button></span></header>
  {tab==='buyers'?<Buyers onAuthLost={check}/>:<Sellers onAuthLost={check}/>}
 </div>;
}

function Login({configured,onDone}:{configured:boolean;onDone:()=>void}){
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 if(!configured)return <div className="adm-center"><div className="adm-card adm-login"><h1>Team admin</h1><p>The admin is not set up yet: add an <code>ADMIN_PASSWORD</code> of at least 12 characters to the server settings (<code>.dev.vars</code> locally).</p></div></div>;
 return <div className="adm-center"><form className="adm-card adm-login" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');
  try{await api('/api/admin/session',{method:'POST',body:JSON.stringify({name:f.get('name'),password:f.get('password')})});onDone();}
  catch(err){const s=(err as {status?:number}).status;setError(s===429?'Too many attempts. Wait 15 minutes and try again.':s===400?'Enter your name.':'Wrong password.');}
  finally{setBusy(false);}}}>
  <span className="adm-brand" dir="ltr">belmazad<b>.com</b></span><h1>Team admin</h1><p>Your name is recorded on every approval you make.</p>
  <label>Your name<input name="name" autoComplete="name" required minLength={2}/></label>
  <label>Team password<input name="password" type="password" autoComplete="current-password" required/></label>
  {error&&<p className="adm-error" role="alert">{error}</p>}
  <button className="adm-btn primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form></div>;
}

function Buyers({onAuthLost}:{onAuthLost:()=>void}){
 const [data,setData]=useState<{buyers:Buyer[];options:{locations:string[];features:string[]}}|null>(null);
 const [error,setError]=useState('');const [filter,setFilter]=useState<Status|'all'>('pending');const [query,setQuery]=useState('');const [selected,setSelected]=useState<string|null>(null);
 const load=useCallback(()=>{api<{buyers:Buyer[];options:{locations:string[];features:string[]}}>('/api/admin/buyers').then(d=>{setData(d);setError('');}).catch(e=>{if((e as {status?:number}).status===401)onAuthLost();else setError('Could not load requests from HubSpot.');});},[onAuthLost]);
 useEffect(()=>{load();},[load]);
 const counts=useMemo(()=>{const c:Record<string,number>={all:0};for(const b of data?.buyers??[]){c[b.status]=(c[b.status]??0)+1;c.all++;}return c;},[data]);
 const list=(data?.buyers??[]).filter(b=>(filter==='all'||b.status===filter)&&(!query||`${b.ref} ${b.name} ${b.phone} ${b.original.type} ${b.original.locations} ${en(b.publicPost.type)} ${b.publicPost.locations.map(en).join(' ')}`.toLowerCase().includes(query.toLowerCase())));
 const current=data?.buyers.find(b=>b.contactId===selected)??null;
 return <main className="adm-main">
  <div className="adm-bar"><div className="adm-chips">{(['pending','approved','changes_requested','rejected','all'] as const).map(s=><button key={s} aria-pressed={filter===s} className={`chip ${s} ${filter===s?'on':''}`} onClick={()=>setFilter(s)}>{s==='all'?'All':STATUS[s]} <b>{counts[s]??0}</b></button>)}</div>
   <label className="adm-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, phone, ref, area…" aria-label="Search requests"/></label>
   <button className="adm-btn" onClick={load}><RefreshCw size={15}/>Refresh</button></div>
  {error&&<p className="adm-error" role="alert">{error}</p>}
  <div className="adm-split">
   <ul className="adm-list" aria-label="Buyer requests">{!data?<li className="adm-empty">Loading requests…</li>:!list.length?<li className="adm-empty">No requests here.</li>:list.map(b=><li key={b.contactId}><button className={selected===b.contactId?'on':''} onClick={()=>setSelected(b.contactId)}>
    <span className="row1"><strong>{en(b.publicPost.type)} · {b.publicPost.locations.map(en).join(', ')}</strong><span className={`badge ${b.status}`}>{STATUS[b.status]}</span></span>
    <span className="row2">{b.name} · {b.ref} · {date(b.createdAt)}{b.fromWebsite&&' · website'}</span>{b.broker&&<span><BrokerBadge company={b.broker.company}/></span>}{b.warning&&<span className="row3">⚠ {b.warning}</span>}</button></li>)}</ul>
   {current?<BuyerDetail key={current.contactId+current.status+current.reviewedAt} b={current} options={data!.options} onChanged={load} onAuthLost={onAuthLost}/>:<div className="adm-card adm-placeholder"><Eye size={26}/><p>Select a request to review it.</p></div>}
  </div></main>;
}

function BuyerDetail({b,options,onChanged,onAuthLost}:{b:Buyer;options:{locations:string[];features:string[]};onChanged:()=>void;onAuthLost:()=>void}){
 const [f,setF]=useState<Fields>(fieldsOf(b.publicPost));const [dirty,setDirty]=useState(false);const [comment,setComment]=useState('');
 const [busy,setBusy]=useState('');const [msg,setMsg]=useState<{ok:boolean;text:string}|null>(null);const [lang,setLang]=useState<'ar'|'en'>('ar');const [locQuery,setLocQuery]=useState('');
 const set=(p:Partial<Fields>)=>{setF(v=>({...v,...p}));setDirty(true);};
 const preview:Demand={...b.publicPost,type:f.type,locations:f.locations,features:f.features,sizeMin:f.sizeMin??f.sizeMax??0,sizeMax:f.sizeMax??f.sizeMin??0,
  ...(f.budgetMin!=null||f.budgetMax!=null?{min:f.budgetMin??f.budgetMax??0,max:f.budgetMax??f.budgetMin??0,approx:true}:{})};
 async function act(action:'save'|'approve'|'reject'|'changes',reset=false){
  if((action==='reject'||action==='changes')&&comment.trim().length<3){setMsg({ok:false,text:action==='reject'?'Write the reason for rejecting.':'Write what the buyer should change.'});return;}
  if(!f.locations.length){setMsg({ok:false,text:'Choose at least one location.'});return;}
  setBusy(action);setMsg(null);
  try{await api(`/api/admin/buyers/${b.contactId}`,{method:'POST',body:JSON.stringify({action,comment,publicFields:reset?null:dirty?f:undefined})});
   setMsg({ok:true,text:{save:'Saved.',approve:'Approved. The post appears on the website within a minute.',reject:'Rejected. The post is hidden.',changes:'Changes requested. The post is hidden and a call task was created for Khadija.'}[action]});setDirty(false);onChanged();}
  catch(e){if((e as {status?:number}).status===401)onAuthLost();else setMsg({ok:false,text:'Could not save to HubSpot. Try again.'});}
  finally{setBusy('');}
 }
 const toggle=(arr:string[],k:string)=>arr.includes(k)?arr.filter(x=>x!==k):[...arr,k];
 return <section className="adm-card adm-detail" aria-label={`Request ${b.ref}`}>
  <div className="adm-detail-head"><div><h2>{b.ref}</h2><span className={`badge ${b.status}`}>{STATUS[b.status]}</span>{b.edited&&<span className="badge edited">Edited by team</span>}{b.broker&&<> <BrokerBadge company={b.broker.company}/></>}</div>
   <a className="adm-btn" href={b.hubspotUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/>Open in HubSpot</a></div>
  {b.warning&&<p className="adm-warn">⚠ {b.warning}. It was excluded automatically; approving will publish it anyway.</p>}
  <h3><LockKeyhole size={15}/>Private (team only)</h3>
  <dl className="adm-private"><div><dt>Buyer</dt><dd>{b.name}</dd></div><div><dt>Mobile</dt><dd>{b.phone?<a href={`tel:${b.phone}`} dir="ltr"><Phone size={13}/>{b.phone}</a>:'—'}</dd></div>{b.email&&<div><dt>E-mail</dt><dd>{b.email}</dd></div>}
   <div><dt>Submitted</dt><dd>{date(b.createdAt)}</dd></div><div><dt>HubSpot type</dt><dd>{b.original.type||'—'}</dd></div><div><dt>HubSpot locations</dt><dd>{b.original.locations||'—'}</dd></div><div><dt>HubSpot budget</dt><dd>{b.original.budget||'—'}</dd></div>{b.original.userType&&<div><dt>User type</dt><dd>{b.original.userType}</dd></div>}
   <div className="wide"><dt>Staff note</dt><dd className="note">{b.original.note||'—'}</dd></div>
   {b.reviewedAt&&<div className="wide"><dt>Last decision</dt><dd>{STATUS[b.status]} by {b.reviewedBy||'—'} · {date(b.reviewedAt)}{b.comment&&<><br/>“{b.comment}”</>}</dd></div>}</dl>

  <h3><Eye size={15}/>Public post (what visitors see)</h3>
  <div className="adm-editor">
   <label>Type<select value={f.type} onChange={e=>set({type:e.target.value})}>{propertyTypes.map(t=><option key={t} value={t}>{en(t)}</option>)}</select></label>
   <div className="adm-field"><span>Locations</span><div className="adm-tags">{f.locations.map(l=><button key={l} onClick={()=>set({locations:f.locations.filter(x=>x!==l)})} aria-label={`Remove ${en(l)}`}><MapPin size={12}/>{en(l)}<X size={12}/></button>)}</div>
    <input value={locQuery} onChange={e=>setLocQuery(e.target.value)} placeholder="Add a location…" aria-label="Add a location"/>
    {locQuery&&<div className="adm-suggest">{options.locations.filter(l=>!f.locations.includes(l)&&`${en(l)} ${label(l,'ar')}`.toLowerCase().includes(locQuery.toLowerCase())).slice(0,8).map(l=><button key={l} onClick={()=>{set({locations:[...f.locations,l]});setLocQuery('');}}>{en(l)}</button>)}</div>}</div>
   <div className="pair"><label>Area min (m²)<input type="number" min="0" value={f.sizeMin??''} onChange={e=>set({sizeMin:e.target.value===''?null:Number(e.target.value)})}/></label><label>Area max (m²)<input type="number" min="0" value={f.sizeMax??''} onChange={e=>set({sizeMax:e.target.value===''?null:Number(e.target.value)})}/></label></div>
   <div className="pair"><label>Budget min (EGP)<input type="number" min="0" step="100000" value={f.budgetMin??''} onChange={e=>set({budgetMin:e.target.value===''?null:Number(e.target.value)})}/></label><label>Budget max (EGP)<input type="number" min="0" step="100000" value={f.budgetMax??''} onChange={e=>set({budgetMax:e.target.value===''?null:Number(e.target.value)})}/></label></div>
   {b.publicPost.band&&<p className="adm-hint">HubSpot budget range: {en(b.publicPost.band)}. Leave the budget empty to show the range.</p>}
   <div className="adm-field"><span>Requirements</span><div className="adm-toggles">{options.features.map(k=><button key={k} aria-pressed={f.features.includes(k)} className={f.features.includes(k)?'on':''} onClick={()=>set({features:toggle(f.features,k)})}>{en(k)}</button>)}</div></div>
   {b.edited&&<button className="adm-link" onClick={()=>act('save',true)} disabled={!!busy}><RotateCcw size={14}/>Reset to automatic values</button>}
  </div>
  <div className="adm-preview"><div className="adm-preview-head"><span>Preview</span><button className="adm-link" onClick={()=>setLang(lang==='ar'?'en':'ar')}>{lang==='ar'?'English':'العربية'}</button></div><PublicCard d={preview} lang={lang}/></div>

  <h3><MessageSquare size={15}/>Decision</h3>
  <label className="adm-comment">Comment <small>(required to reject or request changes; never shown publicly)</small><textarea rows={2} value={comment} onChange={e=>setComment(e.target.value)} maxLength={2000}/></label>
  {msg&&<p className={msg.ok?'adm-ok':'adm-error'} role={msg.ok?'status':'alert'}>{msg.text}</p>}
  <div className="adm-actions">
   <button className="adm-btn approve" disabled={!!busy} onClick={()=>act('approve')}><Check size={16}/>{busy==='approve'?'Approving…':'Approve and publish'}</button>
   <button className="adm-btn" disabled={!!busy} onClick={()=>act('changes')}><MessageSquare size={16}/>{busy==='changes'?'Sending…':'Request changes'}</button>
   <button className="adm-btn reject" disabled={!!busy} onClick={()=>act('reject')}><X size={16}/>{busy==='reject'?'Rejecting…':'Reject'}</button>
   {dirty&&<button className="adm-btn" disabled={!!busy} onClick={()=>act('save')}><Save size={16}/>{busy==='save'?'Saving…':'Save edits only'}</button>}
  </div></section>;
}

// Mirrors the public request card markup and styles, so the preview matches the website.
function PublicCard({d,lang}:{d:Demand;lang:'ar'|'en'}){
 const l=(k:string)=>label(k,lang),num=(n:number)=>new Intl.NumberFormat(lang==='ar'?'ar-EG':'en-EG').format(n),m=(n:number)=>num(n/1e6);
 const t=lang==='ar'?{wanted:'مطلوب للشراء',size:'المساحة',budget:'الميزانية',sqm:'م²',million:'مليون جنيه',ns:'غير محدد',around:'حوالي',upTo:'حتى',above:'أكثر من',open:'مفتوحة',range:'نطاق'}:{wanted:'Wanted to buy',size:'Area',budget:'Budget',sqm:'m²',million:'M EGP',ns:'Not specified',around:'Around',upTo:'Up to',above:'Above',open:'Open',range:'Range'};
 const size=!d.sizeMin?t.ns:d.sizeMin===d.sizeMax?num(d.sizeMin):`${num(d.sizeMin)}–${num(d.sizeMax)}`;
 const budget=d.approx?(d.min===d.max?`${t.around} ${m(d.min)}`:`${m(d.min)}–${m(d.max)}`):d.band==='band_open'?t.open:!d.max?`${t.above} ${m(d.min)}`:!d.min&&d.band?`${t.upTo} ${m(d.max)}`:`${m(d.min)}–${m(d.max)}`;
 return <article className="demand-card" dir={lang==='ar'?'rtl':'ltr'} lang={lang}><div className="post-head"><PropertyIcon type={d.type} size={48} className="post-icon"/><div><span className="wanted">{t.wanted}</span><h3>{l(d.type)}</h3><p className="post-places">{d.locations.map(l).join(lang==='ar'?'، ':', ')}</p><span className="post-when"><bdi>{d.id}</bdi></span></div></div>
  <div className="post-stats"><div><span>{t.size}</span>{d.sizeMin?<strong dir="ltr">{size} <small>{t.sqm}</small></strong>:<span className="value-missing">{t.ns}</span>}</div><div><span>{t.budget}</span>{d.band==='band_open'?<span className="value-missing">{t.open}</span>:<strong>{budget} <small>{t.million}</small></strong>}{d.approx&&d.band&&<small className="budget-band">{t.range}: {l(d.band)}</small>}</div></div>
  {!!d.features.length&&<div className="chips">{d.features.map(x=><span key={x}>{l(x)}</span>)}</div>}</article>;
}

function Sellers({onAuthLost}:{onAuthLost:()=>void}){
 const [data,setData]=useState<{ready:boolean;stages:Stage[];offers:Offer[]}|null>(null);const [error,setError]=useState('');
 const [stage,setStage]=useState<string>('all');const [kind,setKind]=useState<'all'|'offer'|'keep_looking'>('all');const [selected,setSelected]=useState<string|null>(null);
 const load=useCallback(()=>{api<{ready:boolean;stages:Stage[];offers:Offer[]}>('/api/admin/sellers').then(d=>{setData(d);setError('');}).catch(e=>{if((e as {status?:number}).status===401)onAuthLost();else setError('Could not load offers from HubSpot.');});},[onAuthLost]);
 useEffect(()=>{load();},[load]);
 if(data&&!data.ready)return <main className="adm-main"><div className="adm-card adm-placeholder"><p>The <strong>Website seller offers</strong> pipeline doesn’t exist in HubSpot yet. Once the HubSpot key has the extra permissions, run <code>node scripts/hubspot-setup.mjs</code>.</p></div></main>;
 const list=(data?.offers??[]).filter(o=>(stage==='all'||o.stageId===stage)&&(kind==='all'||o.kind===kind));
 const current=data?.offers.find(o=>o.id===selected)??null;
 return <main className="adm-main">
  <div className="adm-bar"><div className="adm-chips"><button className={`chip ${stage==='all'?'on':''}`} aria-pressed={stage==='all'} onClick={()=>setStage('all')}>All <b>{data?.offers.length??0}</b></button>{data?.stages.map(s=><button key={s.id} aria-pressed={stage===s.id} className={`chip ${stage===s.id?'on':''}`} onClick={()=>setStage(s.id)}>{s.label} <b>{data.offers.filter(o=>o.stageId===s.id).length}</b></button>)}</div>
   <select className="adm-select" value={kind} onChange={e=>setKind(e.target.value as typeof kind)} aria-label="Offer type"><option value="all">All types</option><option value="offer">Offers on requests</option><option value="keep_looking">Keep looking</option></select>
   <button className="adm-btn" onClick={load}><RefreshCw size={15}/>Refresh</button></div>
  {error&&<p className="adm-error" role="alert">{error}</p>}
  <div className="adm-split">
   <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Submitted</th><th>Buyer request</th><th>Seller / property</th><th>Price</th><th>Status</th></tr></thead>
    <tbody>{!data?<tr><td colSpan={5} className="adm-empty">Loading offers…</td></tr>:!list.length?<tr><td colSpan={5} className="adm-empty">No offers here yet.</td></tr>:list.map(o=><tr key={o.id} className={selected===o.id?'on':''} onClick={()=>setSelected(o.id)} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')setSelected(o.id);}}>
     <td>{date(o.createdAt)}</td><td>{o.kind==='keep_looking'?<em>Keep looking (no request)</em>:<>{o.request?.ref}<br/><small>{o.request?.summary}</small></>}</td>
     <td>{o.seller.name}{o.brokerCompany&&<> <BrokerBadge company={o.brokerCompany}/></>}<br/><small>{o.property}{o.area?` · ${o.area.toLocaleString('en-US')} m²`:''}</small></td><td>{egp(o.price)}</td><td><span className="badge stage">{o.stage}</span></td></tr>)}</tbody></table></div>
   {current?<OfferDetail key={current.id+current.stageId+current.notes} o={current} stages={data!.stages} onChanged={load} onAuthLost={onAuthLost}/>:<div className="adm-card adm-placeholder"><Eye size={26}/><p>Select an offer to follow up.</p></div>}
  </div></main>;
}

function OfferDetail({o,stages,onChanged,onAuthLost}:{o:Offer;stages:Stage[];onChanged:()=>void;onAuthLost:()=>void}){
 const [notes,setNotes]=useState(o.notes);const [task,setTask]=useState('');const [busy,setBusy]=useState('');const [msg,setMsg]=useState<{ok:boolean;text:string}|null>(null);
 async function run(kind:string,fn:()=>Promise<unknown>,ok:string){setBusy(kind);setMsg(null);try{await fn();setMsg({ok:true,text:ok});onChanged();}catch(e){if((e as {status?:number}).status===401)onAuthLost();else setMsg({ok:false,text:'Could not save to HubSpot. Try again.'});}finally{setBusy('');}}
 return <section className="adm-card adm-detail" aria-label="Offer">
  <div className="adm-detail-head"><div><h2>{o.kind==='keep_looking'?'Keep looking':`Offer on ${o.request?.ref}`}</h2><span className="badge stage">{o.stage}</span>{o.brokerCompany&&<> <BrokerBadge company={o.brokerCompany}/></>}</div><a className="adm-btn" href={o.hubspotUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/>Open deal in HubSpot</a></div>
  <dl className="adm-private">
   <div><dt>Seller</dt><dd>{o.seller.name}{o.seller.url&&<> · <a href={o.seller.url} target="_blank" rel="noreferrer">HubSpot contact <ExternalLink size={12}/></a></>}</dd></div>
   <div><dt>Mobile</dt><dd>{o.seller.phone?<a href={`tel:${o.seller.phone}`} dir="ltr"><Phone size={13}/>{o.seller.phone}</a>:'—'}</dd></div>
   {o.buyer&&<div><dt>Buyer</dt><dd>{o.buyer.name} · <a href={o.buyer.url} target="_blank" rel="noreferrer">HubSpot contact <ExternalLink size={12}/></a></dd></div>}
   {o.request&&<div><dt>Buyer request</dt><dd>{o.request.ref} · {o.request.summary}</dd></div>}
   <div><dt>Property</dt><dd>{o.property}{o.area?` · ${o.area.toLocaleString('en-US')} m²`:''}</dd></div><div><dt>Asking price</dt><dd>{o.price?`${o.price.toLocaleString('en-US')} EGP`:'—'}</dd></div>
   <div><dt>Submitted</dt><dd>{date(o.createdAt)}</dd></div>
   <div className="wide"><dt>Seller’s details</dt><dd className="note">{o.details||'—'}</dd></div></dl>
  <label className="adm-comment">Status<select value={o.stageId??''} disabled={!!busy} onChange={e=>run('stage',()=>api(`/api/admin/sellers/${o.id}`,{method:'PATCH',body:JSON.stringify({stageId:e.target.value})}),'Status updated.')}>{stages.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
  <label className="adm-comment">Team notes<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} maxLength={5000}/></label>
  <div className="adm-actions"><button className="adm-btn" disabled={!!busy||notes===o.notes} onClick={()=>run('notes',()=>api(`/api/admin/sellers/${o.id}`,{method:'PATCH',body:JSON.stringify({notes})}),'Notes saved.')}><Save size={16}/>{busy==='notes'?'Saving…':'Save notes'}</button></div>
  <label className="adm-comment">Follow-up task for Khadija<textarea rows={2} value={task} onChange={e=>setTask(e.target.value)} placeholder="Call the seller to arrange a viewing" maxLength={2000}/></label>
  <div className="adm-actions"><button className="adm-btn primary" disabled={!!busy||task.trim().length<3} onClick={()=>run('task',()=>api(`/api/admin/sellers/${o.id}`,{method:'POST',body:JSON.stringify({note:task})}).then(()=>setTask('')),'Follow-up task created in HubSpot.')}><Send size={16}/>{busy==='task'?'Creating…':'Create follow-up task'}</button></div>
  {msg&&<p className={msg.ok?'adm-ok':'adm-error'} role={msg.ok?'status':'alert'}>{msg.text}</p>}
 </section>;
}
