import { useEffect, useRef, useState } from "react";

export type VoicePhase =
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "muted"
  | "unavailable";

interface VoiceOrbProps {
  phase: VoicePhase;
  active: boolean;
  getVolume?: () => number;
}

const vertexSource = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const fragmentSource = `
precision mediump float;
varying vec2 v_uv;
uniform float u_time;
uniform float u_energy;
uniform float u_level;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float value = 0.0, weight = 0.5;
  for (int i = 0; i < 4; i++) {
    value += weight * noise(p);
    p = p * 2.03 + vec3(3.1, 1.7, 2.4);
    weight *= 0.5;
  }
  return value;
}
void main() {
  vec2 uv = v_uv / (0.88 + u_level * 0.07);
  float r = length(uv);
  float z = sqrt(max(0.0, 1.0 - dot(uv, uv)));
  vec3 p = vec3(uv * 2.1, z * 1.4);
  vec3 drift = vec3(u_time * 0.14, -u_time * 0.11, u_time * 0.18);
  float warp = fbm(p + drift);
  float cloud = fbm(p + vec3(warp * (2.0 + u_energy), warp, -warp) + drift);
  float folds = fbm(p * 1.8 + cloud * 2.3 - drift);
  float snow = smoothstep(0.35, 0.69, cloud * 0.8 + folds * 0.35);
  vec3 blue = mix(vec3(0.353, 0.482, 1.0), vec3(0.561, 0.722, 1.0), folds);
  vec3 color = mix(blue, vec3(0.98, 0.99, 1.0), snow);
  color *= 0.52 + z * 0.48 + u_energy * 0.16;
  float edge = 1.0 - smoothstep(0.94, 1.0, r + (warp - 0.5) * 0.06);
  float halo = exp(-r * r * 3.8) * 0.11;
  gl_FragColor = vec4(color * edge + blue * halo * (1.0 - edge), 1.0);
}`;

const dynamics = {
  connecting: [0.38, 0.22],
  listening: [0.48, 0.32],
  thinking: [0.22, 0.18],
  speaking: [0.78, 0.62],
  muted: [0, 0],
  unavailable: [0, 0],
} as const;

/** Gráfico decorativo propio: Ionic no tiene equivalente de nube procedural. */
export function VoiceOrb({ phase, active, getVolume }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ phase, getVolume });
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  const gray = phase === "muted" || phase === "unavailable";

  useEffect(() => {
    stateRef.current = { phase, getVolume };
  }, [phase, getVolume]);

  useEffect(() => {
    if (!active) return;
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [active]);

  useEffect(() => {
    if (!active || gray || reducedMotion || failed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    const shaders: WebGLShader[] = [];
    let frame = 0;
    let observer: ResizeObserver | undefined;
    const release = () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (!gl) return;
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      shaders.forEach((shader) => gl!.deleteShader(shader));
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      setFailed(true);
    };
    try {
      gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false });
      if (!gl) throw new Error("WebGL no disponible");
      const compile = (type: number, source: string) => {
        const shader = gl!.createShader(type);
        if (!shader) throw new Error("No se pudo crear el shader");
        shaders.push(shader);
        gl!.shaderSource(shader, source);
        gl!.compileShader(shader);
        if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
          throw new Error("No se pudo compilar el shader");
        }
        return shader;
      };
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      buffer = gl.createBuffer();
      if (!program || !buffer) throw new Error("No se pudo crear el orbe");
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error("No se pudo enlazar el shader");
      }
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      // Dos triángulos cubren todo el canvas con una única llamada de dibujo.
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const timeUniform = gl.getUniformLocation(program, "u_time");
      const energyUniform = gl.getUniformLocation(program, "u_energy");
      const levelUniform = gl.getUniformLocation(program, "u_level");
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const size = Math.max(1, Math.round(canvas.getBoundingClientRect().width * dpr));
        if (canvas.width !== size || canvas.height !== size) {
          canvas.width = canvas.height = size;
        }
        gl!.viewport(0, 0, size, size);
      };
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(canvas);
      let previous = 0, time = 0, level = 0;
      let [speed, energy]: number[] = [...dynamics[stateRef.current.phase]];
      const draw = (now: number) => {
        const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 1 / 60;
        previous = now;
        const current = stateRef.current;
        const [targetSpeed, targetEnergy] = dynamics[current.phase];
        let volume = 0;
        // Los getters del SDK leen su analizador 0–1; no crean otro micrófono.
        if (current.phase === "listening" || current.phase === "speaking") {
          try { volume = current.getVolume?.() ?? 0; } catch { /* Sesión terminando: respiración procedural. */ }
        }
        volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
        const smoothing = 1 - Math.exp(-dt * 7);
        level += (volume - level) * smoothing;
        speed += (targetSpeed - speed) * smoothing;
        energy += (targetEnergy - energy) * smoothing;
        time += dt * (speed + level * 1.5);
        const pulse = Math.sin(time * 2.0) * 0.035;
        gl!.uniform1f(timeUniform, time);
        gl!.uniform1f(energyUniform, energy + level * 0.6 + pulse);
        gl!.uniform1f(levelUniform, level + pulse);
        gl!.drawArrays(gl!.TRIANGLES, 0, 6);
        frame = requestAnimationFrame(draw);
      };
      canvas.addEventListener("webglcontextlost", contextLost);
      frame = requestAnimationFrame(draw);
    } catch {
      // Devolver null deja visible el orbe CSS original del shell.
      release();
      setFailed(true);
      return;
    }
    return () => {
      canvas.removeEventListener("webglcontextlost", contextLost);
      release();
    };
  }, [active, gray, reducedMotion, failed]);

  if (!active || gray) return null;
  if (reducedMotion) return <div className="voice-orb-visual voice-orb-static" aria-hidden="true" />;
  if (failed) return null;
  return <canvas ref={canvasRef} className="voice-orb-visual" aria-hidden="true" />;
}
