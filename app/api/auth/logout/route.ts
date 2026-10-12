import {clearCookie,endSession,sameOrigin} from '@/src/auth/accounts';

// POST: sign out this browser (the session is deleted, not just the cookie).
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({status:'forbidden'},{status:403});
 await endSession(request).catch(error=>console.error('logout:',error instanceof Error?error.message:error));
 return Response.json({status:'ok'},{headers:{'cache-control':'no-store','set-cookie':clearCookie}});
}
