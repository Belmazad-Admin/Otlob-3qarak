import {adminRoute} from '@/src/admin/auth';
import {listAccounts} from '@/src/admin/accounts';

// Team only: every buyer/seller website account with request and offer counts.
export const GET=adminRoute(async()=>Response.json({accounts:await listAccounts()}));
