import {adminConfigured,login,logoutCookie,session,tooManyAttempts} from '@/src/admin/auth';

// GET: who is logged in. POST {password,name}: log in. DELETE: log out.
const noStore={'cache-control':'no-store'};
export async function GET(request:Request){
 const user=await session(request);
 return Response.json({configured:adminConfigured(),user},{headers:noStore});
}
export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin&&new URL(origin).host!==new URL(request.url).host)return Response.json({error:'forbidden'},{status:403});
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'local';
 if(tooManyAttempts(ip))return Response.json({error:'locked'},{status:429,headers:noStore});
 const body=await request.json().catch(()=>({})) as {password?:unknown;name?:unknown};
 const name=typeof body.name==='string'?body.name.trim():'';
 if(name.length<2)return Response.json({error:'name'},{status:400,headers:noStore});
 const cookie=typeof body.password==='string'?await login(body.password,name,ip,new URL(request.url).protocol==='https:'):null;
 if(!cookie)return Response.json({error:'invalid'},{status:401,headers:noStore});
 return Response.json({user:{name}},{headers:{...noStore,'set-cookie':cookie}});
}
export async function DELETE(){
 return Response.json({ok:true},{headers:{...noStore,'set-cookie':logoutCookie}});
}
