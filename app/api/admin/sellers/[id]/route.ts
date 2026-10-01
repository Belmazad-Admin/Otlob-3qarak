import {adminRoute} from '@/src/admin/auth';
import {followUpOffer,OfferError,updateOffer} from '@/src/admin/sellers';

// Team only. PATCH {stageId?, notes?}: move the offer or save team notes. POST {note}: create a follow-up call task.
type Ctx={params:Promise<{id:string}>};
const guard=async(ctx:Ctx)=>{const {id}=await ctx.params;return /^\d{1,20}$/.test(id)?id:null;};
const fail=(error:unknown)=>{if(error instanceof OfferError)return Response.json({error:error.message},{status:400});throw error;};

export const PATCH=adminRoute(async(request:Request,_user,ctx:Ctx)=>{
 const id=await guard(ctx);if(!id)return Response.json({error:'id'},{status:400});
 const body=await request.json().catch(()=>({})) as {stageId?:string;notes?:string};
 try{await updateOffer(id,body);return Response.json({ok:true});}catch(e){return fail(e);}
});
export const POST=adminRoute(async(request:Request,user,ctx:Ctx)=>{
 const id=await guard(ctx);if(!id)return Response.json({error:'id'},{status:400});
 const body=await request.json().catch(()=>({})) as {note?:unknown};
 try{await followUpOffer(id,typeof body.note==='string'?body.note:'',user.name);return Response.json({ok:true});}catch(e){return fail(e);}
});
