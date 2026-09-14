import type { ReactNode } from "react";

/**
 * Íconos 3D de los módulos del inicio.
 *
 * Son ILUSTRACIONES, no glifos: cada objeto se modela con sus caras (frente,
 * canto superior y lateral), esferas con luz direccional, oclusión donde dos
 * superficies se tocan y sombra de contacto en el suelo. Por eso no salen de
 * `ionicons` ni de una librería de iconos: ninguna entrega volumen.
 *
 * No se usó un motor 3D (three.js / react-three-fiber): un runtime WebGL para
 * seis piezas estáticas penaliza arranque y batería en el build de Capacitor,
 * y el resultado sería peor que arte vectorial cuidado.
 *
 * Los tonos de cada ilustración son literales a propósito — igual que la
 * rueda del protocolo (`ProtocolWheel`), son identidad de la pieza y no
 * tokens de marca: una ilustración necesita ~8 valores de luz por objeto y
 * ninguno es reutilizable fuera de ella. El color con el que el módulo se
 * reconoce en el resto de la UI (tarjeta, píldora, halo) sí es token:
 * `--mod-*` en `variables.css`.
 */

const VIEW = "0 0 96 96";

/**
 * Canto redondeado real. Un solo duplicado desplazado detrás de la cara solo
 * produce una sombra plana; interpolando N copias entre la cara trasera y la
 * frontal aparece el volumen con la silueta redondeada correcta. El degradado
 * del canto va en `userSpaceOnUse` para que la luz lo recorra entero en vez
 * de repetirse dentro de cada copia.
 */
function extrusion(
  steps: number,
  dx: number,
  dy: number,
  node: (ox: number, oy: number, key: string) => ReactNode,
): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < steps; i += 1) {
    const t = 1 - i / (steps - 1);
    out.push(node(dx * t, dy * t, `x${i}`));
  }
  return out;
}

