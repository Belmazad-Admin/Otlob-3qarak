import {hubspotConfigured} from '@/src/hubspot/client';
import {InputError} from '@/src/hubspot/sellerResponse';
import {submitBuyerRequest,validateBuyerRequest} from '@/src/hubspot/buyerRequest';

// Buyer wizard "انشر طلبي": HubSpot contact (Pending) + review task. Public only after approval in /admin.
export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin&&new URL(origin).host!==new URL(request.url).host)return Response.json({status:'forbidden'},{status:403});
 if(!hubspotConfigured())return Response.json({status:'unconfigured'},{status:503});
 let input;
 try{input=validateBuyerRequest(await request.json());}
 catch(error){return Response.json({status:'invalid',field:error instanceof InputError?error.message:'body'},{status:400});}
 try{return Response.json(await submitBuyerRequest(input));}
 catch(error){console.error('buyer-request:',error instanceof Error?error.message:error);return Response.json({status:'error'},{status:502});}
}
