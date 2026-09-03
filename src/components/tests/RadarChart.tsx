import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Primitive: radar SVG de N dimensiones (perfil de salud).
 * Dibuja anillos de referencia, ejes y el polígono del perfil con vértices
 * coloreados por dimensión. No hay equivalente en Ionic (IonCharts no existe).
 */
export interface RadarDim {
  label: string;
  value: number;
  color: string;
  ico: string;
  note?: string;
}

export function RadarChart({
  dims,
  size = 172,
  dark = false,
}: {
  dims: RadarDim[];
  size?: number;
  dark?: boolean;
}) {
  const reduce = useReducedMotion();
  const gid = useId().replace(/:/g, "");
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 16;
  const n = Math.max(3, dims.length);
  const ringColor = dark ? "rgba(255,255,255,0.16)" : "rgba(20,40,85,0.12)";
  const axisColor = dark ? "rgba(255,255,255,0.1)" : "rgba(20,40,85,0.08)";

  const pt = (i: number, f: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r * f, cy + Math.sin(a) * r * f];
  };
  const clamp = (v: number) => Math.min(1, Math.max(0.06, v / 100));
  const toPoints = (f: number) =>
    Array.from({ length: n }, (_, i) => {
      const [x, y] = pt(i, f);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

  const rings = [0.25, 0.5, 0.75, 1].map(toPoints);
  const poly = toPoints(0);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="radar"
    >
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5581A2" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#1D9E75" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {rings.map((p, i) => (
        <polygon
          key={`ring-${i}`}
          points={p}
          fill="none"
          stroke={ringColor}
          strokeWidth="1"
        />
      ))}
      {dims.map((_, i) => {
        const [x, y] = pt(i, 1);
        return (
          <line
            key={`ax-${i}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke={axisColor}
            strokeWidth="1"
          />
        );
      })}
      <motion.polygon
        points={poly}
        fill={`url(#${gid})`}
        stroke="#5581A2"
        strokeWidth="2"
        strokeLinejoin="round"
        initial={reduce ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {dims.map((d, i) => {
        const [x, y] = pt(i, clamp(d.value));
        return (
          <circle
            key={`pt-${i}`}
            cx={x}
            cy={y}
            r="3.5"
            fill={d.color}
            stroke="#fff"
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}
