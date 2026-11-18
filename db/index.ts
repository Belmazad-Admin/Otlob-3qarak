import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {env} from '@/src/env';
import * as schema from './schema';

// One lazily created connection per server instance. `prepare:false` keeps it compatible with pooled connection
// strings (Neon, Supabase, PgBouncer); `max:1` suits serverless functions (Vercel) as well as a long-running server.
let db:ReturnType<typeof create>|undefined;
function create(url:string){return drizzle(postgres(url,{prepare:false,max:1,idle_timeout:20,connect_timeout:10}),{schema});}

export function getDb(){
 if(!env.DATABASE_URL)throw new Error('DATABASE_URL is not set. Add a Postgres connection string (see .env.example).');
 return db??=create(env.DATABASE_URL);
}
