import {publicUser,updateProfile,userRoute} from '@/src/auth/accounts';
import {submissionsOf,track} from '@/src/auth/tracking';

// Signed-in buyer/seller only. GET: profile + their requests and offers with current status. PATCH: update profile.
// HubSpot record IDs stay on the server.
export const GET=userRoute(async(_request,user)=>{
 const items=(await track(await submissionsOf([user.id]))).map(i=>({id:i.id,kind:i.kind,ref:i.ref,createdAt:i.createdAt,summary:i.summary,status:i.status}));
 return Response.json({user:publicUser(user),joinedAt:user.createdAt,items});
});
export const PATCH=userRoute(async(request,user)=>{
 const body=await request.json().catch(()=>({})) as Record<string,unknown>;
 return Response.json({status:'ok',user:publicUser(await updateProfile(user,body))});
});
