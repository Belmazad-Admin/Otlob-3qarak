// Postgres: website accounts for buyers and sellers. HubSpot stays the CRM; each account links to its
// HubSpot contact, and every request or offer it sends is recorded in `submissions` so the team can track it in /admin.
import {pgTable,text,integer,bigint,boolean,serial,index} from 'drizzle-orm/pg-core';

// Timestamps stay as milliseconds since epoch (plain numbers), exactly as before.
const ms=(name:string)=>bigint(name,{mode:'number'});

export const users=pgTable('users',{
 id:serial('id').primaryKey(),
 email:text('email').notNull().unique(), // stored lower case
 passwordHash:text('password_hash').notNull(), // pbkdf2$iterations$salt$hash (src/auth/password.ts)
 name:text('name').notNull(),
 phone:text('phone').notNull(), // Egyptian mobile, national 10 digits without the leading 0 (1xxxxxxxxx)
 isBroker:boolean('is_broker').notNull().default(false),
 company:text('company').notNull().default(''),
 hubspotContactId:text('hubspot_contact_id'),
 disabled:boolean('disabled').notNull().default(false),
 createdAt:ms('created_at').notNull(), // ms since epoch
 lastLoginAt:ms('last_login_at'),
},t=>[index('users_hubspot_contact').on(t.hubspotContactId)]);

// Only the SHA-256 of the cookie token is stored, so a database leak does not expose live sessions.
export const sessions=pgTable('sessions',{
 tokenHash:text('token_hash').primaryKey(),
 userId:integer('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
 expiresAt:ms('expires_at').notNull(),
 createdAt:ms('created_at').notNull(),
},t=>[index('sessions_user').on(t.userId)]);

// One row per buyer request, offer or "keep looking" sent from an account (live HubSpot submissions only).
export const submissions=pgTable('submissions',{
 id:serial('id').primaryKey(),
 userId:integer('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
 kind:text('kind',{enum:['buyer_request','offer','keep_looking']}).notNull(),
 ref:text('ref').notNull().default(''), // BM- reference: the buyer's own request, or the request an offer answers
 hubspotContactId:text('hubspot_contact_id'),
 hubspotDealId:text('hubspot_deal_id'),
 summaryJson:text('summary_json').notNull(), // snapshot of what was sent
 createdAt:ms('created_at').notNull(),
},t=>[index('submissions_user').on(t.userId),index('submissions_contact').on(t.hubspotContactId)]);

// Rate counters shared by all server instances: failed sign-ins per IP and per e-mail, and buyer-chat requests
// per IP (key "chat:<ip>").
export const loginAttempts=pgTable('login_attempts',{
 key:text('key').primaryKey(),
 count:integer('count').notNull(),
 windowStart:ms('window_start').notNull(),
});

export type User=typeof users.$inferSelect;
export type Submission=typeof submissions.$inferSelect;
