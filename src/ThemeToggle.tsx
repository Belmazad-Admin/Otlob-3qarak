'use client';
// Light/dark switch. The site always opens in light unless the visitor chose dark before (saved in localStorage).
// The icon is chosen by CSS from <html data-theme>, so no React state is needed.
import {Moon,Sun} from 'lucide-react';
import {THEME_KEY} from './theme';

export default function ThemeToggle({label}:{label:string}){
 const toggle=()=>{
  const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=next;
  try{localStorage.setItem(THEME_KEY,next);}catch{}
 };
 return <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}><Sun className="sun" size={17}/><Moon className="moon" size={17}/></button>;
}
