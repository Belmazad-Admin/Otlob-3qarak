import type { Metadata } from 'next';
import '@/src/styles.css';
export const metadata:Metadata={title:'اطلب عقارك | belmazad.com',description:'قول لنا بتدور على إيه، وخلي السوق يرد عليك. انشر طلب شراء عقارك واكتشف الفرص المناسبة مع بالمزاد.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>;}
