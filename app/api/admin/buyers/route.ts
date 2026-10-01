import {adminRoute} from '@/src/admin/auth';
import {listBuyers,locationKeys,featureKeys} from '@/src/admin/buyers';

// Team only: every wishlist request with private details, status and the public post.
export const GET=adminRoute(async()=>Response.json({buyers:await listBuyers(),options:{locations:locationKeys,features:featureKeys}}));
