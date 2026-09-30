/**
 * Visuales vivas de la vista de foco (una por métrica). SVG + CSS puros, sin
 * librerías: la FC reutiliza EcgTrace (traza real al ritmo medido), aquí van
 * las dos ambientales (SpO2 y presión). Con `prefers-reduced-motion` quedan
 * estáticas (ver global.css).
 */

/** Gota de oxígeno con burbujas ascendentes (SpO2). */
export function Spo2Bubbles() {
  return (
    <svg
      className="mmo-spo2"
      viewBox="0 0 64 72"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="mmo-drop"
        d="M32 4 C32 4 12 30 12 44 a20 20 0 0 0 40 0 C52 30 32 4 32 4 Z"
      />
      <circle className="mmo-bubble mmo-b1" cx="26" cy="52" r="3" />
      <circle className="mmo-bubble mmo-b2" cx="34" cy="54" r="2.2" />
      <circle className="mmo-bubble mmo-b3" cx="30" cy="56" r="1.6" />
    </svg>
  );
}

/**
 * Onda de presión arterial en bucle (un latido con muesca dicrótica,
 * estilizado). El trazado se dibuja solo con stroke-dashoffset.
 */
export function BpWave() {
  return (
    <svg
      className="mmo-bp"
      viewBox="0 0 120 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="mmo-wave-path"
        pathLength={100}
        d="M2 34 H28 L36 34 L42 12 L48 34 L54 34 L60 26 L64 34 H90 L96 34 L102 12 L108 34 H118"
        fill="none"
      />
    </svg>
  );
}
