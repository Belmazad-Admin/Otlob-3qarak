import {changePassword,userRoute} from '@/src/auth/accounts';

// Signed-in only. POST {current,password}: change the password; other devices are signed out.
export const POST=userRoute(async(request,user)=>{
 const body=await request.json().catch(()=>({})) as Record<string,unknown>;
 const cookie=await changePassword(user,body,request);
 return Response.json({status:'ok'},{headers:{'set-cookie':cookie}});
});
