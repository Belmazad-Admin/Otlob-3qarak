// Runs once when the Next.js server starts. On Azure (RUN_MIGRATIONS=1) it brings the database up to date before
// the site takes traffic, so deploys never need a separate "pnpm db:migrate". Vercel and local dev leave it off.
export async function register(){
 if(process.env.NEXT_RUNTIME!=='nodejs'||process.env.RUN_MIGRATIONS!=='1'||!process.env.DATABASE_URL)return;
 const {runMigrations}=await import('./db/migrate');
 const started=Date.now();
 await runMigrations(process.env.DATABASE_URL);
 console.log(`database migrations up to date (${Date.now()-started} ms)`);
}
