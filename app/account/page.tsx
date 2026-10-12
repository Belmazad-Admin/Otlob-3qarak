import AccountApp from '@/src/account/AccountApp';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'حسابي | belmazad.com',robots:{index:false,follow:false}};
export default function Page(){return <AccountApp/>;}
