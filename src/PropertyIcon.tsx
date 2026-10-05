// Frosted-glass property-type icons (owner-approved, October 2026).
// Each icon: a solid shape behind, a frosted translucent shape in front through which the back shape shows blurred,
// and small white details. Colours come from CSS tokens per category (see "Property icons" in src/styles.css).
import {useId,type ReactNode} from 'react';
import {catOf} from './data';

const MAIN='var(--pi-main)',WHITE='var(--on-fill)';
type Shape={back:ReactNode;front:ReactNode;det:ReactNode};

const ICONS:Record<string,Shape>={
 apartment:{back:<rect x="23" y="5" width="18" height="34" rx="4"/>,front:<rect x="7" y="15" width="24" height="28" rx="6"/>,
  det:<g fill={WHITE}><rect x="12" y="21" width="4.5" height="4.5" rx="1.2"/><rect x="21" y="21" width="4.5" height="4.5" rx="1.2"/><rect x="12" y="28.5" width="4.5" height="4.5" rx="1.2"/><rect x="21" y="28.5" width="4.5" height="4.5" rx="1.2"/><rect x="15.5" y="35.5" width="7" height="7.5" rx="2"/></g>},
 villa:{back:<path d="M5 22 L20 8 L35 22 V31 H5 Z"/>,front:<rect x="13" y="21" width="30" height="21" rx="6"/>,
  det:<g fill={WHITE}><rect x="18" y="27" width="9" height="6.5" rx="2"/><rect x="31" y="29" width="6.5" height="13" rx="2"/></g>},
 chalet:{back:<circle cx="34" cy="13" r="8"/>,front:<path d="M5.5 38 L20 11 L34.5 38 Z"/>,
  det:<><rect x="17" y="29" width="6" height="9" rx="2" fill={WHITE}/><path d="M5 43.5 q4.2 -3 8.4 0 t8.4 0 t8.4 0 t8.4 0" stroke={MAIN} strokeWidth="3" fill="none" strokeLinecap="round"/></>},
 office:{back:<rect x="22" y="4" width="20" height="36" rx="4"/>,front:<rect x="6" y="20" width="28" height="22" rx="6"/>,
  det:<><path d="M14 20 v-3 a3 3 0 0 1 3 -3 h6 a3 3 0 0 1 3 3 v3" stroke={MAIN} strokeWidth="3" fill="none"/><rect x="17" y="28" width="6" height="4.5" rx="1.5" fill={WHITE}/></>},
 retail:{back:<path d="M5 9 H43 V17 a4.75 4.75 0 0 1 -9.5 0 a4.75 4.75 0 0 1 -9.5 0 a4.75 4.75 0 0 1 -9.5 0 a4.75 4.75 0 0 1 -9.5 0 Z"/>,front:<rect x="9" y="16" width="30" height="27" rx="5"/>,
  det:<g fill={WHITE}><rect x="14" y="27" width="9" height="7" rx="2"/><rect x="27" y="28" width="7" height="15" rx="2"/></g>},
 commercial:{back:<rect x="5" y="7" width="26" height="33" rx="5"/>,front:<rect x="17" y="20" width="26" height="23" rx="6"/>,
  det:<><path d="M24 20 v-3 a6 6 0 0 1 12 0 v3" stroke={MAIN} strokeWidth="3" fill="none"/><g fill={WHITE}><circle cx="24" cy="27" r="1.7"/><circle cx="36" cy="27" r="1.7"/></g></>},
 building:{back:<><rect x="26" y="13" width="16" height="29" rx="4"/><rect x="32.7" y="3" width="2.6" height="12" rx="1.3"/><path d="M35 3.5 L43.5 7 L35 10.5 Z"/></>,front:<rect x="6" y="16" width="26" height="27" rx="5"/>,
  det:<g fill={WHITE}>{[11,17.25,23.5].flatMap(x=>[21,27.5,34].map(y=><rect key={`${x}-${y}`} x={x} y={y} width="3.6" height="3.6" rx="1"/>))}</g>},
 land:{back:<path d="M12 28 H36 L43 40 a2 2 0 0 1 -1.8 3 H6.8 a2 2 0 0 1 -1.8 -3 Z"/>,front:<path d="M24 5 a10 10 0 0 1 10 10 c0 7 -10 17 -10 17 s-10 -10 -10 -17 a10 10 0 0 1 10 -10 Z"/>,
  det:<circle cx="24" cy="15" r="3.6" fill={WHITE}/>},
 warehouse:{back:<path d="M6 27 a18 16 0 0 1 36 0 Z"/>,front:<rect x="9" y="20" width="30" height="23" rx="5"/>,
  det:<g fill={WHITE}><rect x="16" y="27.5" width="16" height="2.3" rx="1.1"/><rect x="16" y="32" width="16" height="2.3" rx="1.1"/><rect x="16" y="36.5" width="16" height="2.3" rx="1.1"/></g>},
 factory:{back:<><rect x="31" y="9" width="7" height="22" rx="2"/><circle cx="38" cy="6" r="4.5"/></>,front:<path d="M5 25 L14 19 V25 L23 19 V25 L32 19 V25 H43 V39 a4 4 0 0 1 -4 4 H9 a4 4 0 0 1 -4 -4 Z"/>,
  det:<g fill={WHITE}><rect x="10" y="31" width="6" height="5" rx="1.5"/><rect x="19.5" y="31" width="6" height="5" rx="1.5"/><rect x="29" y="31" width="6" height="5" rx="1.5"/></g>},
 other:{back:<circle cx="30" cy="24" r="13"/>,front:<circle cx="18" cy="24" r="13"/>,
  det:<g fill={WHITE}><circle cx="12" cy="24" r="1.9"/><circle cx="18" cy="24" r="1.9"/><circle cx="24" cy="24" r="1.9"/></g>},
};

/** Decorative icon for a property type; the visible text label always sits next to it. */
export default function PropertyIcon({type,size=24,className=''}:{type:string;size?:number;className?:string}){
 const id=useId().replace(/[^a-zA-Z0-9_-]/g,'');
 const d=ICONS[type]??ICONS.other;
 return <svg className={`picon ${className}`.trim()} data-cat={catOf(type)} viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
  <defs><clipPath id={`pc${id}`}>{d.front}</clipPath><filter id={`pb${id}`} filterUnits="userSpaceOnUse" x="-10" y="-10" width="68" height="68"><feGaussianBlur stdDeviation="2.8"/></filter></defs>
  <g fill={MAIN}>{d.back}</g>
  <g clipPath={`url(#pc${id})`}><rect width="48" height="48" fill="var(--pi-tint)"/><g fill={MAIN} filter={`url(#pb${id})`} opacity=".92">{d.back}</g><rect width="48" height="48" fill={WHITE} opacity=".16"/></g>
  {d.det}
 </svg>;
}
