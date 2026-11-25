import { useId } from "react";

/** Ilustraciones decorativas vectoriales: colores y volumen estables entre iOS y web. */
export function WellnessModuleArt({ kind }: { kind: string }) {
  const id = useId().replaceAll(":", "");
  const fill = (name: string) => `url(#${id}-${name})`;
  return <svg viewBox="0 0 80 80" width="58" height="58" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-white`} x2=".7" y2="1"><stop stopColor="#ffffff" /><stop offset="1" stopColor="#b7c6e3" /></linearGradient>
      <linearGradient id={`${id}-blue`} x2=".3" y2="1"><stop stopColor="#c1e7ff" /><stop offset=".5" stopColor="#9fcdf1" /><stop offset="1" stopColor="#749fdd" /></linearGradient>
      <linearGradient id={`${id}-red`}><stop stopColor="#9c1635" /><stop offset=".35" stopColor="#ff626c" /><stop offset=".65" stopColor="#ec1135" /><stop offset="1" stopColor="#8b1130" /></linearGradient>
      <linearGradient id={`${id}-green`} x2=".6" y2="1"><stop stopColor="#a5cc59" /><stop offset="1" stopColor="#327332" /></linearGradient>
      <radialGradient id={`${id}-shadow`}><stop stopColor="#777b9e" stopOpacity=".3" /><stop offset="1" stopColor="#777b9e" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="42" cy="65" rx="34" ry="9" fill={fill("shadow")} />
    {kind === "Nutrición" ? <>
      <path d="M10 40Q15 70 42 67Q67 65 72 40Z" fill={fill("white")} /><ellipse cx="41" cy="40" rx="31" ry="16" fill="#e9f0e4" />
      {[ [23,36,-25],[33,28,25],[51,28,-15],[61,36,35],[33,43,45],[52,43,-40],[43,34,20] ].map(([x,y,r],i)=><ellipse key={i} cx={x} cy={y} rx="8" ry="12" transform={`rotate(${r} ${x} ${y})`} fill={fill("green")} />)}
      {[ [25,37],[45,28],[57,42] ].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="5" fill="#d95735" /><path d={`M${x-2} ${y-3}l3 5`} stroke="#f5a36a" strokeWidth="2" /></g>)}
      <path d="M34 24l7 19M48 35l9 14M21 29l5 10" stroke="#edc578" strokeWidth="4" strokeLinecap="round" /><path d="M11 44Q40 63 71 43" fill="none" stroke="#fff" strokeWidth="3" />
    </> : kind === "Medicamentos" ? <>
      <g transform="rotate(30 42 35)"><rect x="14" y="25" width="54" height="20" rx="10" fill={fill("white")} /><path d="M41 25h17a10 10 0 0 1 0 20H41Z" fill={fill("blue")} /><path d="M23 29h33" stroke="#fff" opacity=".7" strokeWidth="2" strokeLinecap="round" /></g>
      <g transform="rotate(30 29 54)"><rect x="10" y="48" width="35" height="15" rx="7.5" fill={fill("white")} /><path d="M27 49v12" stroke="#aebcd6" /></g>
    </> : kind === "SOS" ? <>
      <path d="M19 56L23 28Q25 14 42 14Q58 14 61 28L65 56Z" fill={fill("red")} /><path d="M29 39V28Q30 21 36 21" fill="none" stroke="#ffd1d5" strokeWidth="5" strokeLinecap="round" /><ellipse cx="42" cy="56" rx="23" ry="6" fill="#9a183a" /><path d="M17 57Q42 65 67 57L69 65Q42 75 15 65Z" fill={fill("white")} /><path d="M18 61Q42 68 67 61" fill="none" stroke="#5c465c" strokeWidth="3" /><ellipse cx="46" cy="39" rx="5" ry="13" fill="#ffb8ba" opacity=".7" />
    </> : <>
      <path d="M7 58Q7 40 20 40Q32 40 33 58L29 65H12Z" fill="#d9a785" /><circle cx="20" cy="33" r="8" fill="#ad7251" /><path d="M12 32Q8 20 21 22Q30 23 28 35L24 27Z" fill="#573b37" />
      <path d="M28 64V40Q28 31 39 31Q49 32 50 42V65Z" fill="#cc9cba" /><circle cx="39" cy="25" r="8" fill="#d29f79" /><path d="M31 26Q28 15 39 15Q50 17 46 29L42 20Z" fill="#453e3d" />
      <path d="M48 65L45 39Q46 29 59 31Q71 33 72 45L74 65Z" fill="#6c777b" /><circle cx="58" cy="24" r="9" fill="#c99b7c" /><path d="M49 21Q46 10 59 12Q69 13 67 25L62 18Z" fill="#4e4c4c" /><path d="M53 41L50 59M66 42L70 60" stroke="#c99b7c" strokeWidth="5" strokeLinecap="round" />
    </>}
  </svg>;
}
