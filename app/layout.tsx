import type { Metadata } from 'next';
import '@/src/styles.css';
import {themeBootScript} from '@/src/theme';
export const metadata:Metadata={title:'اطلب عقارك | belmazad.com',description:'قول لنا بتدور على إيه، وخلي السوق يرد عليك. انشر طلب شراء عقارك واكتشف الفرص المناسبة مع بالمزاد.',robots:{index:false,follow:false}};
// data-theme is set before paint by themeBootScript (light by default), so <html> attributes may differ from the server render.
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl" data-theme="light" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeBootScript}}/></head><body>{children}</body></html>;}
