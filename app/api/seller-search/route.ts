import {hubspotConfigured} from '@/src/hubspot/client';
import {InputError,submitSellerSearch,validateSearch} from '@/src/hubspot/sellerResponse';

// "خلّينا ندوّرلك / Let us keep looking": a seller with no matching request asks the team to keep looking.
export async function POST(request:Request){
 if(!hubspotConfigured())return Response.json({status:'unconfigured'},{status:503});
 let input;
 try{input=validateSearch(await request.json());}
 catch(error){return Response.json({status:'invalid',field:error instanceof InputError?error.message:'body'},{status:400});}
 try{
  const {status}=await submitSellerSearch(input);
  return Response.json({status});
 }catch(error){
  console.error('seller-search:',error instanceof Error?error.message:error);
  return Response.json({status:'error'},{status:502});
 }
}
