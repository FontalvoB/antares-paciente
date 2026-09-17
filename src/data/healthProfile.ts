/**
 * Perfil de salud ANTARES — datos demo del análisis final de la batería de
 * evaluación inicial (pantalla "Ver mi perfil de salud ANTARES · IA").
 * Espejo del análisis de `ANTARES_Tests_Perfil_Salud (1).html`.
 *
 * Las cadenas visibles son claves i18n: deben existir en es.json (identidad)
 * y en.json (traducción). Cuando el backend devuelve subescalas reales
 * (fetchMyResults), TestsPage las sobreescribe sobre las dimensiones demo.
 */

export interface HealthDim {
  ico: string;
  label: string;
  value: number;
  note: string;
  color: string;
}

export interface HealthPlanItem {
  specialty: string;
  title: string;
  prof: string;
  week: string;
  color: string;
  /** Acción opcional al tocar el ítem (navega a otra pantalla). */
  action?: "community";
}

export interface HealthProfile {
  /** Índice AHS global (0-100). */
  ahs: number;
  /** Lectura del AHS (ej. "Perfil adecuado"). */
  summary: string;
  /** Diagnóstico principal (ej. "Prediabetes"). */
  condition: string;
  /** Chips de resumen del encabezado. */
  chips: { ico: string; text: string }[];
  banner: { title: string; text: string };
  indicators: {
    ico: string;
    value: string;
    unit: string;
    qualifier: string;
    label: string;
    tone: "ok" | "warn" | "risk";
  }[];
  ai: { label: string; message: string };
  dims: HealthDim[];
  dofa: { f: string[]; d: string[]; o: string[]; a: string[] };
  correlations: { title: string; text: string; color: string }[];
  plan: HealthPlanItem[];
  footnote: string;
}

