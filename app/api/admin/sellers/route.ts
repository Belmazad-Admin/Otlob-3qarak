import {adminRoute} from '@/src/admin/auth';
import {listOffers} from '@/src/admin/sellers';

// Team only: all seller offers and "keep looking" requests from the "Website seller offers" pipeline.
export const GET=adminRoute(async()=>Response.json(await listOffers()));
