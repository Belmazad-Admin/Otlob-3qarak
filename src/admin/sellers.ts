// Server-only: data and actions for the admin "Sellers" section (offers and "keep looking" requests).
import {hubspot} from '../hubspot/client';
import {getWishlist} from '../hubspot/feed';
import {OFFER_PROPERTIES,dealUrl,offerPipeline,type OfferDeal} from '../hubspot/offers';
import {createTeamCallTasks} from '../hubspot/sellerResponse';
import {contactUrl} from './buyers';
import {label} from '../content';

export class OfferError extends Error{}

async function people(ids:string[]){
 const out=new Map<string,{name:string;phone:string}>();
 const unique=[...new Set(ids.filter(Boolean))];
 for(let i=0;i<unique.length;i+=100){
  const r=await hubspot<{results:{id:string;properties:{firstname?:string|null;lastname?:string|null;phone?:string|null}}[]}>('/crm/v3/objects/contacts/batch/read',{method:'POST',body:{inputs:unique.slice(i,i+100).map(id=>({id})),properties:['firstname','lastname','phone']}});
  for(const c of r.results)out.set(c.id,{name:[c.properties.firstname,c.properties.lastname].filter(Boolean).join(' ')||'—',phone:c.properties.phone||''});
 }
 return out;
}

export async function listOffers(){
 const pipeline=await offerPipeline();
 if(!pipeline)return {ready:false as const,stages:[],offers:[]};
 const deals:OfferDeal[]=[];let after:string|undefined;
 for(let page=0;page<10;page++){
  const r=await hubspot<{results:OfferDeal[];paging?:{next?:{after:string}}}>('/crm/v3/objects/deals/search',{method:'POST',body:{
   filterGroups:[{filters:[{propertyName:'pipeline',operator:'EQ',value:pipeline.id}]}],properties:OFFER_PROPERTIES,sorts:[{propertyName:'createdate',direction:'DESCENDING'}],limit:100,...(after?{after}:{})}});
  deals.push(...r.results);after=r.paging?.next?.after;if(!after)break;}
 const who=await people(deals.flatMap(d=>[d.properties.website_seller_contact_id||'',d.properties.website_buyer_contact_id||'']));
 const w=await getWishlist();
 const byRef=new Map(w.entries.map(e=>[e.demand.id,e.demand]));
 return {ready:true as const,stages:pipeline.stages,offers:deals.map(d=>{
  const p=d.properties,sellerId=p.website_seller_contact_id||'',buyerId=p.website_buyer_contact_id||'',request=p.website_request_ref?byRef.get(p.website_request_ref):undefined;
  return {id:d.id,hubspotUrl:dealUrl(d.id),kind:p.website_offer_kind==='keep_looking'?'keep_looking':'offer',createdAt:p.createdate,updatedAt:p.hs_lastmodifieddate,
   stageId:p.dealstage,stage:pipeline.stages.find(s=>s.id===p.dealstage)?.label??p.dealstage,
   seller:{id:sellerId,url:sellerId?contactUrl(sellerId):'',...(who.get(sellerId)??{name:'—',phone:''})},
   buyer:buyerId?{id:buyerId,url:contactUrl(buyerId),name:who.get(buyerId)?.name??'—'}:null,
   request:p.website_request_ref?{ref:p.website_request_ref,summary:request?`${label(request.type,'en')} · ${request.locations.map(l=>label(l,'en')).join(' / ')}`:'(no longer public)'}:null,
   property:p.website_offer_property||'',area:Number(p.website_offer_area)||0,price:Number(p.amount)||0,details:p.website_offer_details||'',notes:p.website_team_notes||'',brokerCompany:p.website_broker_company||''};
 })};
}

export async function updateOffer(id:string,input:{stageId?:string;notes?:string}){
 const pipeline=await offerPipeline();if(!pipeline)throw new OfferError('pipeline');
 const props:Record<string,string>={};
 if(input.stageId!==undefined){if(!pipeline.stages.some(s=>s.id===input.stageId))throw new OfferError('stage');props.dealstage=input.stageId;}
 if(input.notes!==undefined)props.website_team_notes=String(input.notes).slice(0,5000);
 if(!Object.keys(props).length)throw new OfferError('empty');
 await hubspot(`/crm/v3/objects/deals/${id}`,{method:'PATCH',body:{properties:props}});
}

export async function followUpOffer(id:string,note:string,reviewer:string){
 const text=note.trim().slice(0,2000);if(text.length<3)throw new OfferError('note');
 const deal=await hubspot<OfferDeal>(`/crm/v3/objects/deals/${id}?properties=${OFFER_PROPERTIES.join(',')}`);
 const p=deal.properties,contacts=[p.website_seller_contact_id,p.website_buyer_contact_id].filter((x):x is string=>!!x);
 const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]!);
 await createTeamCallTasks(`[Website] Follow up: ${p.dealname??'seller offer'}`.slice(0,250),`<p><strong>Follow-up on a website seller offer.</strong></p><p>${esc(text).replace(/\r?\n/g,'<br>')}</p><p>Created by ${esc(reviewer)} from the belmazad admin. Deal: <a href="${dealUrl(id)}">${dealUrl(id)}</a></p>`,contacts,[{to:{id},types:[{associationCategory:'HUBSPOT_DEFINED',associationTypeId:216}]}]);
}
