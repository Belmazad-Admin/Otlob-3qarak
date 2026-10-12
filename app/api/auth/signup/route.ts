import {AuthError,publicUser,sameOrigin,signUp} from '@/src/auth/accounts';
import {InputError} from '@/src/hubspot/sellerResponse';

// POST {name,email,phone,password,broker,company}: create a buyer/seller account and sign in.
const noStore={'cache-control':'no-store'};
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({status:'forbidden'},{status:403,headers:noStore});
 const body=await request.json().catch(()=>({})) as Record<string,unknown>;
 try{
  const {user,cookie}=await signUp(body,request);
  return Response.json({status:'ok',user:publicUser(user)},{headers:{...noStore,'set-cookie':cookie}});
 }catch(error){
  if(error instanceof InputError)return Response.json({status:'invalid',field:error.message},{status:400,headers:noStore});
  if(error instanceof AuthError)return Response.json({status:error.message},{status:409,headers:noStore});
  console.error('signup:',error instanceof Error?error.message:error);return Response.json({status:'error'},{status:502,headers:noStore});
 }
}
