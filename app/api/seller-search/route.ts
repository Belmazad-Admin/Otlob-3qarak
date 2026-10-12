import {hubspotConfigured} from '@/src/hubspot/client';
import {InputError,submitSellerSearch,validateSearch} from '@/src/hubspot/sellerResponse';
import {recordSubmission,userRoute} from '@/src/auth/accounts';

// "خلّينا ندوّرلك / Let us keep looking" (signed-in account required): a seller with no matching request asks the
// team to keep looking. Name, mobile and broker details come from the account.
export const POST=userRoute(async(request,user)=>{
 if(!hubspotConfigured())return Response.json({status:'unconfigured'},{status:503});
 let input;
 try{input=validateSearch({...await request.json() as Record<string,unknown>,name:user.name,phone:'0'+user.phone,broker:user.isBroker,company:user.company});}
 catch(error){return Response.json({status:'invalid',field:error instanceof InputError?error.message:'body'},{status:400});}
 try{
  const result=await submitSellerSearch({...input,email:user.email});
  if(result.status==='created')await recordSubmission(user,{kind:'keep_looking',ref:'',contactId:result.contactId,dealId:result.dealId,
   summary:{type:input.type,location:input.location,size:input.size,price:input.price,bedrooms:input.bedrooms,bathrooms:input.bathrooms,features:input.features,details:input.details}})
   .catch(error=>console.error('seller-search: not recorded on account',error instanceof Error?error.message:error));
  return Response.json({status:result.status});
 }catch(error){
  console.error('seller-search:',error instanceof Error?error.message:error);
  return Response.json({status:'error'},{status:502});
 }
});
