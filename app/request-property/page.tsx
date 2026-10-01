import Marketplace from '@/src/Marketplace';
// ?for=sellers opens the seller view ("بتبيع"); anything else opens the buyer view.
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {for:view}=await searchParams;
 return <Marketplace initialAudience={view==='sellers'?'seller':'buyer'}/>;
}
