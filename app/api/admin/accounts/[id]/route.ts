import {adminRoute} from '@/src/admin/auth';
import {accountDetail,AccountError,resetPassword,setDisabled} from '@/src/admin/accounts';

// Team only. GET: the account's requests and offers with current status.
// POST {action:'reset'}: temporary password (shown once). POST {action:'disable'|'enable'}.
type Ctx={params:Promise<{id:string}>};
const guard=async(ctx:Ctx)=>{const {id}=await ctx.params;return /^\d{1,10}$/.test(id)?Number(id):null;};
const fail=(error:unknown)=>{if(error instanceof AccountError)return Response.json({error:error.message},{status:404});throw error;};

export const GET=adminRoute(async(_request:Request,_user,ctx:Ctx)=>{
 const id=await guard(ctx);if(id==null)return Response.json({error:'id'},{status:400});
 try{return Response.json(await accountDetail(id));}catch(e){return fail(e);}
});
export const POST=adminRoute(async(request:Request,user,ctx:Ctx)=>{
 const id=await guard(ctx);if(id==null)return Response.json({error:'id'},{status:400});
 const {action}=await request.json().catch(()=>({})) as {action?:string};
 try{
  if(action==='reset'){const password=await resetPassword(id);console.log(`account ${id}: password reset by ${user.name}`);return Response.json({password});}
  if(action==='disable'||action==='enable'){await setDisabled(id,action==='disable');console.log(`account ${id}: ${action}d by ${user.name}`);return Response.json({ok:true});}
  return Response.json({error:'action'},{status:400});
 }catch(e){return fail(e);}
});
