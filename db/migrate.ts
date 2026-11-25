// Server-only: applies the SQL migrations in drizzle/ at server start-up (Azure Container Apps sets
// RUN_MIGRATIONS=1; see instrumentation.ts). Uses the same "drizzle.__drizzle_migrations" bookkeeping table as
// `pnpm db:migrate`, so both ways can be mixed. A Postgres advisory lock makes sure that when two copies of the
// site start together, only one applies migrations. If a migration fails the server does not start, and Azure keeps
// the previous version running.
import path from 'node:path';
import postgres from 'postgres';
import {drizzle} from 'drizzle-orm/postgres-js';
import {migrate} from 'drizzle-orm/postgres-js/migrator';

const LOCK_ID=727_001; // any fixed number, shared by every copy of this app

export async function runMigrations(url:string){
 const sql=postgres(url,{max:1,prepare:false,connect_timeout:15,onnotice:()=>{}});
 try{
  await sql`select pg_advisory_lock(${LOCK_ID})`;
  try{await migrate(drizzle(sql),{migrationsFolder:path.join(process.cwd(),'drizzle')});}
  finally{await sql`select pg_advisory_unlock(${LOCK_ID})`;}
 }finally{await sql.end({timeout:5});}
}
