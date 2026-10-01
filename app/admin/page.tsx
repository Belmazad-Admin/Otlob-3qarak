import AdminApp from '@/src/admin/AdminApp';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Team admin | belmazad.com',robots:{index:false,follow:false}};
export default function Page(){return <AdminApp/>;}
