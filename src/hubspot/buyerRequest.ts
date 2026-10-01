// Server-only: a buyer's request from the website wizard → HubSpot contact (Pending) + review task for the team.
// It appears in Admin → Buyers → Pending and only goes public after approval.
import {env} from 'cloudflare:workers';
import {hubspot} from './client';
import {invalidateWishlist} from './feed';
import {publicId} from './wishlist';
import {brokerFields,brokerLine,createTeamCallTasks,egyptianMobile,findOrCreateContact,InputError,taskTag} from './sellerResponse';
import {label} from '../content';
import {areas,features,governorates,propertyTypes,validateStep,type PropertyRequest} from '../data';

export const WEBSITE_SOURCE='website'; // value of the contact property website_request_source

// Website values → the existing HubSpot wishlist fields the team already uses.
const HS_TYPE:Record<string,string>={apartment:'Residential',villa:'Residential',chalet:'Residential',office:'Commercial',retail:'Commercial',commercial:'Commercial',building:'Commercial',land:'Land',factory:'Industrial',warehouse:'Industrial'};
const HS_SUBTYPE:Record<string,string>={apartment:'Apartment',villa:'Villa',chalet:'Chalet',office:'Office Space',retail:'Retail',commercial:'Commercial',building:'Building',land:'Land Use',factory:'Factory',warehouse:'Warehouse',other:'Other'};
const HS_GOVERNORATE:Record<string,string>={giza:'Giza',cairo:'Cairo',sharkia:'Sharkia',alexandria:'Alexandria',matrouh:'Matrouh',suez:'Suez',redsea:'Red Sea',beheira:'Beheira',dakahlia:'Dakahlia'};
const band=(max:number)=>max<5e6?'Under 5 million':max<=10e6?'5 - 10 million':max<=50e6?'10 - 50 million':'Above 50 million';
const text=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
const num=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0;

export function validateBuyerRequest(input:Record<string,unknown>):PropertyRequest{
 const r:PropertyRequest={intent:'buy',type:text(input.type,30),locations:Array.isArray(input.locations)?[...new Set(input.locations.filter((l):l is string=>typeof l==='string'&&areas.includes(l)))].slice(0,12):[],
  budgetMin:num(input.budgetMin),budgetMax:num(input.budgetMax),sizeMin:num(input.sizeMin),sizeMax:num(input.sizeMax),bedrooms:Math.max(0,Math.min(30,num(input.bedrooms))),bathrooms:Math.max(0,Math.min(30,num(input.bathrooms))),
  floor:text(input.floor,40),features:Array.isArray(input.features)?input.features.filter((f):f is string=>typeof f==='string'&&features.includes(f)).slice(0,20):[],
  notes:text(input.notes,700),name:text(input.name,100),phone:text(input.phone,25),consent:input.consent===true,...brokerFields(input)};
 if(!propertyTypes.includes(r.type))throw new InputError('type');
 for(let step=1;step<=6;step++){const e=validateStep(step,r);if(e)throw new InputError(e);}
 if(r.budgetMax>5e9||r.sizeMax>5e7)throw new InputError('range');
 return r;
}

const recent=new Map<string,{at:number;ref:string}>(); // same buyer + same request within 10 minutes → no second task

export async function submitBuyerRequest(r:PropertyRequest):Promise<{status:'created'|'duplicate';reference:string}>{
 const mobile=egyptianMobile(r.phone)!;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`BR:${mobile}:${r.type}:${[...r.locations].sort().join(',')}:${r.budgetMin}:${r.budgetMax}:${r.sizeMin}:${r.sizeMax}`));
 const key=[...new Uint8Array(digest).slice(0,8)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const seen=recent.get(key);if(seen&&Date.now()-seen.at<10*60_000)return {status:'duplicate',reference:seen.ref};

 const govs=[...new Set(r.locations.map(l=>HS_GOVERNORATE[governorates[l]]).filter(Boolean))];
 const en=(k:string)=>label(k,'en'),egp=(n:number)=>`${n.toLocaleString('en-US')} EGP`;
 const summary=[`Website request: ${en(r.type)} in ${r.locations.map(en).join(' / ')}`,`area ${r.sizeMin.toLocaleString('en-US')}–${r.sizeMax.toLocaleString('en-US')} m²`,`budget ${egp(r.budgetMin)} – ${egp(r.budgetMax)}`,
  r.bedrooms||r.bathrooms?`bedrooms / bathrooms ${r.bedrooms} / ${r.bathrooms}`:'',r.floor?`floor ${r.floor}`:'',r.features.length?`must-haves: ${r.features.map(en).join(', ')}`:'',r.notes?`buyer notes: ${r.notes}`:'',r.broker?`submitted by a broker: ${r.company}`:''].filter(Boolean).join('\n');
 // HubSpot validates additional_requirments as letters/numbers only, so the stored copy is plain words;
 // the full formatted summary goes into the review task.
 const plain=summary.split('\n').map(line=>line.replace(/(\d),(?=\d)/g,'$1').replace(/m²/g,'m2').replace(/–/g,' to ').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim()).filter(Boolean).join('   ');
 const wishlist:Record<string,string>={
  property_type:HS_TYPE[r.type]??'',property_subtype:HS_SUBTYPE[r.type]??'Other',preferred_locations:govs[0]??'',secondary_preferred_locations:govs[1]??govs[0]??'',
  budget__maximum_:band(r.budgetMax),additional_requirments:plain,user_type:r.broker?'Broker':'Buyer',...(r.broker?{company:r.company}:{}),wishlist_submitted:'Yes',website_request_source:WEBSITE_SOURCE,
  website_listing_status:'pending',website_listing_comment:'',website_listing_reviewed_by:'',website_listing_reviewed_at:'',
  // The buyer's exact choices become the public post (the team can still edit it in the admin).
  website_public_type:r.type,website_public_locations:r.locations.join(';'),website_public_features:r.features.join(';'),
  website_public_size_min:String(r.sizeMin),website_public_size_max:String(r.sizeMax),website_public_budget_min:String(r.budgetMin),website_public_budget_max:String(r.budgetMax)};

 const contact=await findOrCreateContact(r.name,mobile,r.broker?'Broker':'Buyer',wishlist);
 // An existing contact gets this request as their current wishlist (and goes back to Pending for review).
 if(!contact.created)await hubspot(`/crm/v3/objects/contacts/${contact.id}`,{method:'PATCH',body:{properties:wishlist}});
 const reference=await publicId(contact.id,env.WISHLIST_ID_SALT||'belmazad-wishlist');
 recent.set(key,{at:Date.now(),ref:reference});

 const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]!);
 const link=`https://app-eu1.hubspot.com/contacts/143644884/record/0-1/${contact.id}`;
 await createTeamCallTasks(`${taskTag(r)} Review new buyer request ${reference} – ${en(r.type)} · ${r.locations.map(en).join(' / ')}`,
  `<p><strong>A buyer submitted a request on belmazad.com.</strong> Review it in the website admin (Buyers → Pending), then approve, request changes or reject. It is not public until approved.</p>`+brokerLine(r)+
  `<p><strong>Buyer</strong><br>Name: ${esc(r.name)}<br>Mobile: +20${mobile}<br>Contact: <a href="${link}">${link}</a>${contact.created?' (new contact)':' (existing contact, wishlist updated)'}</p>`+
  `<p><strong>Request</strong><br>${esc(summary).replace(/\n/g,'<br>')}</p>`,[contact.id],[],'TODO');
 invalidateWishlist();
 return {status:'created',reference};
}
