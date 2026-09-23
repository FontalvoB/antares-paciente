import { useEffect, useRef } from "react";
import { ecgColumn } from "../utils/ecg";

// Traza tipo ECG sobre canvas: el RITMO lo pone la FC real medida (`bpm`) y la
// forma del latido es sintética (ver utils/ecg.ts). Sin lectura queda una línea
// plana — nunca se simula un pulso que no se está midiendo.
//
// Detalles: una muestra por columna de píxel (con sub-muestreo para no perder
// el pico R), buffer circular que se desplaza de derecha a izquierda, se pausa
// con la pestaña oculta, cancela el rAF al desmontar y con
// `prefers-reduced-motion` dibuja una tira estática.
//
// El ancho se re-mide EN EL BUCLE: al montar el contenedor puede no tener
// layout todavía (clientWidth 0/1) y el canvas se quedaba con un bitmap de 1 px
// (solo se veían las líneas horizontales de la rejilla estiradas).

/** Ventana visible de la tira, en segundos. */
const WINDOW_SECONDS = 4;
/** Sub-muestras por columna: mantiene estable el pico R al desplazarse. */
const SUB_SAMPLES = 4;
/** Separación de la rejilla de fondo, en píxeles. */
const GRID_STEP = 14;

export function EcgTrace({
  bpm,
  height = 56,
  className,
}: {
  bpm?: number;
  height?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bpmRef = useRef<number | undefined>(bpm);
  bpmRef.current = bpm;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const styles = window.getComputedStyle(canvas);
    const trace = styles.getPropertyValue("--ecg-trace").trim() || "#4ade80";
    const grid =
      styles.getPropertyValue("--ecg-grid").trim() ||
      "rgba(74, 222, 128, 0.16)";
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let raf = 0;
    let width = 0;
    let buffer = new Float32Array(0);
    let write = 0;
    let phase = 0;
    let carry = 0;
    let last = 0;

    const draw = () => {
      if (width <= 0) return;
      const mid = height / 2;
      const amplitude = height * 0.42;
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += GRID_STEP) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = mid % GRID_STEP; y <= height; y += GRID_STEP) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      ctx.strokeStyle = trace;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let index = 0; index < width; index++) {
        const value = buffer[(write + index) % width] ?? 0;
        const y = mid - value * amplitude;
        if (index === 0) ctx.moveTo(index, y);
        else ctx.lineTo(index, y);
      }
      ctx.stroke();
    };

    /** Rellena la tira con latidos al ritmo actual (ceros si no hay FC). */
    const prefill = () => {
      const rate = bpmRef.current ?? 0;
      if (!(rate > 0) || width <= 0) return;
      const phasePerColumn = rate / 60 / (width / WINDOW_SECONDS);
      for (let index = 0; index < width; index++) {
        const behind = width - 1 - index;
        const p = (((-behind * phasePerColumn) % 1) + 1) % 1;
        buffer[index] = ecgColumn(p, phasePerColumn, SUB_SAMPLES);
      }
      write = 0;
      phase = 0;
    };

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = Math.max(0, Math.round(canvas.clientWidth));
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      buffer = new Float32Array(Math.max(1, width));
      carry = 0;
      prefill();
      draw();
    };

    const advance = (deltaMs: number) => {
      if (width <= 0) return;
      const rate = bpmRef.current ?? 0;
      const beatsPerSecond = rate > 0 ? rate / 60 : 0;
      const pixelsPerSecond = width / WINDOW_SECONDS;
      const phasePerColumn = beatsPerSecond / pixelsPerSecond;

      carry += (pixelsPerSecond * deltaMs) / 1000;
      let columns = Math.floor(carry);
      carry -= columns;
      // Pestaña que vuelve tras mucho tiempo: no recalcular media tira.
      columns = Math.min(columns, width);

      for (let index = 0; index < columns; index++) {
        buffer[write] =
          phasePerColumn > 0
            ? ecgColumn(phase, phasePerColumn, SUB_SAMPLES)
            : 0;
        write = (write + 1) % width;
        phase = (phase + phasePerColumn) % 1;
      }
    };

    const frame = (now: number) => {
      const delta = last === 0 ? 0 : now - last;
      last = now;
      // El contenedor puede cambiar de ancho (rotación, layout tardío).
      if (Math.round(canvas.clientWidth) !== width) resize();
      if (!document.hidden) {
        advance(delta);
        draw();
      }
      raf = window.requestAnimationFrame(frame);
    };

    resize();
    if (!reduced) {
      last = 0;
      raf = window.requestAnimationFrame(frame);
    }
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(raf);
    };
  }, [height]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height, display: "block" }}
      aria-hidden="true"
    />
  );
}
