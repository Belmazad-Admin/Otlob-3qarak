import {adminRoute} from '@/src/admin/auth';
import {actOnBuyer,ActionError,type BuyerAction} from '@/src/admin/buyers';

// Team only: save public-post edits and/or approve, reject or request changes.
export const POST=adminRoute(async(request:Request,user,{params}:{params:Promise<{id:string}>})=>{
 const {id}=await params;
 if(!/^\d{1,20}$/.test(id))return Response.json({error:'id'},{status:400});
 const body=await request.json().catch(()=>null) as BuyerAction|null;
 if(!body||!['save','approve','reject','changes'].includes(body.action))return Response.json({error:'action'},{status:400});
 try{await actOnBuyer(id,body,user.name);return Response.json({ok:true});}
 catch(error){if(error instanceof ActionError)return Response.json({error:error.message},{status:400});throw error;}
});
