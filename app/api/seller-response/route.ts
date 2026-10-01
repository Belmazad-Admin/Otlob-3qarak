import {hubspotConfigured} from '@/src/hubspot/client';
import {InputError,submitSellerResponse,validate} from '@/src/hubspot/sellerResponse';

// A seller answers a live buyer request: creates HubSpot tasks for the sales team (see src/hubspot/sellerResponse.ts).
export async function POST(request:Request){
 if(!hubspotConfigured())return Response.json({status:'unconfigured'},{status:503});
 let input;
 try{input=validate(await request.json());}
 catch(error){return Response.json({status:'invalid',field:error instanceof InputError?error.message:'body'},{status:400});}
 try{
  const {status}=await submitSellerResponse(input);
  return Response.json({status});
 }catch(error){
  if(error instanceof InputError)return Response.json({status:'invalid',field:error.message},{status:400});
  console.error('seller-response:',error instanceof Error?error.message:error);
  return Response.json({status:'error'},{status:502});
 }
}
