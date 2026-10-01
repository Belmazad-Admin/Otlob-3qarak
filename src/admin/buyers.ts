// Server-only: data and actions for the admin "Buyers" section (wishlist approvals).
import {env} from 'cloudflare:workers';
import {hubspot} from '../hubspot/client';
import {getWishlist,invalidateWishlist} from '../hubspot/feed';
import {LISTING_PROPERTIES,toDemand,type WishlistContact} from '../hubspot/wishlist';
import {createTeamCallTasks} from '../hubspot/sellerResponse';
import {labels,label} from '../content';
import {propertyTypes,areas,features,governorates,type Demand} from '../data';

export const PORTAL='143644884';
export const contactUrl=(id:string)=>`https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-1/${id}`;
export const locationKeys=[...new Set([...areas,...Object.keys(governorates),...Object.keys(labels).filter(k=>k.startsWith('gov_'))])];
export const featureKeys=[...new Set([...features,'licensed','cash','utilities','groundFloor','partnership','companyOwned'])];

type Person={firstname?:string|null;lastname?:string|null;phone?:string|null;email?:string|null;company?:string|null};
async function people(ids:string[]){
 const out=new Map<string,Person>();
 for(let i=0;i<ids.length;i+=100){
  const r=await hubspot<{results:{id:string;properties:Person}[]}>('/crm/v3/objects/contacts/batch/read',{method:'POST',body:{inputs:ids.slice(i,i+100).map(id=>({id})),properties:['firstname','lastname','phone','email','company']}});
  for(const c of r.results)out.set(c.id,c.properties);
 }
 return out;
}
function exclusion(c:WishlistContact){
 const p=c.properties;
 if(p.user_type==='Seller')return 'User type is Seller';
 if(p.user_type==='Broker'&&p.website_request_source!=='website')return 'User type is Broker'; // brokers posting through the website are shown with a badge instead
 if(p.budget__maximum_==='Rental')return 'Budget is Rental';
 return null;
}
const stripOverrides=(c:WishlistContact):WishlistContact=>({...c,properties:Object.fromEntries(Object.entries(c.properties).filter(([k])=>!k.startsWith('website_public_')))});

export async function listBuyers(){
 const w=await getWishlist({fresh:true});
 const who=await people(w.entries.map(e=>e.contact.id));
 const salt=env.WISHLIST_ID_SALT||'belmazad-wishlist';
 return Promise.all(w.entries.map(async e=>{
  const p=e.contact.properties,person=who.get(e.contact.id)??{};
  return {
   contactId:e.contact.id,ref:e.demand.id,hubspotUrl:contactUrl(e.contact.id),
   name:[person.firstname,person.lastname].filter(Boolean).join(' ')||'—',phone:person.phone||'',email:person.email||'',
   broker:p.user_type==='Broker'?{company:person.company||''}:null,fromWebsite:p.website_request_source==='website',
   createdAt:p.createdate,status:e.status,warning:exclusion(e.contact)||(!e.publishable?'Note mentions broker, rent or lease':null),
   comment:p.website_listing_comment||'',reviewedBy:p.website_listing_reviewed_by||'',reviewedAt:p.website_listing_reviewed_at||'',
   original:{type:[p.property_type,p.property_subtype].filter(Boolean).join(' / '),locations:[...new Set([p.preferred_locations,p.secondary_preferred_locations].filter(Boolean))].join(', '),budget:p.budget__maximum_||'',note:p.additional_requirments||'',userType:p.user_type||''},
   publicPost:e.demand,
   automatic:await toDemand(stripOverrides(e.contact),salt),
   edited:LISTING_PROPERTIES.some(k=>k.startsWith('website_public_')&&!!p[k])};
 }));
}

export type PublicFields={type:string;locations:string[];sizeMin:number|null;sizeMax:number|null;budgetMin:number|null;budgetMax:number|null;features:string[]};
export type BuyerAction={action:'save'|'approve'|'reject'|'changes';comment?:string;publicFields?:PublicFields|null};
export class ActionError extends Error{}

function checkPublic(f:PublicFields){
 if(!propertyTypes.includes(f.type))throw new ActionError('type');
 if(!f.locations.length||f.locations.some(l=>!locationKeys.includes(l)))throw new ActionError('locations');
 if(f.features.some(x=>!featureKeys.includes(x)))throw new ActionError('features');
 for(const n of [f.sizeMin,f.sizeMax,f.budgetMin,f.budgetMax])if(n!=null&&!(Number.isFinite(n)&&n>=0&&n<1e12))throw new ActionError('number');
}
const numberProp=(n:number|null)=>n==null?'':String(Math.round(n));

export async function actOnBuyer(contactId:string,input:BuyerAction,reviewer:string){
 const w=await getWishlist({fresh:true});
 const entry=w.entries.find(e=>e.contact.id===contactId);
 if(!entry)throw new ActionError('not-found');
 const comment=(input.comment??'').trim().slice(0,2000);
 if((input.action==='reject'||input.action==='changes')&&comment.length<3)throw new ActionError('comment');
 const props:Record<string,string>={};
 if(input.publicFields===null)for(const k of LISTING_PROPERTIES)if(k.startsWith('website_public_'))props[k]='';
 if(input.publicFields){const f=input.publicFields;checkPublic(f);Object.assign(props,{website_public_type:f.type,website_public_locations:f.locations.join(';'),website_public_features:f.features.join(';'),website_public_size_min:numberProp(f.sizeMin),website_public_size_max:numberProp(f.sizeMax),website_public_budget_min:numberProp(f.budgetMin),website_public_budget_max:numberProp(f.budgetMax)});}
 if(input.action!=='save')Object.assign(props,{website_listing_status:{approve:'approved',reject:'rejected',changes:'changes_requested'}[input.action],website_listing_comment:comment,website_listing_reviewed_by:reviewer,website_listing_reviewed_at:new Date().toISOString()});
 if(Object.keys(props).length)await hubspot(`/crm/v3/objects/contacts/${contactId}`,{method:'PATCH',body:{properties:props}});
 if(input.action==='changes'){
  const d:Demand=entry.demand;
  await createTeamCallTasks(`[Website] Call buyer to update request ${d.id} – ${label(d.type,'en')} · ${d.locations.map(l=>label(l,'en')).join(' / ')}`,
   `<p><strong>The team asked for changes before publishing buyer request ${d.id} on belmazad.com.</strong> Call the buyer to update the request.</p><p>Requested changes: ${comment.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]!)}</p><p>Requested by ${reviewer.replace(/[&<>"]/g,'')}.</p>`,[contactId]);
 }
 invalidateWishlist();
}
