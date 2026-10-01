// Server-only: turns HubSpot "Buyer Wishlist" contacts into anonymised public feed posts.
// Only whitelisted, structured values leave this module. Names, phone numbers, e-mails,
// owners, lead status and the raw staff note are never returned.
import type {Demand} from '../data';

export const WISHLIST_SOURCE = 'Buyer Wishlist Form';
// Team-controlled fields (created by scripts/hubspot-setup.mjs). Only "approved" requests are public;
// website_public_* values, when filled in by the team, replace the automatic mapping below.
export const LISTING_PROPERTIES = ['website_listing_status','website_listing_comment','website_listing_reviewed_by','website_listing_reviewed_at','website_public_type','website_public_locations','website_public_size_min','website_public_size_max','website_public_budget_min','website_public_budget_max','website_public_features'] as const;
export const CONTACT_PROPERTIES = ['property_type','property_subtype','preferred_locations','secondary_preferred_locations','budget__maximum_','additional_requirments','user_type','createdate','lastmodifieddate','website_request_source',...LISTING_PROPERTIES] as const;
export type WishlistContact = {id:string;properties:Partial<Record<typeof CONTACT_PROPERTIES[number],string|null>>};
export type ListingStatus = 'pending'|'approved'|'changes_requested'|'rejected';
export const listingStatus = (c:WishlistContact):ListingStatus=>(['approved','changes_requested','rejected'] as const).find(s=>s===c.properties.website_listing_status)??'pending';

const FEDDAN = 4200;
const MILLION = 1_000_000;

// HubSpot subtype -> website property type. Falls back to the broad property_type.
const SUBTYPES:Record<string,string>={'Land Use':'land',Agricultural:'land','Horse Farm':'land',Factory:'factory',Warehouse:'warehouse',Storage:'warehouse','Cold Storage':'warehouse','Office Space':'office','Co-working Space':'office','Full Floor':'office','Half Floor':'office',Clinic:'office',Retail:'retail',Mall:'commercial','Shopping Center':'commercial',Villa:'villa',Townhouse:'villa','Twin house':'villa','Farm House':'villa',Apartment:'apartment',Studio:'apartment',Penthouse:'apartment',Duplex:'apartment','Serviced Apartment':'apartment',Chalet:'chalet',Cabana:'chalet',Building:'building','Whole Building':'building',Commercial:'commercial',Hotel:'commercial','Medical Facility':'commercial','Banquet Hall':'commercial','Gas Station (Banzeena)':'commercial','Mixed Use':'commercial',Touristic:'commercial','Special Purpose':'commercial'};
const TYPES:Record<string,string>={Land:'land',Industrial:'factory',Commercial:'commercial',Residential:'other'};
// Only for generic subtypes: the note's wording decides the specific type.
const GENERIC_SUBTYPES=['','Select Subtype','Other','Residential','Commercial'];
const NOTE_TYPES:[string,RegExp][]=[['villa',/villa|فيلا/],['apartment',/apartment|\bapt\b|شقة/],['retail',/\bshop\b|\bstore\b|محل/],['factory',/factory|مصنع/],['warehouse',/warehouse|storage|ma5zan|makhazan|مخزن/],['office',/office|administrative|مكتب|اداري/],['building',/building|مبنى|مبني|عمارة/],['land',/\bland\b|أرض|ارض/]];

// Known districts mentioned in staff notes, as [website area key, pattern].
const DISTRICTS:[string,RegExp][]=[
 ['gamalon',/gamalon|جمالون/],['hadayekoctober',/hada[iy]e?k\s*october|حدائق\s*[اأ]كتوبر/],['october',/\b(?:6(?:th)?\s*(?:of\s*)?)?october\b|[اأ]كتوبر/],['zayed',/\bzayed\b|زايد/],
 ['newcairo',/new\s*cairo|\bta[gm]+[ae]?[mg]?[oa]?u?3|التجمع|90th\s*road/],['heliopolis',/heliopolis|m[ai]sr\s*(?:el|l|al)?[\s-]*g[ei]?d[ie]?[dy]?[ae]?|nozaha?|nozha|مصر\s*الجديدة|شيراتون/],
 ['nasrcity',/nasr\s*city|madin[ae]?t\s*nasr|madint\s*nasr|مدينة\s*نصر/],['maadi',/maadi|المعادي/],['zamalek',/zamalek|الزمالك/],['dokki',/dokki|الدقي/],['mohandessin',/mohand[e]?s+[ei]?e?n|المهندسين|المهدسين/],
 ['shorouk',/sh[eo]r[ou]{1,2}[kq]/],['badr',/\bbadr\b/],['madinaty',/madin[ia]?ty|مدينتي/],['capital',/new\s*capital|العاصمة/],['shoubra',/shoubra|شبرا/],['haram',/\bahram\b|\bharam\b|الهرم/],
 ['tenthramadan',/10(?:th)?\s*(?:of\s*)?ramadan|el\s*asher|العاشر/],['belbeis',/belb[ei]i?s/],['coast',/north\s*coast|sahel|alam[e]?[ie]n|al\s*almeen|الساحل/],['sokhna',/sokhna|السخنة/],
 ['sahlhasheesh',/sahl\s*ha[hs]{1,2}[ie]{1,2}sh/],['somabay',/soma\s*bay/],['makadi',/makad[iy]/],['damanhour',/damanhour/],['mansoura',/mansoura/],['alex',/smouha/]];

