import {hubspotConfigured} from '@/src/hubspot/client';
import {InputError} from '@/src/hubspot/sellerResponse';
import {submitBuyerRequest,validateBuyerRequest} from '@/src/hubspot/buyerRequest';
import {recordSubmission,userRoute} from '@/src/auth/accounts';

// Buyer wizard "انشر طلبي" (signed-in account required): HubSpot contact (Pending) + review task. Public only after
// approval in /admin. Name, mobile and broker details come from the account, never from the request body.
export const POST=userRoute(async(request,user)=>{
 if(!hubspotConfigured())return Response.json({status:'unconfigured'},{status:503});
 let input;
 try{input=validateBuyerRequest({...await request.json() as Record<string,unknown>,name:user.name,phone:'0'+user.phone,broker:user.isBroker,company:user.company});}
 catch(error){return Response.json({status:'invalid',field:error instanceof InputError?error.message:'body'},{status:400});}
 try{
  const result=await submitBuyerRequest(input,user.email);
  if(result.status==='created')await recordSubmission(user,{kind:'buyer_request',ref:result.reference,contactId:result.contactId,
   summary:{type:input.type,locations:input.locations,sizeMin:input.sizeMin,sizeMax:input.sizeMax,budgetMin:input.budgetMin,budgetMax:input.budgetMax,features:input.features,bedrooms:input.bedrooms,bathrooms:input.bathrooms,notes:input.notes}})
   .catch(error=>console.error('buyer-request: not recorded on account',error instanceof Error?error.message:error));
  return Response.json({status:result.status,reference:result.reference});
 }catch(error){console.error('buyer-request:',error instanceof Error?error.message:error);return Response.json({status:'error'},{status:502});}
});
