// Server-only: password hashing with PBKDF2-SHA256 (Web Crypto). 100,000 iterations is the Cloudflare Workers maximum.
// Stored as pbkdf2$<iterations>$<salt b64url>$<hash b64url>.
const ITERATIONS=100_000;
const enc=new TextEncoder();
export const b64=(buf:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=(s:string):Uint8Array<ArrayBuffer>=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));

async function derive(password:string,salt:Uint8Array<ArrayBuffer>,iterations:number){
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256));
}

export async function hashPassword(password:string){
 const salt=crypto.getRandomValues(new Uint8Array(16));
 return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(password,salt,ITERATIONS))}`;
}

export async function verifyPassword(password:string,stored:string){
 const [scheme,iter,salt,hash]=stored.split('$');
 if(scheme!=='pbkdf2'||!iter||!salt||!hash)return false;
 const actual=await derive(password,unb64(salt),Number(iter)),expected=unb64(hash);
 if(actual.length!==expected.length)return false;
 let diff=0;for(let i=0;i<actual.length;i++)diff|=actual[i]^expected[i]; // constant time
 return diff===0;
}

// Same cost as a real check, so a sign-in with an unknown e-mail takes as long as one with a wrong password.
export const DUMMY_HASH='pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

// Temporary password for an admin reset: 12 characters, no look-alikes (0/O, 1/l/I).
export function temporaryPassword(){
 const chars='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(12));
 return [...bytes].map(b=>chars[b%chars.length]).join('');
}
