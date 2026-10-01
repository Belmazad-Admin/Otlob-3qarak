// Server-only: cached Buyer Wishlist, shared by the public feed, seller responses and the team admin.
import {env} from 'cloudflare:workers';
import {hubspot} from './client';
import {CONTACT_PROPERTIES,WISHLIST_SOURCE,isPublishable,listingStatus,toDemand,type ListingStatus,type WishlistContact} from './wishlist';
import type {Demand} from '../data';

const CACHE_MS=60_000,MAX_PAGES=20;
export type WishlistEntry={contact:WishlistContact;demand:Demand;status:ListingStatus;publishable:boolean};
// `requests` is the public feed (approved only). `contacts` maps each public BM- reference to its HubSpot contact
// and `entries` holds every request for the admin; neither is ever sent to the public browser.
export type Wishlist={at:number;requests:Demand[];contacts:Map<string,WishlistContact>;entries:WishlistEntry[];stale?:boolean};
let cache:Wishlist|null=null;
let inflight:Promise<Wishlist>|null=null; // one HubSpot fetch shared by concurrent requests

async function load():Promise<Wishlist>{
 const found:WishlistContact[]=[];let after:string|undefined;
 for(let page=0;page<MAX_PAGES;page++){
  const data=await hubspot<{results:WishlistContact[];paging?:{next?:{after:string}}}>('/crm/v3/objects/contacts/search',{method:'POST',body:{
   // HubSpot Buyer Wishlist Form contacts OR requests submitted through the website wizard.
   filterGroups:[{filters:[{propertyName:'hs_object_source_detail_1',operator:'EQ',value:WISHLIST_SOURCE}]},{filters:[{propertyName:'website_request_source',operator:'EQ',value:'website'}]}],
   properties:CONTACT_PROPERTIES,sorts:[{propertyName:'createdate',direction:'DESCENDING'}],limit:100,...(after?{after}:{})}});
  found.push(...data.results);after=data.paging?.next?.after;if(!after)break;}
 const salt=env.WISHLIST_ID_SALT||'belmazad-wishlist';
 const entries:WishlistEntry[]=await Promise.all(found.map(async contact=>({contact,demand:await toDemand(contact,salt),status:listingStatus(contact),publishable:isPublishable(contact)})));
 // Until the team has set any listing status (setup not yet run), keep the previous automatic rules.
 const moderated=found.some(c=>!!c.properties.website_listing_status);
 const visible=entries.filter(e=>moderated?e.status==='approved':e.publishable);
 return {at:Date.now(),requests:visible.map(e=>e.demand),contacts:new Map(visible.map(e=>[e.demand.id,e.contact])),entries};
}

export async function getWishlist({fresh=false}:{fresh?:boolean}={}):Promise<Wishlist>{
 if(!fresh&&cache&&Date.now()-cache.at<CACHE_MS)return cache;
 try{inflight??=load().finally(()=>{inflight=null;});cache=await inflight;return cache;}
 catch(error){
  // Serve the last good copy rather than an empty feed during a HubSpot outage.
  if(cache&&!fresh){console.error('wishlist:',error instanceof Error?error.message:error);return {...cache,stale:true};}
  throw error;}
}
export const invalidateWishlist=()=>{cache=null;};
