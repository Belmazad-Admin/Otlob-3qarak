import {currentUser,publicUser} from '@/src/auth/accounts';

// GET: the signed-in account ({user:null} when signed out).
export async function GET(request:Request){
 const user=await currentUser(request).catch(error=>{console.error('me:',error instanceof Error?error.message:error);return null;});
 return Response.json({user:user?publicUser(user):null},{headers:{'cache-control':'no-store'}});
}
