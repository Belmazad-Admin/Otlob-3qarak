'use client';
// The signed-in buyer/seller account in the browser (only the public profile; see src/auth/accounts.ts).
import {useCallback,useEffect,useState} from 'react';

export type AccountUser={name:string;email:string;phone:string;broker:boolean;company:string};
// undefined while loading, null when signed out.
export function useAccount(){
 const [user,setUser]=useState<AccountUser|null|undefined>(undefined);
 const refresh=useCallback(()=>fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.json() as Promise<{user:AccountUser|null}>).then(d=>{setUser(d.user);return d.user;}).catch(()=>{setUser(null);return null;}),[]);
 useEffect(()=>{refresh();},[refresh]);
 const signOut=useCallback(async()=>{await fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});setUser(null);},[]);
 return {user,setUser,refresh,signOut};
}