function Frame({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      className="ic3"
      viewBox={VIEW}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type IconProps = { size?: number };

/* ─────────────────────────── Citas — calendario ─────────────────────────── */
export function CalendarIcon3D({ size = 88 }: IconProps) {
  return (
    <Frame size={size}>
      <defs>
        <linearGradient id="cal-edge" x1="10" y1="16" x2="84" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8cbcf3" />
          <stop offset="0.4" stopColor="#3f78ca" />
          <stop offset="1" stopColor="#10356b" />
        </linearGradient>
        <linearGradient id="cal-face" x1="16" y1="30" x2="62" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d5e2f2" />
        </linearGradient>
        <linearGradient id="cal-head" x1="14" y1="28" x2="70" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5b95e2" />
          <stop offset="1" stopColor="#1b4f9b" />
        </linearGradient>
        <linearGradient id="cal-ring" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f4f8fd" />
          <stop offset="0.42" stopColor="#c6d5e7" />
          <stop offset="1" stopColor="#8698b0" />
        </linearGradient>
        <linearGradient id="cal-spec" x1="16" y1="28" x2="52" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="cal-floor">
          <stop offset="0" stopColor="#0d2748" stopOpacity="0.32" />
          <stop offset="1" stopColor="#0d2748" stopOpacity="0" />
        </radialGradient>
        <clipPath id="cal-clip">
          <rect x="14" y="28" width="56" height="54" rx="11" />
        </clipPath>
      </defs>

      <ellipse cx="45" cy="87" rx="33" ry="7.5" fill="url(#cal-floor)" />

      {/* Anillas: asoman por encima del canto, detrás del cuerpo. */}
      <rect x="27.5" y="9" width="7" height="24" rx="3.5" fill="url(#cal-ring)" />
      <rect x="55.5" y="9" width="7" height="24" rx="3.5" fill="url(#cal-ring)" />

      {extrusion(18, 10, -8, (ox, oy, key) => (
        <rect
          key={key}
          x={14 + ox}
          y={28 + oy}
          width="56"
          height="54"
          rx="11"
          fill="url(#cal-edge)"
        />
      ))}

      <rect x="14" y="28" width="56" height="54" rx="11" fill="url(#cal-face)" />

      <g clipPath="url(#cal-clip)">
        <rect x="14" y="28" width="56" height="16" fill="url(#cal-head)" />
        {/* Oclusión bajo la banda: la cabecera se apoya sobre la hoja. */}
        <rect x="14" y="44" width="56" height="3" fill="#9fb2c9" opacity="0.35" />
        <ellipse
          cx="20"
          cy="36"
          rx="30"
          ry="15"
          transform="rotate(-30 20 36)"
          fill="url(#cal-spec)"
          opacity="0.5"
        />
      </g>

      {[25, 37, 49, 61].map((cx) => (
        <circle key={cx} cx={cx} cy="58" r="3.4" fill="#c3d1e3" />
      ))}
      {[25, 37, 61].map((cx) => (
        <circle key={cx} cx={cx} cy="70" r="3.4" fill="#c3d1e3" />
      ))}
      {/* El día con cita, marcado. */}
      <circle cx="49" cy="70" r="5.4" fill="#e2574c" />
      <circle cx="47.2" cy="68.2" r="1.7" fill="#ffffff" opacity="0.55" />
    </Frame>
  );
}

/* ────────────────────────── Nutrición — manzana ─────────────────────────── */
export function AppleIcon3D({ size = 88 }: IconProps) {
  return (
    <Frame size={size}>
      <defs>
        <radialGradient id="app-body" cx="0.32" cy="0.28" r="0.86">
          <stop offset="0" stopColor="#7fdca6" />
          <stop offset="0.36" stopColor="#2aa771" />
          <stop offset="0.76" stopColor="#0a6a51" />
          <stop offset="1" stopColor="#023b32" />
        </radialGradient>
        <radialGradient id="app-occl" cx="0.74" cy="0.8" r="0.5">
          <stop offset="0" stopColor="#01241f" stopOpacity="0.5" />
          <stop offset="1" stopColor="#01241f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="app-spec" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="app-leaf" x1="52" y1="30" x2="80" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2f9c62" />
          <stop offset="1" stopColor="#8fe3a4" />
        </linearGradient>
        <linearGradient id="app-stem" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7d5733" />
          <stop offset="1" stopColor="#432c17" />
        </linearGradient>
        <radialGradient id="app-floor">
          <stop offset="0" stopColor="#052a22" stopOpacity="0.32" />
          <stop offset="1" stopColor="#052a22" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="48" cy="86" rx="28" ry="7" fill="url(#app-floor)" />

      <path
        d="M48 30 C60 20 80 26 80 48 C80 70 65 86 53 86 C51 86 49.5 85 48 83.4 C46.5 85 45 86 43 86 C31 86 16 70 16 48 C16 26 36 20 48 30 Z"
        fill="url(#app-body)"
      />
      <path
        d="M48 30 C60 20 80 26 80 48 C80 70 65 86 53 86 C51 86 49.5 85 48 83.4 C46.5 85 45 86 43 86 C31 86 16 70 16 48 C16 26 36 20 48 30 Z"
        fill="url(#app-occl)"
      />

      <ellipse
        cx="33"
        cy="43"
        rx="12"
        ry="7.5"
        transform="rotate(-38 33 43)"
        fill="url(#app-spec)"
        opacity="0.55"
      />
      <ellipse cx="27" cy="59" rx="4" ry="6" transform="rotate(-24 27 59)" fill="#ffffff" opacity="0.16" />

      <path d="M46.5 32 C45 24 44 18 42.5 13" stroke="url(#app-stem)" strokeWidth="4.6" strokeLinecap="round" fill="none" />
      <path
        d="M50 30 C58 14 74 11 80 12 C80 24 68 34 51 31 Z"
        fill="url(#app-leaf)"
      />
      <path d="M54 29 C62 24 71 18 78 14" stroke="#0f6b41" strokeWidth="1.7" strokeLinecap="round" fill="none" opacity="0.55" />
    </Frame>
  );
}

/* ───────────────── Visualización del perfil — figura escaneada ──────────── */
export function BodyIcon3D({ size = 88 }: IconProps) {
  return (
    <Frame size={size}>
      <defs>
        <radialGradient id="bod-head" cx="0.34" cy="0.28" r="0.82">
          <stop offset="0" stopColor="#d9c8f6" />
          <stop offset="0.45" stopColor="#9573d8" />
          <stop offset="1" stopColor="#482c85" />
        </radialGradient>
        <linearGradient id="bod-torso" x1="32" y1="40" x2="66" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#b79ceb" />
          <stop offset="0.45" stopColor="#7b57c4" />
          <stop offset="1" stopColor="#3f2578" />
        </linearGradient>
        <linearGradient id="bod-arm" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a98ade" />
          <stop offset="1" stopColor="#4a2d8b" />
        </linearGradient>
        <linearGradient id="bod-ring-b" x1="14" y1="74" x2="82" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3d2478" />
          <stop offset="1" stopColor="#5b3aa4" />
        </linearGradient>
        <linearGradient id="bod-ring-f" x1="14" y1="74" x2="82" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9d7fe0" />
          <stop offset="0.5" stopColor="#cbb4f5" />
          <stop offset="1" stopColor="#7a58c6" />
        </linearGradient>
        <radialGradient id="bod-floor">
          <stop offset="0" stopColor="#241146" stopOpacity="0.34" />
          <stop offset="1" stopColor="#241146" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="48" cy="88" rx="30" ry="6.5" fill="url(#bod-floor)" />

      {/* Mitad trasera del anillo de medición: pasa por detrás de la figura. */}
      <path d="M17 80 A31 10 0 0 1 79 80" stroke="url(#bod-ring-b)" strokeWidth="5.5" strokeLinecap="round" fill="none" />

      <ellipse cx="48" cy="80" rx="18" ry="5" fill="#2b1655" opacity="0.26" />

      {/* Brazos separados del tronco: pegados leían como un abrazo. */}
      <rect x="23" y="45" width="7" height="26" rx="3.5" transform="rotate(9 26.5 58)" fill="url(#bod-arm)" />
      <rect x="66" y="45" width="7" height="26" rx="3.5" transform="rotate(-9 69.5 58)" fill="url(#bod-arm)" />
      <path
        d="M48 36 C59 36 65 43 65 53 L65 66 C65 73 58 78 48 78 C38 78 31 73 31 66 L31 53 C31 43 37 36 48 36 Z"
        fill="url(#bod-torso)"
      />
      <ellipse cx="39" cy="48" rx="7" ry="11" transform="rotate(-18 39 48)" fill="#ffffff" opacity="0.2" />

      <circle cx="48" cy="23" r="11.5" fill="url(#bod-head)" />
      <ellipse cx="43.8" cy="18.8" rx="4" ry="2.9" transform="rotate(-30 43.8 18.8)" fill="#ffffff" opacity="0.45" />
      <ellipse cx="48" cy="34" rx="8.5" ry="2.4" fill="#311a60" opacity="0.35" />

      {/* Mitad delantera del anillo: tapa la base de la figura y cierra el volumen. */}
      <path d="M79 80 A31 10 0 0 1 17 80" stroke="url(#bod-ring-f)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
    </Frame>
  );
}

/* ─────────────────── Historia clínica — carpeta con hojas ───────────────── */
export function RecordIcon3D({ size = 88 }: IconProps) {
  return (
    <Frame size={size}>
      <defs>
        <linearGradient id="rec-back-edge" x1="12" y1="18" x2="86" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4fa8d4" />
          <stop offset="0.45" stopColor="#12658f" />
          <stop offset="1" stopColor="#06344c" />
        </linearGradient>
        <linearGradient id="rec-back" x1="14" y1="24" x2="70" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2b8fbe" />
          <stop offset="1" stopColor="#0a4a6b" />
        </linearGradient>
        <linearGradient id="rec-front-edge" x1="10" y1="42" x2="84" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7fcbe9" />
          <stop offset="0.45" stopColor="#1c86b8" />
          <stop offset="1" stopColor="#083c58" />
        </linearGradient>
        <linearGradient id="rec-front" x1="14" y1="46" x2="66" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#63bde1" />
          <stop offset="0.55" stopColor="#1b81b3" />
          <stop offset="1" stopColor="#0d5378" />
        </linearGradient>
        <linearGradient id="rec-sheet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe9f2" />
        </linearGradient>
        <radialGradient id="rec-floor">
          <stop offset="0" stopColor="#062c40" stopOpacity="0.32" />
          <stop offset="1" stopColor="#062c40" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="45" cy="87" rx="33" ry="7" fill="url(#rec-floor)" />

      {/* Lomo de la carpeta. */}
      {extrusion(16, 9, -8, (ox, oy, key) => (
        <rect key={key} x={14 + ox} y={26 + oy} width="60" height="50" rx="9" fill="url(#rec-back-edge)" />
      ))}
      <rect x="14" y="26" width="60" height="50" rx="9" fill="url(#rec-back)" />

      {/* Hojas del expediente, con canto propio. */}
      <g transform="rotate(-6 44 46)">
        <rect x="21" y="27" width="42" height="38" rx="4" fill="#c8d6e4" />
        <rect x="21" y="27" width="42" height="36" rx="4" fill="url(#rec-sheet)" />
      </g>
      <g transform="rotate(6 54 44)">
        <rect x="33" y="25" width="42" height="38" rx="4" fill="#c8d6e4" />
        <rect x="33" y="25" width="42" height="36" rx="4" fill="url(#rec-sheet)" />
      </g>
      <rect x="27" y="22" width="42" height="40" rx="4" fill="#c3d2e1" />
      <rect x="27" y="22" width="42" height="38" rx="4" fill="url(#rec-sheet)" />
      <path
        d="M33 40 H40 L43 33 L47 47 L51 38 L54 40 H63"
        stroke="#e2574c"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="33" y="50" width="30" height="3.4" rx="1.7" fill="#cbd8e6" />

      {/* Bolsillo delantero: tapa la mitad baja de las hojas. */}
      {extrusion(16, 9, -8, (ox, oy, key) => (
        <rect key={key} x={12 + ox} y={50 + oy} width="64" height="30" rx="9" fill="url(#rec-front-edge)" />
      ))}
      <rect x="12" y="50" width="64" height="30" rx="9" fill="url(#rec-front)" />
      <ellipse cx="26" cy="57" rx="16" ry="6" transform="rotate(-10 26 57)" fill="#ffffff" opacity="0.24" />
      <rect x="36" y="46" width="18" height="7" rx="3.5" fill="url(#rec-front)" />
    </Frame>
  );
}

/* ───────────────────────── Comunidad — grupo de tres ────────────────────── */
export function CommunityIcon3D({ size = 88 }: IconProps) {
  return (
    <Frame size={size}>
      <defs>
        <radialGradient id="com-head-b" cx="0.34" cy="0.28" r="0.82">
          <stop offset="0" stopColor="#c7ddee" />
          <stop offset="0.5" stopColor="#6d99bb" />
          <stop offset="1" stopColor="#2e546f" />
        </radialGradient>
        <linearGradient id="com-body-b" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#8fb4cf" />
          <stop offset="1" stopColor="#335974" />
        </linearGradient>
        <radialGradient id="com-head-f" cx="0.32" cy="0.26" r="0.84">
          <stop offset="0" stopColor="#ffd9ab" />
          <stop offset="0.45" stopColor="#f39a45" />
          <stop offset="1" stopColor="#a8500d" />
        </radialGradient>
        <linearGradient id="com-body-f" x1="30" y1="52" x2="66" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffbe78" />
          <stop offset="0.5" stopColor="#ee8b34" />
          <stop offset="1" stopColor="#a3500f" />
        </linearGradient>
        <radialGradient id="com-floor">
          <stop offset="0" stopColor="#2c1c08" stopOpacity="0.3" />
          <stop offset="1" stopColor="#2c1c08" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="48" cy="85" rx="36" ry="7" fill="url(#com-floor)" />

      {/* Acompañantes: más pequeños, más fríos y más al fondo. */}
      <g>
        <circle cx="22" cy="42" r="9.5" fill="url(#com-head-b)" />
        <path d="M22 54 C31 54 36 59 36 67 L36 76 L8 76 L8 67 C8 59 13 54 22 54 Z" fill="url(#com-body-b)" />
      </g>
      <g>
        <circle cx="74" cy="42" r="9.5" fill="url(#com-head-b)" />
        <path d="M74 54 C83 54 88 59 88 67 L88 76 L60 76 L60 67 C60 59 65 54 74 54 Z" fill="url(#com-body-b)" />
      </g>

      {/* Oclusión: la figura de delante se separa del fondo. */}
      <ellipse cx="48" cy="66" rx="26" ry="16" fill="#20120a" opacity="0.2" />

      <path
        d="M48 50 C60 50 68 57 68 68 L68 80 L28 80 L28 68 C28 57 36 50 48 50 Z"
        fill="url(#com-body-f)"
      />
      <ellipse cx="38" cy="62" rx="7" ry="9" transform="rotate(-16 38 62)" fill="#ffffff" opacity="0.22" />
      <circle cx="48" cy="34" r="13" fill="url(#com-head-f)" />
      <ellipse cx="43" cy="29" rx="4.6" ry="3.2" transform="rotate(-30 43 29)" fill="#ffffff" opacity="0.5" />
      <ellipse cx="48" cy="46.5" rx="10" ry="2.8" fill="#8a4310" opacity="0.4" />
    </Frame>
  );
}

/* ───────────────────────── Mi perfil — credencial ───────────────────────── */
export function ProfileIcon3D({ size = 88 }: IconProps) {
  return (
    <Frame size={size}>
      <defs>
        <linearGradient id="pro-edge" x1="8" y1="24" x2="88" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a9cbe4" />
          <stop offset="0.45" stopColor="#4b7ba1" />
          <stop offset="1" stopColor="#1b3448" />
        </linearGradient>
        <linearGradient id="pro-face" x1="12" y1="32" x2="76" y2="78" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f2f7fb" />
          <stop offset="0.55" stopColor="#d3e2ee" />
          <stop offset="1" stopColor="#a8c1d5" />
        </linearGradient>
        <linearGradient id="pro-strip" x1="12" y1="32" x2="76" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5b8bb0" />
          <stop offset="1" stopColor="#22405a" />
        </linearGradient>
        <radialGradient id="pro-head" cx="0.32" cy="0.26" r="0.84">
          <stop offset="0" stopColor="#cfe6f6" />
          <stop offset="0.45" stopColor="#5f8fb4" />
          <stop offset="1" stopColor="#22415a" />
        </radialGradient>
        <linearGradient id="pro-bust" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#8fb6d2" />
          <stop offset="1" stopColor="#2c5573" />
        </linearGradient>
        <radialGradient id="pro-floor">
          <stop offset="0" stopColor="#0f2637" stopOpacity="0.32" />
          <stop offset="1" stopColor="#0f2637" stopOpacity="0" />
        </radialGradient>
        <clipPath id="pro-clip">
          <rect x="12" y="32" width="66" height="46" rx="10" />
        </clipPath>
      </defs>

      <ellipse cx="45" cy="86" rx="34" ry="7" fill="url(#pro-floor)" />

      {extrusion(16, 10, -9, (ox, oy, key) => (
        <rect key={key} x={12 + ox} y={32 + oy} width="66" height="46" rx="10" fill="url(#pro-edge)" />
      ))}
      <rect x="12" y="32" width="66" height="46" rx="10" fill="url(#pro-face)" />
      <g clipPath="url(#pro-clip)">
        <rect x="12" y="32" width="66" height="10" fill="url(#pro-strip)" />
        <rect x="12" y="42" width="66" height="2.4" fill="#7f99ae" opacity="0.4" />
      </g>

      {/* Retrato en relieve sobre la credencial, con su propia sombra. */}
      <ellipse cx="33" cy="70" rx="14" ry="4" fill="#2b4c66" opacity="0.28" />
      <path d="M33 56 C41 56 46 61 46 68 L46 71 L20 71 L20 68 C20 61 25 56 33 56 Z" fill="url(#pro-bust)" />
      <circle cx="33" cy="52" r="9.5" fill="url(#pro-head)" />
      <ellipse cx="29.6" cy="48.4" rx="3.4" ry="2.4" transform="rotate(-30 29.6 48.4)" fill="#ffffff" opacity="0.5" />

      <rect x="52" y="52" width="20" height="5" rx="2.5" fill="#7d9bb4" />
      <rect x="52" y="61" width="14" height="4.4" rx="2.2" fill="#9db6cb" />
      <rect x="52" y="69" width="17" height="4.4" rx="2.2" fill="#b3c7d8" />
    </Frame>
  );
}

/** Registro de las piezas por módulo del inicio. */
export const MODULE_ICONS_3D = {
  book: CalendarIcon3D,
  nut: AppleIcon3D,
  body: BodyIcon3D,
  hc: RecordIcon3D,
  com: CommunityIcon3D,
  prof: ProfileIcon3D,
} as const;