export const HEALTH_PROFILE: HealthProfile = {
  ahs: 59,
  summary: "Perfil adecuado",
  condition: "Prediabetes",
  chips: [
    { ico: "⚖️", text: "IMC 27.5 · Sobrepeso" },
    { ico: "🔬", text: "Grasa 26%" },
    { ico: "🩸", text: "Glucosa est. Normal" },
    { ico: "🧠", text: "Sanguíneo–Melancólico" },
    { ico: "💪", text: "IAC A2 · Moderada" },
    { ico: "🏃", text: "AMAF FLUJO" },
  ],
  banner: {
    title: "Prediabetes activa",
    text: "Tienes una ventana terapéutica óptima. El programa ADRED puede revertirla con nutrición y ejercicio desde la semana 1.",
  },
  indicators: [
    {
      ico: "⚖️",
      value: "27.5",
      unit: "IMC · kg/m²",
      qualifier: "Sobrepeso",
      label: "Índice de Masa Corporal",
      tone: "warn",
    },
    {
      ico: "🔬",
      value: "26%",
      unit: "Grasa corporal",
      qualifier: "Sobrepeso graso",
      label: "Método Deurenberg + ICC",
      tone: "warn",
    },
    {
      ico: "🩸",
      value: "82–99",
      unit: "Glucosa mg/dL",
      qualifier: "Normal",
      label: "Estimado de riesgo",
      tone: "ok",
    },
  ],
  ai: {
    label: "IA · Análisis integral",
    message:
      "Tu AHS de 59/100 indica un perfil adecuado. Tu IMC es 27.5 (Sobrepeso) con un % de grasa corporal estimado de 26% (Sobrepeso graso). La glucosa estimada está en rango 82–99 mg/dL — Normal. Con temperamento Sanguíneo–Melancólico, tienes un perfil social que se potencia con la comunidad Copp Adresd. Tu capacidad de movimiento es funcional (AMAF FLUJO), con adherencia declarada Moderada (IAC A2). En cuanto a nutrición, tienes conducta alimentaria con áreas de trabajo. Tu entorno personal muestra estrés relacional que puede boicotear el programa. Tu sueño es prioritario, lo que impacta directamente tu metabolismo y glucosa. El riesgo cardiometabólico es BAJO.",
  },
  dims: [
    {
      ico: "🩺",
      label: "Metabolismo",
      value: 85,
      note: "ORP: BAJO · IMC: 27.5 (Sobrepeso) · Glucosa: Normal",
      color: "#E87B2B",
    },
    {
      ico: "🥗",
      label: "Nutrición",
      value: 63,
      note: "Conducta alimentaria: riesgo moderado",
      color: "#1D9E75",
    },
    {
      ico: "🏃",
      label: "Movimiento",
      value: 50,
      note: "AMAF FLUJO · Nivel 3/6",
      color: "#1B6CA8",
    },
    {
      ico: "🌙",
      label: "Sueño",
      value: 25,
      note: "Prioritario",
      color: "#7C3AED",
    },
    {
      ico: "🤝",
      label: "Adherencia",
      value: 54,
      note: "IAC A2 — Moderada",
      color: "#5581A2",
    },
    {
      ico: "⚡",
      label: "Entorno relacional",
      value: 45,
      note: "ERS: elevado",
      color: "#D9534F",
    },
    {
      ico: "❤️",
      label: "Riesgo cardiovascular",
      value: 85,
      note: "ORP nivel 1 — BAJO",
      color: "#142855",
    },
  ],
  dofa: {
    f: [
      "Glucosa en rango normal — base metabólica estable",
      "Temperamento social — la comunidad Copp Adresd te potencia",
      "Ventana terapéutica abierta — la prediabetes es reversible",
    ],
    d: [
      "Sueño deficiente — impacta glucosa y peso",
      "Conducta alimentaria con áreas de trabajo",
    ],
    o: [
      "IMC 27.5 (sobrepeso leve) — reversible con el programa",
      "Nivel funcional con margen de mejora rápida",
      "Temperamento social — comunidad Copp Adresd es clave",
    ],
    a: ["Estrés relacional — barrera activa al cambio"],
  },
  correlations: [
    {
      title: "Sueño deficiente ↔ Glucosa alta",
      text: "Dormir menos de 6 horas aumenta la resistencia a la insulina. Mejorar el sueño mejora el control glucémico directamente.",
      color: "#7C3AED",
    },
    {
      title: "Estrés relacional ↔ Alimentación emocional",
      text: "Los dos juntos crean un ciclo vicioso que el plan nutricional solo no puede romper.",
      color: "#D9534F",
    },
  ],
  plan: [
    {
      specialty: "Metabólica",
      title: "Iniciar plan nutricional MNT ADA con reducción glucémica",
      prof: "Lic. Carmen Ruiz",
      week: "Semana 1",
      color: "#1D9E75",
    },
    {
      specialty: "Psicosocial",
      title: "Evaluación relacional y familiar — reducir barrera principal",
      prof: "Dra. Laura Méndez",
      week: "Semana 2",
      color: "#D97824",
    },
    {
      specialty: "Sueño",
      title: "Protocolo de higiene del sueño + evaluación de apnea",
      prof: "Dr. Arturo Godoy Cruz",
      week: "Semana 2",
      color: "#7C3AED",
    },
    {
      specialty: "Movimiento",
      title: "Iniciar protocolo AMAF FLUJO — 15-20 min/día",
      prof: "Dr. Arturo Godoy Cruz",
      week: "Semana 1",
      color: "#1B6CA8",
    },
    {
      specialty: "Comunidad",
      title: "Activar perfil Copp Adresd + unirse al grupo según diagnóstico",
      prof: "",
      week: "",
      color: "#5581A2",
      action: "community",
    },
  ],
  footnote:
    "* El % de grasa y la glucosa son estimados calculados con fórmulas validadas científicamente. No reemplazan una medición clínica. Tu equipo médico validará estos valores en tu primera consulta.",
};
