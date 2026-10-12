import {hubspotConfigured} from '@/src/hubspot/client';
import {InputError,submitSellerResponse,validate} from '@/src/hubspot/sellerResponse';
import {recordSubmission,userRoute} from '@/src/auth/accounts';

// A seller answers a live buyer request (signed-in account required): creates HubSpot tasks for the sales team
// (see src/hubspot/sellerResponse.ts). Name, mobile and broker details come from the account.
export const POST=userRoute(async(request,user)=>{
 if(!hubspotConfigured())return Response.json({status:'unconfigured'},{status:503});
 let input;
 try{input=validate({...await request.json() as Record<string,unknown>,name:user.name,phone:'0'+user.phone,broker:user.isBroker,company:user.company});}
 catch(error){return Response.json({status:'invalid',field:error instanceof InputError?error.message:'body'},{status:400});}
 try{
  const result=await submitSellerResponse({...input,email:user.email});
  if(result.status==='created')await recordSubmission(user,{kind:'offer',ref:input.requestId,contactId:result.contactId,dealId:result.dealId,
   summary:{requestId:input.requestId,size:input.size,price:input.price,details:input.details}})
   .catch(error=>console.error('seller-response: not recorded on account',error instanceof Error?error.message:error));
  return Response.json({status:result.status});
 }catch(error){
  if(error instanceof InputError)return Response.json({status:'invalid',field:error.message},{status:400});
  console.error('seller-response:',error instanceof Error?error.message:error);
  return Response.json({status:'error'},{status:502});
 }
});
