// One-off: copy the old Cloudflare D1 accounts into Postgres.
//   1. npx wrangler d1 export belmazad --remote --output d1.sql
//   2. DATABASE_URL=... pnpm db:migrate          (creates the empty tables)
//   3. DATABASE_URL=... node scripts/import-d1.mjs d1.sql
// The dump is loaded into an in-memory SQLite, then each row is written to Postgres in one transaction
// (nothing is kept if any row fails). It refuses to run when Postgres already has accounts.
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import postgres from 'postgres';

const file=process.argv[2]||'d1.sql';
const url=process.env.DATABASE_URL;
if(!url){console.error('DATABASE_URL is not set.');process.exit(1);}

const lite=new DatabaseSync(':memory:');
lite.exec(readFileSync(file,'utf8'));

// Parents first, so the user_id foreign keys resolve. Boolean columns were stored as 0/1 in SQLite.
const tables=[
 {name:'users',booleans:['is_broker','disabled'],serial:true},
 {name:'sessions',booleans:[]},
 {name:'submissions',booleans:[],serial:true},
 {name:'login_attempts',booleans:[]},
];

const sql=postgres(url,{prepare:false,max:1,onnotice:()=>{}});
try{
 const [{n}]=await sql`select count(*)::int as n from users`;
 if(n>0)throw new Error(`Postgres already has ${n} account(s); refusing to import on top of them.`);
 await sql.begin(async tx=>{
  for(const t of tables){
   const rows=lite.prepare(`select * from "${t.name}"`).all().map(r=>{
    const row={...r};
    for(const b of t.booleans)row[b]=!!row[b];
    return row;
   });
   for(let i=0;i<rows.length;i+=500)await tx`insert into ${tx(t.name)} ${tx(rows.slice(i,i+500))}`;
   // Continue the ID counter after the highest imported ID.
   if(t.serial)await tx`select setval(pg_get_serial_sequence(${t.name},'id'),coalesce((select max(id) from ${tx(t.name)}),0)+1,false)`;
   console.log(`${t.name}: ${rows.length} row(s)`);
  }
 });
 console.log('Import finished.');
}catch(error){console.error('Import failed, nothing was written:',error.message);process.exitCode=1;}
finally{await sql.end();}
