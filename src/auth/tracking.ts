// Server-only: an account's submissions with their current status from HubSpot, for "My account" and the admin.
// Buyer requests: the newest request per HubSpot contact carries that contact's website_listing_status; older ones were
// replaced (HubSpot keeps one wishlist per contact). Offers and "keep looking": the stage of their deal.
import {desc,eq,inArray} from 'drizzle-orm';
import {getDb} from '@/db';
import {submissions,type Submission} from '@/db/schema';
import {hubspot,hubspotConfigured} from '../hubspot/client';
import {offerPipeline} from '../hubspot/offers';

export type RequestStatus='pending'|'approved'|'changes_requested'|'rejected'|'replaced'|'unknown';
export type OfferStage='new'|'contacted'|'viewing'|'negotiating'|'closed'|'unknown';
export type TrackedSubmission={id:number;userId:number;kind:Submission['kind'];ref:string;createdAt:number;summary:Record<string,unknown>;
 status:RequestStatus|OfferStage;stageLabel:string;contactId:string|null;dealId:string|null};

async function batchRead(object:'contacts'|'deals',ids:string[],properties:string[]){
 const out=new Map<string,Record<string,string|null>>();
 const unique=[...new Set(ids)];
 for(let i=0;i<unique.length;i+=100){
  const r=await hubspot<{results:{id:string;properties:Record<string,string|null>}[]}>(`/crm/v3/objects/${object}/batch/read`,{method:'POST',body:{inputs:unique.slice(i,i+100).map(id=>({id})),properties}});
  for(const x of r.results)out.set(x.id,x.properties);
 }
 return out;
}
// HubSpot stage labels (pipeline "Website seller offers") → the simpler steps shown to sellers.
const stageKey=(label:string,closed:boolean):OfferStage=>{const l=label.toLowerCase();return closed||/won|lost|reject|closed/.test(l)?'closed':l.includes('contact')?'contacted':l.includes('view')?'viewing':l.includes('negotiat')?'negotiating':'new';};

export async function track(rows:Submission[]):Promise<TrackedSubmission[]>{
 const latestPerContact=new Map<string,number>();
 for(const r of [...rows].sort((a,b)=>b.createdAt-a.createdAt))if(r.kind==='buyer_request'&&r.hubspotContactId&&!latestPerContact.has(r.hubspotContactId))latestPerContact.set(r.hubspotContactId,r.id);
 let contacts=new Map<string,Record<string,string|null>>(),deals=new Map<string,Record<string,string|null>>(),stages:{id:string;label:string;closed:boolean}[]=[];
 if(hubspotConfigured()&&rows.length){
  try{
   contacts=await batchRead('contacts',[...latestPerContact.keys()],['website_listing_status']);
   const dealIds=rows.map(r=>r.hubspotDealId).filter((x):x is string=>!!x);
   if(dealIds.length){deals=await batchRead('deals',dealIds,['dealstage']);stages=(await offerPipeline())?.stages??[];}
  }catch(error){console.error('track:',error instanceof Error?error.message:error);}
 }
 return rows.map(r=>{
  let status:TrackedSubmission['status']='unknown',stageLabel='';
  if(r.kind==='buyer_request'){
   if(r.hubspotContactId&&latestPerContact.get(r.hubspotContactId)!==r.id)status='replaced';
   else{const s=r.hubspotContactId?contacts.get(r.hubspotContactId)?.website_listing_status:null;if(s==='pending'||s==='approved'||s==='changes_requested'||s==='rejected')status=s;}
  }else if(r.hubspotDealId){
   const id=deals.get(r.hubspotDealId)?.dealstage,stage=stages.find(s=>s.id===id);
   if(stage){status=stageKey(stage.label,stage.closed);stageLabel=stage.label;}
  }
  let summary:Record<string,unknown>={};try{summary=JSON.parse(r.summaryJson);}catch{}
  return {id:r.id,userId:r.userId,kind:r.kind,ref:r.ref,createdAt:r.createdAt,summary,status,stageLabel,contactId:r.hubspotContactId,dealId:r.hubspotDealId};
 });
}

export async function submissionsOf(userIds:number[]){
 if(!userIds.length)return [];
 return getDb().select().from(submissions).where(userIds.length===1?eq(submissions.userId,userIds[0]):inArray(submissions.userId,userIds)).orderBy(desc(submissions.createdAt)).all();
}
