'use client';
// Buyer chat assistant in the blue "What property is on your mind?" panel. The buyer writes freely (Arabic or English);
// /api/buyer-assistant (Claude) replies and returns the form fields it understood, which the page applies to the
// 7-step wizard. Hidden when the server has no ANTHROPIC_API_KEY. Nothing here is published by itself.
import {useEffect,useRef,useState} from 'react';
import {Send,Sparkles,Check,RotateCcw} from 'lucide-react';
import {content,label,type Lang} from '../content';
import type {AssistantFields} from './buyerAssistant';

type Turn={role:'user'|'assistant';text:string;filled?:string};

export default function BuyerChat({lang,onFields}:{lang:Lang;onFields:(fields:AssistantFields,ready:boolean)=>void}){
 const t=content[lang];
 const [enabled,setEnabled]=useState(false),[turns,setTurns]=useState<Turn[]>([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const log=useRef<HTMLDivElement>(null),box=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{fetch('/api/buyer-assistant',{cache:'no-store'}).then(r=>r.json() as Promise<{enabled?:boolean}>).then(d=>setEnabled(!!d.enabled)).catch(()=>setEnabled(false));},[]);
 useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight,behavior:'smooth'});},[turns,busy]);
 if(!enabled)return null;

 const num=(n:number)=>new Intl.NumberFormat(lang==='ar'?'ar-EG':'en-EG',{maximumFractionDigits:1}).format(n);
 // A one-line summary of what the form now holds, shown under the assistant's reply.
 const summary=(f:AssistantFields)=>[f.type&&label(f.type,lang),f.locations.map(k=>label(k,lang)).join(lang==='ar'?'، ':', '),
  f.budgetMax?`${f.budgetMin?`${num(f.budgetMin/1e6)}–`:''}${num(f.budgetMax/1e6)} ${t.million}`:'',f.sizeMin?`${num(f.sizeMin)}${f.sizeMax&&f.sizeMax!==f.sizeMin?`–${num(f.sizeMax)}`:''} ${t.sqm}`:'',
  f.bedrooms?`${f.bedrooms} ${t.bedrooms}`:'',...f.features.map(k=>label(k,lang))].filter(Boolean).join(' · ');

 async function send(text:string){
  const message=text.trim().slice(0,600);if(!message||busy)return;
  const next=[...turns,{role:'user' as const,text:message}];
  setTurns(next);setInput('');setBusy(true);setNotice('');
  try{
   const res=await fetch('/api/buyer-assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lang,messages:next.map(({role,text})=>({role,text}))})});
   const data=await res.json().catch(()=>({})) as {status?:string;field?:string;reply?:string;fields?:AssistantFields;ready?:boolean};
   if(res.ok&&data.reply&&data.fields){
    onFields(data.fields,!!data.ready);
    setTurns([...next,{role:'assistant',text:data.reply,filled:summary(data.fields)}]);
   }else{setTurns(turns);setInput(message);setNotice(res.status===429?t.chatLimit:data.field==='too-long'?t.chatLong:t.chatError);}
  }catch{setTurns(turns);setInput(message);setNotice(t.chatError);}
  finally{setBusy(false);setTimeout(()=>box.current?.focus({preventScroll:true}),0);}
 }

 return <div className="chat" role="region" aria-label={t.chatLabel}>
  <div className="chat-log" ref={log} role="log" aria-live="polite">
   <p className="chat-msg assistant"><Sparkles size={15} aria-hidden="true"/><span>{t.chatGreeting}</span></p>
   {turns.map((m,i)=><div key={i} className={`chat-msg ${m.role}`}>{m.role==='assistant'&&<Sparkles size={15} aria-hidden="true"/>}<span>{m.text}{m.filled&&<small className="chat-filled"><Check size={13} aria-hidden="true"/>{t.chatFilled}: {m.filled}</small>}</span></div>)}
   {busy&&<p className="chat-msg assistant chat-typing" role="status"><Sparkles size={15} aria-hidden="true"/><span>{t.chatThinking}</span></p>}
  </div>
  {!turns.length&&<div className="chat-examples">{t.chatExamples.map(x=><button type="button" key={x} onClick={()=>send(x)} disabled={busy}>{x}</button>)}</div>}
  {notice&&<p className="chat-notice" role="alert">{notice}</p>}
  <form className="chat-form" onSubmit={e=>{e.preventDefault();send(input);}}>
   <textarea ref={box} value={input} onChange={e=>setInput(e.target.value)} rows={1} maxLength={600} placeholder={t.chatPlaceholder} aria-label={t.chatPlaceholder}
    onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send(input);}}}/>
   <button type="submit" className="chat-send" disabled={busy||!input.trim()} aria-label={t.chatSend}><Send size={18}/></button>
  </form>
  <div className="chat-foot"><span>{t.chatPrivacy}</span>{!!turns.length&&<button type="button" onClick={()=>{setTurns([]);setNotice('');}} disabled={busy}><RotateCcw size={13}/>{t.chatRestart}</button>}</div>
 </div>;
}