// Requirement keywords -> feature keys shown as chips.
const FEATURES:[string,RegExp][]=[
 ['licensed',/licen[cs]e|licensed|ترخيص|رخصة/],['installments',/installments?|تقسيط|\bd\.?\/?p\b|down\s*payment/],['cash',/\bcash\b|كاش/],['ready',/ready\s*to\s*move|استلام\s*فوري/],
 ['finished',/finish(?:ed|ing)?|متشطب|تشطيب/],['parking',/parking|garage|جراج/],['compound',/compound|كمبوند/],['corner',/corner|ناصية/],['road',/main\s*road|شارع\s*رئيسي|على\s*شارع/],
 ['sea',/(?<!red\s)\bsea\b|بحر(?!\s*الأحمر)/],['utilities',/marafq|مرافق|كهربا|electricity|3\s*phase/],['groundFloor',/ground\s*floor|دور\s*أرضي/],['partnership',/partnership|مشاركة/],['companyOwned',/owned\s*by\s*(?:a\s*)?company/]];

const NEGATION=/(?:\bnot\b|\bno\b|\bmsh\b|مش|بدون|without|outside|out\s*of)\s*(?:\S+\s*){0,2}$/;
const EXCLUDE_NOTE=/broker|brok(?:e)?rage|بروكر|for\s*rent|\brent\b|lease|ايجار|إيجار/;

