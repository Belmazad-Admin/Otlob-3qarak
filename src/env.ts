// Server-only settings. Plain process environment variables, so the same code runs on Vercel, Railway, Docker or
// `next dev` (local values come from .env.local; see .env.example). Nothing here is ever sent to the browser.
export type AppEnv={
 /** Postgres connection string (Neon, Supabase, Railway, Vercel Postgres ...). */
 DATABASE_URL?:string;
 HUBSPOT_ACCESS_TOKEN?:string;
 /** Optional HubSpot API base URL (tests only). */
 HUBSPOT_API_BASE?:string;
 /** Comma-separated HubSpot owner IDs that receive seller-response tasks (default: both Khadija Hesham owners). */
 HUBSPOT_TASK_OWNER_IDS?:string;
 /** Team admin password for /admin (min. 12 characters). */
 ADMIN_PASSWORD?:string;
 /** Optional secret for signing admin sessions (defaults to one derived from the password and HubSpot key). */
 ADMIN_SESSION_SECRET?:string;
 /** OpenAI API key for the buyer chat assistant. Without it the chat is hidden. */
 OPENAI_API_KEY?:string;
 /** Optional OpenAI model override for the buyer chat assistant (default gpt-5-mini). */
 OPENAI_MODEL?:string;
 /** Optional salt for the anonymised public request IDs. */
 WISHLIST_ID_SALT?:string;
};
// A getter-backed object, so values are read when used (not frozen at import time).
export const env:AppEnv=new Proxy({} as AppEnv,{get:(_,key)=>typeof key==='string'?process.env[key]||undefined:undefined});
