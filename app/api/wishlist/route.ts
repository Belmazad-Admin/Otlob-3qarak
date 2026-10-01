import {hubspotConfigured} from '@/src/hubspot/client';
import {getWishlist} from '@/src/hubspot/feed';

// Public, anonymised Buyer Wishlist feed built from HubSpot contacts.
// The HubSpot token stays on the server; the browser only ever receives Demand objects.
export async function GET(){
 if(!hubspotConfigured())return Response.json({source:'unconfigured',requests:[]},{status:503});
 try{
  const {at,requests,stale}=await getWishlist();
  return Response.json({source:'hubspot',updatedAt:new Date(at).toISOString(),requests,...(stale?{stale}:{})},{headers:{'cache-control':'public, max-age=30'}});
 }catch(error){
  console.error('wishlist:',error instanceof Error?error.message:error);
  return Response.json({source:'error',requests:[]},{status:502});
 }
}
