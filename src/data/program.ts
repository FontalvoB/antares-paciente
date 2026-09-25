import type { ProgramTaskId } from "../types";

export const PROGRAM_WEEKS = 83;

export const WEEK_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const;
export const CAL_DAY_LABELS = [
  "Do",
  "Lu",
  "Ma",
  "Mi",
  "Ju",
  "Vi",
  "Sá",
] as const;

export const PROGRAM_TASKS: {
  id: ProgramTaskId;
  title: string;
  short: string;
  pts: number;
  tone: "pur" | "red" | "teal" | "blue" | "org" | "indigo";
  hint: string;
  emoji: string;
}[] = [
  {
    id: "podcast",
    title: "Escuchar podcast",
    short: "Biohacking y metabolismo · 8 min",
    pts: 80,
    tone: "pur",
    hint: "Episodio del día · Dr. Ramírez",
    emoji: "🎙️",
  },
  {
    id: "vitals",
    title: "Medir signos vitales",
    short: "FC · SpO2 · Glucosa · Peso",
    pts: 120,
    tone: "red",
    hint: "Registra o sincroniza tu wearable",
    emoji: "❤️",
  },
  {
    id: "nut",
    title: "Cumplir plan nutricional",
    short: "Mediterráneo · 1,800 kcal",
    pts: 150,
    tone: "teal",
    hint: "Adherencia del menú de hoy",
    emoji: "🥗",
  },
  {
    id: "ejercicio",
    title: "Hacer ejercicio del día",
    short: "Circuito 12 min · Semana 12",
    pts: 150,
    tone: "blue",
    hint: "6 estaciones guiadas",
    emoji: "🏃",
  },
  {
    id: "nutraceutico",
    title: "Tomar nutracéutico",
    short: "Dosis diaria matutina",
    pts: 80,
    tone: "org",
    hint: "Producto ADRED · 1 cápsula",
    emoji: "💊",
  },
  {
    id: "emocional",
    title: "Evaluación emocional",
    short: "Estado psicológico · Semana 12",
    pts: 120,
    tone: "indigo",
    hint: "Check-in de bienestar",
    emoji: "🧠",
  },
];

export const PROGRAM_POINTS_MAX = PROGRAM_TASKS.reduce(
  (sum, t) => sum + t.pts,
  0,
);
export const DAY_BONUS_PTS = 50;

export const PROGRAM_LEVELS = [
  { name: "Explorador", min: 0, max: 499 },
  { name: "Iniciado", min: 500, max: 1499 },
  { name: "Constante", min: 1500, max: 2999 },
  { name: "Disciplinado", min: 3000, max: 4999 },
  { name: "Transformación", min: 5000, max: 7999 },
  { name: "Bienestar", min: 8000, max: 11999 },
  { name: "Maestro", min: 12000, max: 99999 },
] as const;

export function levelForXp(xp: number) {
  let idx = 0;
  for (let i = PROGRAM_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= PROGRAM_LEVELS[i].min) {
      idx = i;
      break;
    }
  }
  const lv = PROGRAM_LEVELS[idx];
  const span = lv.max - lv.min || 1;
  const pct = Math.min(1, Math.max(0, (xp - lv.min) / span));
  return { idx, level: idx + 1, name: lv.name, min: lv.min, max: lv.max, pct };
}

export interface VitalField {
  id: string;
  emoji: string;
  label: string;
  unit: string;
  hint: string;
  /** Rango saludable (Bajo / Alto / En rango) en la unidad canónica. */
  lo: number;
  hi: number;
  /** Dominio visible de la barra (unidad canónica); por defecto `lo..hi`. */
  min?: number;
  max?: number;
  /** Factor del input del usuario a la unidad canónica (horas → minutos = 60). */
  scale?: number;
  /** `goal` = meta acumulada (pasos) en vez de rango. */
  kind?: "range" | "goal";
  goal?: number;
}

export const VITAL_FIELDS: readonly VitalField[] = [
  // Orden de presentación: lecturas del wearable y luego peso, temperatura y glucosa.
  {
    id: "fc",
    emoji: "❤️",
    label: "Frecuencia cardíaca",
    unit: "lpm",
    hint: "50–100 en reposo",
    lo: 50,
    hi: 100,
    min: 30,
    max: 180,
  },
  {
    id: "pa",
    emoji: "🩺",
    label: "Presión arterial",
    unit: "mmHg",
    hint: "Ideal < 130/80",
    lo: 90,
    hi: 130,
    min: 60,
    max: 200,
  },
  {
    id: "spo2",
    emoji: "💨",
    label: "SpO2",
    unit: "%",
    hint: "Meta ≥ 95%",
    lo: 95,
    hi: 100,
    min: 80,
    max: 100,
  },
  // Del wearable: el sync los autollena desde el acumulado del día.
  {
    id: "pasos",
    emoji: "🚶",
    label: "Pasos",
    unit: "pasos",
    hint: "Meta 8,000",
    lo: 0,
    hi: 8000,
    min: 0,
    max: 8000,
    kind: "goal",
    goal: 8000,
  },
  // El sueño se captura y se envía en HORAS (canónico en minutos: scale 60).
  {
    id: "sueno",
    emoji: "🌙",
    label: "Sueño",
    unit: "h",
    hint: "7–9 h",
    lo: 420,
    hi: 540,
    min: 0,
    max: 720,
    scale: 60,
  },
  {
    id: "peso",
    emoji: "⚖️",
    label: "Peso",
    unit: "kg",
    hint: "Tendencia > cifra",
    lo: 50,
    hi: 140,
    min: 30,
    max: 160,
  },
  {
    id: "temp",
    emoji: "🌡️",
    label: "Temperatura",
    unit: "°C",
    hint: "36.1–37.2",
    lo: 36,
    hi: 37.2,
    min: 34,
    max: 41,
  },
  {
    id: "glu",
    emoji: "🩸",
    label: "Glucosa",
    unit: "mg/dL",
    hint: "Ayunas 70–99",
    lo: 70,
    hi: 99,
    min: 40,
    max: 200,
  },
];

export const EMOTION_FACES = [
  { v: "1", face: "😔", label: "Bajo" },
  { v: "2", face: "😕", label: "Regular" },
  { v: "3", face: "😐", label: "Neutro" },
  { v: "4", face: "🙂", label: "Bien" },
  { v: "5", face: "😄", label: "Alto" },
];

export const WEEK_BARRIERS = [
  { id: "antojos", label: "🍔 Antojos" },
  { id: "tiempo", label: "⏰ Falta de tiempo" },
  { id: "menu", label: "🍽️ No me gustó el menú" },
  { id: "emocional", label: "😔 Estado emocional" },
  { id: "comprension", label: "❓ No entendí el plan" },
  { id: "ninguno", label: "✅ Nada, fue bien" },
];