export function normalise(text:string){
 return text.toLowerCase()
  .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/(\d)[,٬](\d{3})/g,'$1$2').replace(/\s+/g,' ');
}
const found=(text:string,re:RegExp)=>{const g=new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g');for(const m of text.matchAll(g)){if(!NEGATION.test(text.slice(Math.max(0,m.index-25),m.index)))return true;}return false;};
const num=(v:string,k?:string)=>Number(v)*(k?1000:1);

const N=String.raw`(\d+(?:\.\d+)?)\s*(k)?`,SEP=String.raw`\s*(?:-|–|—|:|~|to|or|l|الى|إلى|او|أو)\s*`;
const AREA_UNIT=String.raw`(m2|m²|sqm|sq\s?m|meters?|metres?|mtrs?|متر|م2|م(?![؀-ۿ])|m(?![a-z]))`;
export function parseArea(text:string):[number,number]|null{
 const fed=new RegExp(`${N}(?:${SEP}${N})?\\s*(?:feddans?|fedans?|فدان|افدنة)`).exec(text);
 if(fed){const a=num(fed[1],fed[2])*FEDDAN,b=fed[3]?num(fed[3],fed[4])*FEDDAN:a;return ok(a,b);}
 for(const m of text.matchAll(new RegExp(`${N}(?:${SEP}${N})?\\s*${AREA_UNIT}`,'g'))){
  const a=num(m[1],m[2]),b=m[3]?num(m[3],m[4]):a,unit=m[5];
  // A bare "m" is ambiguous: small numbers or budget context mean millions, not metres.
  if(unit==='m'&&(Math.max(a,b)<100||/(?:budget|cash)\s*$/.test(text.slice(Math.max(0,m.index-12),m.index))))continue;
  const r=ok(a,b);if(r)return r;}
 const pre=new RegExp(`(?:area|space|size|مساحة|بمساحة)\\s*(?:of\\s*)?${N}(?:${SEP}${N})?`).exec(text);
 if(pre){const a=num(pre[1],pre[2]),b=pre[3]?num(pre[3],pre[4]):a;return ok(a,b);}
 return null;
 function ok(a:number,b:number):[number,number]|null{const lo=Math.min(a,b),hi=Math.max(a,b);return lo>=20&&hi<=50_000_000?[Math.round(lo),Math.round(hi)]:null;}
}

const MIL=String.raw`(million|milllion|millions|mil|mn|m(?![a-z²2])|مليون|ملايين)`;
export function parseBudget(text:string):[number,number]|null{
 const re=new RegExp(`${N}\\s*(?:${MIL})?(?:${SEP}${N})?\\s*${MIL}`,'g');
 for(const m of text.matchAll(re)){
  const after=text.slice(m.index+m[0].length,m.index+m[0].length+14),before=text.slice(Math.max(0,m.index-30),m.index);
  if(/^\s*(?:dollar|usd|\$|per|d\.?\/?p\b|down|مقدم)/.test(after)||/(?:rent|ايجار|إيجار|per\s*meter)\s*$/.test(before))continue;
  if(m[2]||m[5])continue; // "k" suffix = thousands (rent prices)
  const a=Number(m[1]),b=m[4]?Number(m[4]):a,unit=m[6];
  if(unit==='m'&&(Math.max(a,b)>500||!m[4]&&!/(?:budget|cash|total|average|averge|max(?:imum)?|between|under|below|from|of)\W*$/.test(before)))continue;
  const lo=Math.min(a,b),hi=Math.max(a,b);
  if(lo>=0.1&&hi<=5000)return [Math.round(lo*MILLION),Math.round(hi*MILLION)];}
 return null;
}

export function parseDistricts(text:string){
 const keys=DISTRICTS.filter(([,re])=>found(text,re)).map(([k])=>k);
 return keys.filter(k=>!(k==='october'&&(keys.includes('gamalon')||keys.includes('hadayekoctober'))));
}
export const parseFeatures=(text:string)=>FEATURES.filter(([,re])=>found(text,re)).map(([k])=>k);
export const govKey=(g:string)=>'gov_'+g.toLowerCase().replace(/[^a-z]/g,'');

const BANDS:Record<string,{key:string;min:number;max:number}>={'Under 5 million':{key:'band_under5',min:0,max:5*MILLION},'5 - 10 million':{key:'band_5_10',min:5*MILLION,max:10*MILLION},'10 - 50 million':{key:'band_10_50',min:10*MILLION,max:50*MILLION},'Above 50 million':{key:'band_above50',min:50*MILLION,max:0},Open:{key:'band_open',min:0,max:0}};

export async function publicId(contactId:string,salt:string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${salt}:${contactId}`));
 return 'BM-'+[...new Uint8Array(digest).slice(0,4)].map(b=>b.toString(36).padStart(2,'0')).join('').toUpperCase().slice(0,7);
}

export function isPublishable(c:WishlistContact){
 const p=c.properties;
 if(p.user_type==='Seller'||p.user_type==='Broker')return false;
 if(p.budget__maximum_==='Rental')return false;
 if(p.additional_requirments&&EXCLUDE_NOTE.test(normalise(p.additional_requirments)))return false;
 return !!(p.property_type||p.property_subtype);
}

export async function toDemand(c:WishlistContact,salt:string):Promise<Demand>{
 const p=c.properties,note=normalise(p.additional_requirments||'');
 const generic=GENERIC_SUBTYPES.includes(p.property_subtype||'');
 const type=(generic&&NOTE_TYPES.find(([,re])=>found(note,re))?.[0])||SUBTYPES[p.property_subtype||'']||TYPES[p.property_type||'']||'other';
 const districts=parseDistricts(note);
 const govs=[...new Set([p.preferred_locations,p.secondary_preferred_locations].filter((g):g is string=>!!g))].map(govKey);
 const band=BANDS[p.budget__maximum_||''];const area=parseArea(note);
 // Trust a figure from the note only when it agrees with the HubSpot budget band; notes also mention prices the buyer rejected.
 let budget=parseBudget(note);
 if(budget&&band&&band.key!=='band_open'&&(budget[1]<band.min*.8||(band.max&&budget[0]>band.max*1.2)))budget=null;
 const auto:Demand={id:await publicId(c.id,salt),type,locations:districts.length?districts:govs,
  min:budget?budget[0]:band?.min??0,max:budget?budget[1]:band?.max??0,approx:!!budget,band:band?.key,
  sizeMin:area?area[0]:0,sizeMax:area?area[1]:0,features:parseFeatures(note),posted:'',note:'',
  createdAt:p.createdate||undefined,updatedAt:p.lastmodifieddate||undefined,live:true};
 return applyOverrides(auto,c);
}

// Team edits from the admin (website_public_*) win over the automatic mapping, field by field.
const list=(v?:string|null)=>v?v.split(';').map(s=>s.trim()).filter(Boolean):[];
const numberOr=(v:string|null|undefined)=>v!=null&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
export function applyOverrides(d:Demand,c:WishlistContact):Demand{
 const p=c.properties,out={...d};
 if(p.website_public_type)out.type=p.website_public_type;
 if(list(p.website_public_locations).length)out.locations=list(p.website_public_locations);
 if(p.website_public_features!=null&&p.website_public_features!=='')out.features=list(p.website_public_features);
 const sMin=numberOr(p.website_public_size_min),sMax=numberOr(p.website_public_size_max);
 if(sMin!=null||sMax!=null){out.sizeMin=sMin??sMax!;out.sizeMax=sMax??sMin!;}
 const bMin=numberOr(p.website_public_budget_min),bMax=numberOr(p.website_public_budget_max);
 if(bMin!=null||bMax!=null){out.min=bMin??bMax!;out.max=bMax??bMin!;out.approx=true;}
 return out;
}
