// One-time, re-runnable HubSpot setup for the website admin (skips anything that already exists).
// Creates: contact property group "belmazad website", listing-status + public-field contact properties,
// and the "Website seller offers" deal pipeline.
// Run: node scripts/hubspot-setup.mjs   (reads HUBSPOT_ACCESS_TOKEN from .dev.vars or the environment)
import {readFileSync} from 'node:fs';
import {labels} from '../src/content.ts';
import {propertyTypes,areas,features,governorates} from '../src/data.ts';

const fromFile=()=>{try{return readFileSync(new URL('../.dev.vars',import.meta.url),'utf8').split(/\r?\n/).find(l=>l.startsWith('HUBSPOT_ACCESS_TOKEN='))?.slice(21).trim();}catch{return undefined;}};
const token=process.env.HUBSPOT_ACCESS_TOKEN||fromFile();
if(!token)throw new Error('HUBSPOT_ACCESS_TOKEN is not set');

async function hs(path,body,method=body?'POST':'GET'){
 const res=await fetch(`https://api.hubapi.com${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const text=await res.text();let data;try{data=JSON.parse(text);}catch{data=text;}
 return {status:res.status,data};
}
const en=key=>labels[key]?.[1]||key;
const options=keys=>keys.map((value,i)=>({label:en(value),value,displayOrder:i,hidden:false}));

const GROUP='belmazad_website';
const locationKeys=[...new Set([...areas,...Object.keys(governorates),...Object.keys(labels).filter(k=>k.startsWith('gov_'))])];
const featureKeys=[...new Set([...features,'licensed','cash','utilities','groundFloor','partnership','companyOwned'])];
const PROPERTIES=[
 {name:'website_listing_status',label:'Website listing status',type:'enumeration',fieldType:'select',description:'Whether this buyer request is shown on belmazad.com. Only Approved requests are public.',
  options:[['pending','Pending'],['approved','Approved'],['changes_requested','Changes requested'],['rejected','Rejected']].map(([value,label],i)=>({label,value,displayOrder:i,hidden:false}))},
 {name:'website_request_source',label:'Website request source',type:'enumeration',fieldType:'select',description:'Set when the buyer request was submitted through the belmazad.com wizard.',options:[{label:'belmazad.com wizard',value:'website',displayOrder:0,hidden:false}]},
 {name:'website_listing_comment',label:'Website listing comment',type:'string',fieldType:'textarea',description:'Team comment for the last approval decision (rejection reason or requested changes). Never shown publicly.'},
 {name:'website_listing_reviewed_by',label:'Website listing reviewed by',type:'string',fieldType:'text',description:'Team member who made the last approval decision.'},
 {name:'website_listing_reviewed_at',label:'Website listing reviewed at',type:'datetime',fieldType:'date',description:'When the last approval decision was made.'},
 {name:'website_public_type',label:'Website public type',type:'enumeration',fieldType:'select',description:'Property type shown on the public post (overrides automatic mapping).',options:options(propertyTypes)},
 {name:'website_public_locations',label:'Website public locations',type:'enumeration',fieldType:'checkbox',description:'Locations shown on the public post (overrides automatic parsing).',options:options(locationKeys)},
 {name:'website_public_size_min',label:'Website public area min (m²)',type:'number',fieldType:'number',description:'Minimum area shown on the public post.'},
 {name:'website_public_size_max',label:'Website public area max (m²)',type:'number',fieldType:'number',description:'Maximum area shown on the public post.'},
 {name:'website_public_budget_min',label:'Website public budget min (EGP)',type:'number',fieldType:'number',description:'Minimum budget shown on the public post.'},
 {name:'website_public_budget_max',label:'Website public budget max (EGP)',type:'number',fieldType:'number',description:'Maximum budget shown on the public post.'},
 {name:'website_public_features',label:'Website public requirements',type:'enumeration',fieldType:'checkbox',description:'Requirement chips shown on the public post (overrides automatic parsing).',options:options(featureKeys)}];
const PIPELINE={label:'Website seller offers',displayOrder:99,stages:[
 {label:'New offer',displayOrder:0,metadata:{probability:'0.1'}},{label:'Contacted',displayOrder:1,metadata:{probability:'0.2'}},{label:'Viewing',displayOrder:2,metadata:{probability:'0.4'}},
 {label:'Negotiating',displayOrder:3,metadata:{probability:'0.6'}},{label:'Won',displayOrder:4,metadata:{probability:'1.0'}},{label:'Rejected',displayOrder:5,metadata:{probability:'0.0'}}]};

const DEAL_PROPERTIES=[
 {name:'website_offer_kind',label:'Website offer kind',type:'enumeration',fieldType:'select',description:'Offer on a buyer request, or "let us keep looking" (no match yet).',options:[['offer','Offer on a buyer request'],['keep_looking','Let us keep looking']].map(([value,label],i)=>({label,value,displayOrder:i,hidden:false}))},
 {name:'website_request_ref',label:'Website buyer request ref',type:'string',fieldType:'text',description:'Public BM- reference of the buyer request the seller responded to.'},
 {name:'website_buyer_contact_id',label:'Website buyer contact ID',type:'string',fieldType:'text',description:'HubSpot ID of the buyer contact.'},
 {name:'website_seller_contact_id',label:'Website seller contact ID',type:'string',fieldType:'text',description:'HubSpot ID of the seller contact.'},
 {name:'website_offer_property',label:'Website offer property',type:'string',fieldType:'text',description:'Type and location of the seller\'s property.'},
 {name:'website_offer_area',label:'Website offer area (m²)',type:'number',fieldType:'number',description:'Area of the seller\'s property.'},
 {name:'website_offer_details',label:'Website offer details',type:'string',fieldType:'textarea',description:'Details the seller wrote on the website.'},
 {name:'website_broker_company',label:'Website broker company',type:'string',fieldType:'text',description:'Brokerage name, when the offer was submitted by a broker.'},
 {name:'website_team_notes',label:'Website team notes',type:'string',fieldType:'textarea',description:'Notes from the belmazad admin.'},
 {name:'website_dedupe_key',label:'Website duplicate-check key',type:'string',fieldType:'text',description:'Internal key used to prevent duplicate offers.'}];

const report=[];
async function ensure(objectType,props){
 const group=await hs(`/crm/v3/properties/${objectType}/groups/${GROUP}`);
 if(group.status===200)report.push([`${objectType} group`,GROUP,'exists']);
 else{const r=await hs(`/crm/v3/properties/${objectType}/groups`,{name:GROUP,label:'belmazad website',displayOrder:-1});report.push([`${objectType} group`,GROUP,r.status===201?'created':`FAILED ${r.status} ${JSON.stringify(r.data).slice(0,200)}`]);}
 for(const p of props){
  const got=await hs(`/crm/v3/properties/${objectType}/${p.name}`);
  if(got.status===200){report.push([objectType,p.name,'exists']);continue;}
  const r=await hs(`/crm/v3/properties/${objectType}`,{...p,groupName:GROUP});
  report.push([objectType,p.name,r.status===201?'created':`FAILED ${r.status} ${JSON.stringify(r.data).slice(0,200)}`]);
 }
}
await ensure('contacts',PROPERTIES);
await ensure('deals',DEAL_PROPERTIES);
const pipes=await hs('/crm/v3/pipelines/deals');
const existing=pipes.data?.results?.find(x=>x.label===PIPELINE.label);
if(existing)report.push(['pipeline',PIPELINE.label,`exists (id ${existing.id})`]);
else{const r=await hs('/crm/v3/pipelines/deals',PIPELINE);report.push(['pipeline',PIPELINE.label,r.status===201?`created (id ${r.data.id})`:`FAILED ${r.status} ${JSON.stringify(r.data).slice(0,300)}`]);}
for(const [kind,name,result] of report)console.log(kind.padEnd(15),name.padEnd(30),result);
