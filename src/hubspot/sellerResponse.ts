// Server-only: seller actions on the website become HubSpot call tasks for the sales team.
// - Offer on a buyer request ("عندي العقار ده")  → submitSellerResponse
// - No match yet ("خلّينا ندوّرلك")               → submitSellerSearch
// Both find or create the seller contact, then create one "[Website]" call task per owner, duplicate-checked.
import {env} from 'cloudflare:workers';
import {hubspot,HubSpotError} from './client';
import {getWishlist} from './feed';
import {createOfferDeal} from './offers';
import {label} from '../content';
import {propertyTypes,areas,features as featureKeys,type Demand} from '../data';

// Default owners: Khadeja Hesham (33163566) and Khadija Hesham (1824975088). Override with HUBSPOT_TASK_OWNER_IDS.
const DEFAULT_OWNERS='33163566,1824975088';
const PORTAL='143644884';
const TASK_TO_CONTACT=204,TASK_TO_DEAL=216; // HubSpot-defined association type IDs

// broker/company: "أنا وسيط عقاري" was ticked → contact is tagged Broker and tasks are marked "[Broker]".
export type Broker={broker:boolean;company:string};
export type SellerResponse={requestId:string;name:string;phone:string;size:number;price:number;details:string}&Broker;
export type SellerSearch={name:string;phone:string;type:string;location:string;size:number;price:number;bedrooms:number;bathrooms:number;features:string[];details:string}&Broker;
export type SellerResult={status:'created'|'duplicate';tasks:number;failedOwners:string[]};
export class InputError extends Error{}

const recent=new Map<string,number>(); // key -> time; covers HubSpot's search-index delay after a create
const rejectedOwners=new Map<string,number>(); // owners HubSpot refused (e.g. deactivated users), retried after an hour
const running=new Map<string,Promise<SellerResult>>(); // identical submissions arriving at the same moment

export function egyptianMobile(raw:string){
 const digits=raw.replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g,'');
 const m=/^(?:0020|20|0)?0?(1[0125]\d{8})$/.exec(digits);return m?m[1]:null; // national number without the leading 0
}
const text=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
function contactFields(name:string,phone:string){
 if(name.length<2)throw new InputError('name');
 if(!egyptianMobile(phone))throw new InputError('phone');
}
export function brokerFields(input:{broker?:unknown;company?:unknown}):Broker{
 const broker=input.broker===true,company=broker?text(input.company,100):'';
 if(broker&&company.length<2)throw new InputError('company');
 return {broker,company};
}
export const taskTag=(b:Broker)=>b.broker?'[Website] [Broker]':'[Website]';
export const brokerLine=(b:Broker)=>b.broker?`<p><strong>Submitted by a broker</strong> — brokerage: ${b.company.replace(/[&<>"]/g,'')}</p>`:'';
function propertyFields(size:number,price:number){
 if(!(size>0&&size<1e8))throw new InputError('size');
 if(!(price>0&&price<1e12))throw new InputError('price');
}

export function validate(input:Partial<Record<keyof SellerResponse,unknown>>):SellerResponse{
 const r={requestId:text(input.requestId,20),name:text(input.name,100),phone:text(input.phone,25),size:Number(input.size),price:Number(input.price),details:text(input.details,1500),...brokerFields(input)};
 if(!/^BM-[A-Z0-9]{4,10}$/.test(r.requestId))throw new InputError('requestId');
 contactFields(r.name,r.phone);propertyFields(r.size,r.price);
 if(r.details.length<10)throw new InputError('details');
 return r;
}

export function validateSearch(input:Partial<Record<keyof SellerSearch,unknown>>):SellerSearch{
 const r={name:text(input.name,100),phone:text(input.phone,25),type:text(input.type,30),location:text(input.location,30),size:Number(input.size),price:Number(input.price),
  bedrooms:Math.max(0,Math.min(50,Number(input.bedrooms)||0)),bathrooms:Math.max(0,Math.min(50,Number(input.bathrooms)||0)),
  features:Array.isArray(input.features)?input.features.filter((f):f is string=>typeof f==='string'&&featureKeys.includes(f)).slice(0,20):[],details:text(input.details,1500),...brokerFields(input)};
 contactFields(r.name,r.phone);propertyFields(r.size,r.price);
 if(!propertyTypes.includes(r.type))throw new InputError('type');
 if(!areas.includes(r.location))throw new InputError('location');
 return r;
}

