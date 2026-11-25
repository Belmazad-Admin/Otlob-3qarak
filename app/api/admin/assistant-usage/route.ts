import {adminRoute} from '@/src/admin/auth';
import {usageReport} from '@/src/assistant/usage';

// Team only: buyer-chat token totals and estimated spend for the last 30 days, plus today's spend against the cap.
export const GET=adminRoute(async()=>Response.json(await usageReport(30)));
