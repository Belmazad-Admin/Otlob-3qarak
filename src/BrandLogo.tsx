// Official belmazad logo files in public/logos (supplied by the owner, October 2026).
// The language picks the Arabic or English logo. The colour is picked by CSS (see "Brand logo" in src/styles.css):
// blue in light mode, white in dark mode, and always white on dark backgrounds
// (the header while it floats over the hero photo, and the navy footer).
// Both images are decorative; the surrounding link or element carries the accessible name.

const FILES={
 ar:{blue:['/logos/logo-ar-blue.png',1367,228],white:['/logos/logo-ar-white.png',1405,228]},
 en:{blue:['/logos/logo-en-blue.png',1920,229],white:['/logos/logo-en-white.png',1920,229]},
} as const;

export const brandName=(lang:'ar'|'en')=>lang==='ar'?'بالمزاد.كوم':'belmazad.com';

export default function BrandLogo({lang,className=''}:{lang:'ar'|'en';className?:string}){
 const f=FILES[lang];
 return <span className={`brand-logo ${className}`.trim()}>
  <img className="brand-logo-blue" src={f.blue[0]} width={f.blue[1]} height={f.blue[2]} alt="" draggable={false}/>
  <img className="brand-logo-white" src={f.white[0]} width={f.white[1]} height={f.white[2]} alt="" draggable={false}/>
 </span>;
}
