// Server-only HubSpot REST helper. The token never leaves the server.
import {env} from 'cloudflare:workers';

export class HubSpotError extends Error{constructor(message:string,readonly status:number){super(message);}}
export const hubspotConfigured=()=>!!env.HUBSPOT_ACCESS_TOKEN;

export async function hubspot<T>(path:string,init:{method?:string;body?:unknown}={}):Promise<T>{
 const res=await fetch(`${env.HUBSPOT_API_BASE||'https://api.hubapi.com'}${path}`,{method:init.method||'GET',
  headers:{authorization:`Bearer ${env.HUBSPOT_ACCESS_TOKEN}`,'content-type':'application/json'},
  ...(init.body!==undefined?{body:JSON.stringify(init.body)}:{})});
 if(!res.ok){const detail=await res.text().catch(()=>'');throw new HubSpotError(`HubSpot ${init.method||'GET'} ${path.split('?')[0]} failed (${res.status}): ${detail.slice(0,300)}`,res.status);}
 return (res.status===204?undefined:await res.json()) as T;
}