async function dedupeKey(prefix:'SR'|'SK',...parts:string[]){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${prefix}:${parts.join(':')}`));
 return prefix+[...new Uint8Array(digest).slice(0,6)].map(b=>b.toString(36).padStart(2,'0')).join('').toUpperCase().slice(0,10);
}

type Submitter={name:string;mobile:string}&Broker;
const findOrCreateSeller=(s:Submitter)=>findOrCreateContact(s.name,s.mobile,s.broker?'Broker':'Seller',s.broker?{company:s.company}:{});
// Finds a contact by Egyptian mobile (several stored formats), or creates one with the given user type.
export async function findOrCreateContact(name:string,mobile:string,userType:'Seller'|'Buyer'|'Broker',extra:Record<string,string>={}){
 const variants=['+20'+mobile,'0'+mobile,'+200'+mobile,'20'+mobile];
 const found=await hubspot<{results:{id:string}[]}>('/crm/v3/objects/contacts/search',{method:'POST',body:{
  filterGroups:[...variants.map(v=>({filters:[{propertyName:'phone',operator:'EQ',value:v}]})),{filters:[{propertyName:'hs_whatsapp_phone_number',operator:'EQ',value:'+20'+mobile}]}],
  properties:['hs_object_id'],sorts:[{propertyName:'createdate',direction:'ASCENDING'}],limit:1}});
 if(found.results[0])return {id:found.results[0].id,created:false};
 const [firstname,...rest]=name.split(/\s+/);
 const created=await hubspot<{id:string}>('/crm/v3/objects/contacts',{method:'POST',body:{properties:{firstname,lastname:rest.join(' '),phone:'+20'+mobile,user_type:userType,...extra}}});
 return {id:created.id,created:true};
}

async function buyerDeals(contactId:string){
 try{const r=await hubspot<{results:{toObjectId:number|string}[]}>(`/crm/v4/objects/contacts/${contactId}/associations/deals?limit=10`);return r.results.map(x=>String(x.toObjectId));}
 catch(error){console.error('seller-response: deals lookup failed',error instanceof Error?error.message:error);return [];}
}

async function taskExists(key:string,owner:string){
 const r=await hubspot<{total:number}>('/crm/v3/objects/tasks/search',{method:'POST',body:{
  filterGroups:[{filters:[{propertyName:'hs_task_subject',operator:'CONTAINS_TOKEN',value:key},{propertyName:'hubspot_owner_id',operator:'EQ',value:owner}]}],properties:['hs_task_subject'],limit:1}});
 return r.total>0;
}

const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]!);
const egp=(n:number)=>`${n.toLocaleString('en-US')} EGP`;
const sqm=(n:number)=>`${n.toLocaleString('en-US')} m²`;
const link=(id:string)=>`https://app.hubspot.com/contacts/${PORTAL}/record/0-1/${id}`;
const lines=(s:string)=>esc(s).replace(/\r?\n/g,'<br>');
const WEBSITE_NOTE='<p><em>Created automatically from belmazad.com (website task).</em></p>';
function describe(d:Demand){
 const size=!d.sizeMin?'not specified':d.sizeMin===d.sizeMax?sqm(d.sizeMin):`${d.sizeMin.toLocaleString('en-US')}–${sqm(d.sizeMax)}`;
 const budget=d.approx?(d.min===d.max?`around ${egp(d.min)}`:`${egp(d.min)} – ${egp(d.max)}`):d.band?label(d.band,'en'):'not specified';
 return {type:label(d.type,'en'),where:d.locations.map(l=>label(l,'en')).join(' / '),size,budget,band:d.band?label(d.band,'en'):'',features:d.features.map(f=>label(f,'en')).join(', ')||'—'};
}
const sellerBlock=(s:Submitter,seller:{id:string;created:boolean})=>brokerLine(s)+
 `<p><strong>${s.broker?'Broker':'Seller'}</strong><br>Name: ${esc(s.name)}${s.broker?`<br>Brokerage: ${esc(s.company)}`:''}<br>Mobile: +20${s.mobile}<br>Contact: <a href="${link(seller.id)}">${link(seller.id)}</a>${seller.created?' (new contact created from the website)':' (existing contact)'}</p>`;
const contactAssoc=(id:string)=>({to:{id},types:[{associationCategory:'HUBSPOT_DEFINED',associationTypeId:TASK_TO_CONTACT}]});

type TaskPlan={subject:string;body:string;associations:ReturnType<typeof contactAssoc>[]};

// Shared pipeline: dedupe per owner → find/create seller → one call task per owner.
async function createCallTasks(key:string,who:Submitter,plan:(seller:{id:string;created:boolean})=>Promise<TaskPlan>):Promise<SellerResult>{
 if(running.has(key)){await running.get(key)!.catch(()=>{});return {status:'duplicate',tasks:0,failedOwners:[]};}
 const job=(async():Promise<SellerResult>=>{
  const owners=(env.HUBSPOT_TASK_OWNER_IDS||DEFAULT_OWNERS).split(',').map(s=>s.trim()).filter(Boolean);
  const pending:string[]=[];let existing=0;
  for(const owner of owners){
   if((rejectedOwners.get(owner)??0)>Date.now()-60*60_000)continue;
   if((recent.get(`${key}:${owner}`)??0)>Date.now()-10*60_000||await taskExists(key,owner)){existing++;continue;}
   pending.push(owner);}
  if(!pending.length){if(existing)return {status:'duplicate',tasks:0,failedOwners:[]};throw new Error('No task owner is currently accepted by HubSpot');}

  const seller=await findOrCreateSeller(who);
  const {subject,body,associations}=await plan(seller);
  let tasks=0;const failedOwners:string[]=[];
  for(const owner of pending){
   try{await hubspot('/crm/v3/objects/tasks',{method:'POST',body:{properties:{hs_task_subject:subject,hs_task_body:WEBSITE_NOTE+body+`<p>Submitted ${new Date().toISOString()} · Duplicate check key ${key}</p>`,hs_task_status:'NOT_STARTED',hs_task_priority:'HIGH',hs_task_type:'CALL',hs_timestamp:new Date().toISOString(),hubspot_owner_id:owner},associations}});
    recent.set(`${key}:${owner}`,Date.now());tasks++;}
   catch(error){if(!(error instanceof HubSpotError))throw error;console.error(`website task for owner ${owner} failed`,error.message);failedOwners.push(owner);
    if(error.status===400)rejectedOwners.set(owner,Date.now());}
  }
  if(!tasks){if(existing)return {status:'duplicate',tasks:0,failedOwners};throw new Error(`No task could be created (owners ${failedOwners.join(', ')})`);}
  return {status:'created',tasks,failedOwners};
 })().finally(()=>running.delete(key));
 running.set(key,job);return job;
}

// A one-off "[Website]" call task for every owner (no duplicate check), e.g. "call buyer to update request".
export async function createTeamCallTasks(subject:string,bodyHtml:string,contactIds:string[],extra:{to:{id:string};types:{associationCategory:string;associationTypeId:number}[]}[]=[],taskType:'CALL'|'TODO'='CALL'){
 const owners=(env.HUBSPOT_TASK_OWNER_IDS||DEFAULT_OWNERS).split(',').map(s=>s.trim()).filter(Boolean).filter(o=>(rejectedOwners.get(o)??0)<=Date.now()-60*60_000);
 let tasks=0;
 for(const owner of owners){
  try{await hubspot('/crm/v3/objects/tasks',{method:'POST',body:{properties:{hs_task_subject:subject,hs_task_body:WEBSITE_NOTE+bodyHtml,hs_task_status:'NOT_STARTED',hs_task_priority:'HIGH',hs_task_type:taskType,hs_timestamp:new Date().toISOString(),hubspot_owner_id:owner},associations:[...contactIds.map(contactAssoc),...extra]}});tasks++;}
  catch(error){if(!(error instanceof HubSpotError))throw error;console.error(`website task for owner ${owner} failed`,error.message);if(error.status===400)rejectedOwners.set(owner,Date.now());}
 }
 if(!tasks)throw new Error('No task could be created');
 return tasks;
}

export async function submitSellerResponse(input:SellerResponse):Promise<SellerResult>{
 const wishlist=await getWishlist();
 const buyer=wishlist.contacts.get(input.requestId),demand=wishlist.requests.find(d=>d.id===input.requestId);
 if(!buyer||!demand)throw new InputError('requestId');
 const mobile=egyptianMobile(input.phone)!,key=await dedupeKey('SR',buyer.id,mobile);
 const who={name:input.name,mobile,broker:input.broker,company:input.company};
 return createCallTasks(key,who,async seller=>{
  const deals=await buyerDeals(buyer.id);
  const d=describe(demand),p=buyer.properties;
  const offerDeal=await createOfferDeal({kind:'offer',key,requestRef:input.requestId,buyerId:buyer.id,sellerId:seller.id,sellerName:input.name,brokerCompany:input.company,property:`${d.type} · ${d.where}`,area:input.size,price:input.price,details:input.details});
  return {
   subject:`${taskTag(who)} Call ${who.broker?'broker':'seller'} about offer [${key}] – ${d.type} · ${d.where} (${input.requestId})`,
   body:[
    `<p><strong>A seller responded to buyer request ${esc(input.requestId)} on belmazad.com.</strong> Call the seller to review the offer.</p>`,
    `<p><strong>Buyer request (as shown on the website)</strong><br>Type: ${esc(d.type)}<br>Location: ${esc(d.where)}<br>Area: ${esc(d.size)}<br>Budget: ${esc(d.budget)}${d.band&&demand.approx?` (HubSpot range: ${esc(d.band)})`:''}<br>Requirements: ${esc(d.features)}</p>`,
    `<p><strong>Original wishlist (HubSpot buyer contact)</strong><br>Buyer contact: <a href="${link(buyer.id)}">${link(buyer.id)}</a><br>Property type: ${esc([p.property_type,p.property_subtype].filter(Boolean).join(' / ')||'—')}<br>Preferred locations: ${esc([...new Set([p.preferred_locations,p.secondary_preferred_locations].filter(Boolean))].join(', ')||'—')}<br>Budget range: ${esc(p.budget__maximum_||'—')}<br>Additional requirements: ${lines(p.additional_requirments||'—')}</p>`,
    sellerBlock(who,seller),
    `<p><strong>Seller's property / response</strong><br>Area: ${sqm(input.size)}<br>Asking price: ${egp(input.price)}<br>Details: ${lines(input.details)}</p>`].join(''),
   associations:[...new Set([buyer.id,seller.id])].map(contactAssoc).concat(deals.map(id=>({to:{id},types:[{associationCategory:'HUBSPOT_DEFINED',associationTypeId:TASK_TO_DEAL}]})),offerDeal)};
 });
}

export async function submitSellerSearch(input:SellerSearch):Promise<SellerResult>{
 const mobile=egyptianMobile(input.phone)!,key=await dedupeKey('SK',mobile,input.type,input.location);
 const type=label(input.type,'en'),where=label(input.location,'en');
 const featureText=input.features.map(f=>label(f,'en')).join(', ');
 const who={name:input.name,mobile,broker:input.broker,company:input.company};
 return createCallTasks(key,who,async seller=>{
  const offerDeal=await createOfferDeal({kind:'keep_looking',key,sellerId:seller.id,sellerName:input.name,brokerCompany:input.company,property:`${type} · ${where}`,area:input.size,price:input.price,
   details:[input.details,featureText&&`Features: ${featureText}`,input.bedrooms||input.bathrooms?`Bedrooms / bathrooms: ${input.bedrooms} / ${input.bathrooms}`:''].filter(Boolean).join('\n')});
  return {
  subject:`${taskTag(who)} Call ${who.broker?'broker':'seller'} – let us keep looking [${key}] – ${type} · ${where} · ${sqm(input.size)} · ${egp(input.price)}`,
  body:[
   `<p><strong>A seller found no matching buyer request today and asked belmazad to keep looking.</strong> Call the seller, then match the property with new buyer requests as they arrive.</p>`,
   sellerBlock(who,seller),
   `<p><strong>Seller's property</strong><br>Type: ${esc(type)}<br>Location: ${esc(where)}<br>Area: ${sqm(input.size)}<br>Asking price: ${egp(input.price)}${input.bedrooms||input.bathrooms?`<br>Bedrooms / bathrooms: ${input.bedrooms} / ${input.bathrooms}`:''}<br>Features: ${esc(input.features.map(f=>label(f,'en')).join(', ')||'—')}${input.details?`<br>Details: ${lines(input.details)}`:''}</p>`].join(''),
  associations:[contactAssoc(seller.id),...offerDeal]};
 });
}
