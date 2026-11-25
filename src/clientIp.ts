// Server-only: the visitor's IP address, used as the key for the sign-in lockout, the admin login brake and the
// buyer-chat hourly limit. Hosts pass it differently: Cloudflare sets cf-connecting-ip; Vercel, Railway and Azure
// set x-forwarded-for, which can hold a chain ("client, proxy1, proxy2") and, on Azure, a port ("1.2.3.4:51234").
// The port changes with every connection, so it must be dropped or every request would look like a new visitor.
export function clientIp(request:Request):string{
 const raw=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'';
 return stripPort(raw.trim())||'local';
}

function stripPort(ip:string){
 const bracketed=/^\[([^\]]+)\](?::\d+)?$/.exec(ip); // [IPv6]:port
 if(bracketed)return bracketed[1];
 if(/^[\d.]+:\d+$/.test(ip))return ip.slice(0,ip.lastIndexOf(':')); // IPv4:port
 return ip; // plain IPv4 or IPv6 (an IPv6 address has several colons and no port here)
}
