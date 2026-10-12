import {AuthError,publicUser,sameOrigin,signIn} from '@/src/auth/accounts';

// POST {email,password}: sign in. 5 failures for an e-mail (30 for an IP) lock sign-in for 15 minutes.
const noStore={'cache-control':'no-store'};
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({status:'forbidden'},{status:403,headers:noStore});
 const body=await request.json().catch(()=>({})) as Record<string,unknown>;
 try{
  const {user,cookie}=await signIn(body,request);
  return Response.json({status:'ok',user:publicUser(user)},{headers:{...noStore,'set-cookie':cookie}});
 }catch(error){
  if(error instanceof AuthError)return Response.json({status:error.message},{status:error.message==='locked'?429:401,headers:noStore});
  console.error('login:',error instanceof Error?error.message:error);return Response.json({status:'error'},{status:502,headers:noStore});
 }
}
