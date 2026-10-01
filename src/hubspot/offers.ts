// Server-only: seller offers as deals in the HubSpot pipeline "Website seller offers" (created by scripts/hubspot-setup.mjs).
// One deal per offer on a buyer request, or per "let us keep looking" request. The admin "Sellers" section reads these.
import {hubspot} from './client';

export const OFFER_PIPELINE='Website seller offers';
const PORTAL='143644884';
export const dealUrl=(id:string)=>`https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-3/${id}`;
const DEAL_TO_CONTACT=3,TASK_TO_DEAL=216;
export const OFFER_PROPERTIES=['dealname','dealstage','amount','createdate','hs_lastmodifieddate','website_offer_kind','website_request_ref','website_buyer_contact_id','website_seller_contact_id','website_offer_property','website_offer_area','website_offer_details','website_team_notes','website_broker_company'] as const;
export type OfferDeal={id:string;properties:Partial<Record<typeof OFFER_PROPERTIES[number],string|null>>};

let pipelineCache:{at:number;id:string;stages:{id:string;label:string;closed:boolean}[]}|null=null;
export async function offerPipeline(){
 if(pipelineCache&&Date.now()-pipelineCache.at<10*60_000)return pipelineCache;
 const r=await hubspot<{results:{id:string;label:string;stages:{id:string;label:string;displayOrder:number;metadata:{isClosed?:string}}[]}[]}>('/crm/v3/pipelines/deals');
 const p=r.results.find(x=>x.label===OFFER_PIPELINE);
 if(!p)return null;
 pipelineCache={at:Date.now(),id:p.id,stages:[...p.stages].sort((a,b)=>a.displayOrder-b.displayOrder).map(s=>({id:s.id,label:s.label,closed:s.metadata?.isClosed==='true'}))};
 return pipelineCache;
}

export type NewOffer={kind:'offer'|'keep_looking';key:string;requestRef?:string;buyerId?:string;sellerId:string;sellerName:string;brokerCompany?:string;property:string;area:number;price:number;details:string};
// Returns the deal's task association, or [] if the pipeline is not set up yet (tasks are still created).
export async function createOfferDeal(o:NewOffer){
 try{
  const p=await offerPipeline();if(!p)return [];
  const deal=await hubspot<{id:string}>('/crm/v3/objects/deals',{method:'POST',body:{
   properties:{dealname:`${o.kind==='offer'?`Offer on ${o.requestRef}`:'Keep looking'} – ${o.property} – ${o.sellerName}${o.brokerCompany?` (broker, ${o.brokerCompany})`:''}`.slice(0,250),website_broker_company:o.brokerCompany??'',pipeline:p.id,dealstage:p.stages[0].id,amount:String(o.price),
    website_offer_kind:o.kind,website_request_ref:o.requestRef??'',website_buyer_contact_id:o.buyerId??'',website_seller_contact_id:o.sellerId,website_offer_property:o.property,website_offer_area:String(o.area),website_offer_details:o.details,website_dedupe_key:o.key},
   associations:[...new Set([o.sellerId,o.buyerId].filter((x):x is string=>!!x))].map(id=>({to:{id},types:[{associationCategory:'HUBSPOT_DEFINED',associationTypeId:DEAL_TO_CONTACT}]}))}});
  return [{to:{id:deal.id},types:[{associationCategory:'HUBSPOT_DEFINED',associationTypeId:TASK_TO_DEAL}]}];
 }catch(error){console.error('offer deal not created:',error instanceof Error?error.message:error);return [];}
}
