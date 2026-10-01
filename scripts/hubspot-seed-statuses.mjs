// One-time: give existing Buyer Wishlist contacts a website listing status (only those that have none yet).
//   - the 5 newest otherwise-publishable requests → Pending (to test approvals)
//   - other publishable requests               → Approved (the feed stays as it was)
//   - auto-excluded (seller/broker/rental)     → Rejected, with the reason as comment
// Run after scripts/hubspot-setup.mjs:  node scripts/hubspot-seed-statuses.mjs [--dry-run]
import {readFileSync} from 'node:fs';
import {isPublishable,WISHLIST_SOURCE} from '../src/hubspot/wishlist.ts';

const fromFile=()=>{try{return readFileSync(new URL('../.dev.vars',import.meta.url),'utf8').split(/\r?\n/).find(l=>l.startsWith('HUBSPOT_ACCESS_TOKEN='))?.slice(21).trim();}catch{return undefined;}};
const token=process.env.HUBSPOT_ACCESS_TOKEN||fromFile();
if(!token)throw new Error('HUBSPOT_ACCESS_TOKEN is not set');
const dry=process.argv.includes('--dry-run');
const hs=async(path,body)=>{const r=await fetch(`https://api.hubapi.com${path}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(`${path} ${r.status} ${(await r.text()).slice(0,300)}`);return r.json();};

const contacts=[];let after;
do{const r=await hs('/crm/v3/objects/contacts/search',{filterGroups:[{filters:[{propertyName:'hs_object_source_detail_1',operator:'EQ',value:WISHLIST_SOURCE}]}],
 properties:['property_type','property_subtype','budget__maximum_','additional_requirments','user_type','createdate','website_listing_status'],sorts:[{propertyName:'createdate',direction:'DESCENDING'}],limit:100,...(after?{after}:{})});
 contacts.push(...r.results);after=r.paging?.next?.after;}while(after);

const unset=contacts.filter(c=>!c.properties.website_listing_status);
let pendingLeft=5;const updates=[];
for(const c of unset){
 const p=c.properties;let status,comment='';
 if(!isPublishable(c)){status='rejected';comment=p.user_type==='Seller'||p.user_type==='Broker'?`Auto-excluded: user type is ${p.user_type}`:p.budget__maximum_==='Rental'?'Auto-excluded: rental budget':'Auto-excluded: note mentions broker, rent or lease';}
 else if(pendingLeft>0){status='pending';pendingLeft--;}
 else status='approved';
 updates.push({id:c.id,properties:{website_listing_status:status,website_listing_comment:comment,website_listing_reviewed_by:status==='pending'?'':'Initial import',website_listing_reviewed_at:status==='pending'?'':new Date().toISOString()}});
}
const count=s=>updates.filter(u=>u.properties.website_listing_status===s).length;
console.log(`${contacts.length} wishlist contacts, ${unset.length} without status → pending ${count('pending')}, approved ${count('approved')}, rejected ${count('rejected')}`);
if(dry)console.log('dry run: nothing written');
else{for(let i=0;i<updates.length;i+=100)await hs('/crm/v3/objects/contacts/batch/update',{inputs:updates.slice(i,i+100)});console.log('done');}
