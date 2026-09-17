/**
 * Datos demo de la batería de evaluación inicial ANTARES — espejo EXACTO de
 * `ANTARES_Tests_Perfil_Salud (1).html` (9 tests, 50 preguntas, títulos y
 * iconos por opción) y del seed del backend
 * (`coppAddresdBack/scripts/generate_health_tests_seed.py`). Cuando hay
 * sesión/backend, la app usa /me/*; sin sesión degrada a estos datos.
 */

export interface ScaleQ {
  text: string;
  section?: string;
}

export interface DemoOption {
  /** Icono/emoji de la opción (del HTML). */
  ico: string;
  text: string;
  score: number;
}

export interface DemoQuestion {
  /** Id estable (mismo que el HTML: dx, med, sexo, edad, ...). */
  id: string;
  /** Etiqueta/sección de la pregunta (q-label del HTML). */
  section: string | null;
  text: string;
  type: "scale" | "single" | "multi" | "open" | "num";
  /** Instrucción/ayuda bajo el texto (q-sub del HTML). */
  hint?: string;
  /** Metadata del tipo num (biometría). */
  unit?: string;
  min?: number;
  max?: number;
  def?: number;
  /** Etiquetas de extremos de la escala Likert. */
  minLabel?: string;
  maxLabel?: string;
  /** Opciones para single/multi (score_value del seed). */
  options?: DemoOption[];
}

export interface DemoTest {
  id: number;
  emoji: string;
  /** Título amigable para el paciente (title del HTML). */
  title: string;
  /** Nombre corto de la tarjeta (tag del HTML). */
  tag: string;
  sub: string;
  pts: number;
  bg: string;
  questions: DemoQuestion[];
}

const SCALE_OPTS: DemoOption[] = [1, 2, 3, 4, 5].map((n) => ({
  ico: ["😞", "😐", "😊", "😃", "🤩"][n - 1],
  text: String(n),
  score: n - 1,
}));

const single = (entries: [string, string][]): DemoOption[] =>
  entries.map(([ico, text], i) => ({ ico, text, score: i }));

const multi = (entries: [string, string][]): DemoOption[] =>
  entries.map(([ico, text]) => ({
    ico,
    text,
    score: /ningun|bien/i.test(text) ? 0 : 1,
  }));

export const TESTS: DemoTest[] = [
  {
    id: 1,
    emoji: "🩺",
    title: "¿Cómo está tu salud?",
    tag: "Historia clínica",
    sub: "Antecedentes, medicamentos y cómo te sientes físicamente.",
    pts: 50,
    bg: "#E8F5FF",
    questions: [
      {
        id: "dx",
        section: "Diagnósticos actuales",
        text: "¿Cuál de estos diagnósticos tienes actualmente?",
        hint: "Marca todos los que aplican.",
        type: "multi",
        options: multi([
          ["🩸", "Diabetes tipo 2"],
          ["⚖️", "Obesidad"],
          ["💗", "Hipertensión"],
          ["🫀", "Prediabetes"],
          ["🧬", "Colesterol alto"],
          ["✅", "Ninguno por ahora"],
        ]),
      },
      {
        id: "med",
        section: "Medicamentos",
        text: "¿Tomas medicamentos actualmente?",
        type: "single",
        options: single([
          ["💊", "Sí, con receta médica"],
          ["🌿", "Solo suplementos"],
          ["✖️", "No tomo nada"],
        ]),
      },
      {
        id: "sexo",
        section: "Datos personales · Sexo biológico",
        text: "¿Cuál es tu sexo biológico?",
        hint: "Necesario para calcular tu % de grasa corporal con mayor precisión.",
        type: "single",
        options: single([
          ["♂️", "Masculino"],
          ["♀️", "Femenino"],
        ]),
      },
      {
        id: "edad",
        section: "Datos personales · Edad",
        text: "¿Cuántos años tienes?",
        type: "num",
        unit: "años",
        min: 18,
        max: 90,
        def: 40,
      },
      {
        id: "peso",
        section: "Biometría · Peso corporal",
        text: "¿Cuánto pesas? Si tienes báscula en casa, pésate ahora.",
        hint: "Párate en la báscula con ropa ligera, sin zapatos. Si no tienes, pon un aproximado.",
        type: "num",
        unit: "kg",
        min: 40,
        max: 220,
        def: 75,
      },
      {
        id: "talla",
        section: "Biometría · Estatura",
        text: "¿Cuánto mides de estatura?",
        hint: "Párate derecho/a contra una pared y marca con un libro. Mide hasta el suelo.",
        type: "num",
        unit: "cm",
        min: 140,
        max: 210,
        def: 165,
      },
      {
        id: "cintura",
        section: "Biometría · Cintura",
        text: "¿Cuánto mide tu cintura al nivel del ombligo?",
        hint: "Con una cinta métrica (o tira de papel que luego mides), rodea tu abdomen a la altura del ombligo al exhalar.",
        type: "num",
        unit: "cm",
        min: 50,
        max: 180,
        def: 90,
      },
      {
        id: "cadera",
        section: "Biometría · Cadera",
        text: "¿Cuánto mide la parte más ancha de tu cadera?",
        hint: "Mide alrededor de la parte más amplia de tus caderas y glúteos.",
        type: "num",
        unit: "cm",
        min: 60,
        max: 200,
        def: 100,
      },
      {
        id: "muneca",
        section: "Biometría · Muñeca",
        text: "¿Cuánto mide tu muñeca?",
        hint: "Rodea tu muñeca dominante con la cinta por debajo de los huesos del puño. Este dato ayuda a calcular tu % de grasa.",
        type: "num",
        unit: "cm",
        min: 12,
        max: 25,
        def: 17,
      },
      {
        id: "gluc_ayunas",
        section: "Glucosa · Última medición en ayunas",
        text: "¿Tienes glucómetro en casa o algún resultado reciente de glucosa en ayunas?",
        hint: "Ayunas = sin haber comido en las últimas 8 horas.",
        type: "single",
        options: single([
          ["✅", "Sí, está en rango (< 100 mg/dL)"],
          ["⚠️", "Sí, entre 100 y 125 mg/dL"],
          ["🔴", "Sí, 126 mg/dL o más"],
          ["❓", "No sé o no me la he medido"],
        ]),
      },
      {
        id: "gluc_sintomas",
        section: "Glucosa · Señales del cuerpo",
        text: "¿Cuáles de estas señales reconoces en tu cuerpo con frecuencia?",
        hint: "Estas señales ayudan a estimar si tu glucosa puede estar elevada.",
        type: "multi",
        options: multi([
          ["💧", "Sed intensa todo el día"],
          ["🚽", "Orinas muchas veces al día"],
          ["😴", "Cansancio después de comer"],
          ["🍬", "Antojos intensos de dulce"],
          ["👁️", "Vista borrosa ocasional"],
          ["😊", "No tengo ninguna de estas"],
        ]),
      },
      {
        id: "sintomas",
        section: "Síntomas frecuentes generales",
        text: "Además de lo anterior, ¿tienes alguno de estos síntomas con regularidad?",
        hint: "Marca todos los que aplican.",
        type: "multi",
        options: multi([
          ["🦶", "Hormigueo en pies o manos"],
          ["🩹", "Heridas que tardan en sanar"],
          ["😤", "Dificultad para respirar"],
          ["😊", "Me siento bien en general"],
        ]),
      },
      {
        id: "antfam",
        section: "Antecedentes familiares",
        text: "¿Algún familiar directo tiene o tuvo alguna de estas condiciones?",
        hint: "Padres, hermanos, abuelos.",
        type: "multi",
        options: multi([
          ["🩸", "Diabetes"],
          ["💗", "Hipertensión"],
          ["🫀", "Infarto o ACV"],
          ["⚖️", "Obesidad"],
          ["✅", "Sin antecedentes"],
        ]),
      },
    ],
  },
  {
    id: 2,
    emoji: "🧠",
    title: "¿Cómo eres tú?",
    tag: "Temperamento",
    sub: "Tu personalidad determina cómo te acompañamos en el programa.",
    pts: 40,
    bg: "#F3EFFE",
    questions: [
      {
        id: "temp_social",
        section: "Temperamento · Dimensión social",
        text: "Me siento bien en grupos grandes y hago amigos con facilidad.",
        type: "scale",
        minLabel: "Nunca",
        maxLabel: "Siempre",
        options: SCALE_OPTS,
      },
      {
        id: "temp_metas",
        section: "Temperamento · Metas y resultados",
        text: "Cuando me propongo algo, lo hago sin importar los obstáculos.",
        type: "scale",
        minLabel: "Nunca",
        maxLabel: "Siempre",
        options: SCALE_OPTS,
      },
      {
        id: "temp_analisis",
        section: "Temperamento · Análisis y detalle",
        text: "Antes de actuar, analizo bien todas las opciones disponibles.",
        type: "scale",
        minLabel: "Nunca",
        maxLabel: "Siempre",
        options: SCALE_OPTS,
      },
      {
        id: "temp_rutina",
        section: "Temperamento · Rutina y estabilidad",
        text: "Prefiero tener rutinas fijas y predecibles en mi vida diaria.",
        type: "scale",
        minLabel: "Nunca",
        maxLabel: "Siempre",
        options: SCALE_OPTS,
      },
      {
        id: "temp_emociones",
        section: "Temperamento · Reacción emocional",
        text: "Cuando algo no sale como esperaba, ¿cuál es tu reacción más común?",
        type: "single",
        options: single([
          ["😤", "Me frustro pero sigo intentando"],
          ["😢", "Lo siento mucho y reflexiono"],
          ["😄", "Lo dejo ir y busco algo nuevo"],
          ["😌", "Lo acepto y espero el momento"],
        ]),
      },
      {
        id: "temp_abandono",
        section: "Temperamento · Constancia",
        text: "¿Qué es lo más probable que te haga abandonar un programa de salud?",
        type: "single",
        options: single([
          ["😴", "La monotonía y el aburrimiento"],
          ["📉", "No ver resultados rápidos"],
          ["🤯", "Tener demasiada información"],
          ["🔄", "Cambiar mi rutina habitual"],
        ]),
      },
    ],
  },
  {
    id: 3,
    emoji: "🥗",
    title: "¿Cómo comes?",
    tag: "Nutrición",
    sub: "Tus hábitos alimentarios y tu relación con la comida.",
    pts: 40,
    bg: "#E1F5EE",
    questions: [
      {
        id: "nut_comidas",
        section: "Hábitos · Frecuencia",
        text: "¿Cuántas veces al día comes normalmente (incluyendo meriendas)?",
        type: "single",
        options: single([
          ["1️⃣", "1–2 veces"],
          ["3️⃣", "3 veces"],
          ["4️⃣", "4–5 veces"],
          ["🔄", "Pico todo el día"],
        ]),
      },
      {
        id: "nut_emocional",
        section: "Conducta · Alimentación emocional",
        text: "Como más de lo planeado cuando estoy estresado/a, triste o ansioso/a.",
        type: "scale",
        minLabel: "Nunca",
        maxLabel: "Siempre",
        options: SCALE_OPTS,
      },
      {
        id: "nut_control",
        section: "Conducta · Control de porciones",
        text: "Me cuesta controlar la cantidad de comida que sirvo en mi plato.",
        type: "scale",
        minLabel: "Nunca",
        maxLabel: "Siempre",
        options: SCALE_OPTS,
      },
      {
        id: "nut_procesados",
        section: "Hábitos · Ultraprocesados",
        text: "Como alimentos ultraprocesados (snacks, comida rápida, gaseosas) más de 3 veces por semana.",
        type: "scale",
        minLabel: "Nunca",
        maxLabel: "Siempre",
        options: SCALE_OPTS,
      },
      {
        id: "nut_agua",
        section: "Hidratación · Agua diaria",
        text: "¿Cuánta agua tomas al día aproximadamente?",
        type: "single",
        options: single([
          ["😞", "Menos de 4 vasos"],
          ["😐", "4–6 vasos"],
          ["😊", "7–8 vasos"],
          ["💧", "Más de 8 vasos"],
        ]),
      },
      {
        id: "nut_motivacion",
        section: "Motivación · Disposición al cambio",
        text: "Estoy dispuesto/a a cambiar mis hábitos alimenticios si tengo el apoyo adecuado.",
        type: "scale",
        minLabel: "Para nada",
        maxLabel: "Totalmente",
        options: SCALE_OPTS,
      },
    ],
  },
  {
    id: 4,
    emoji: "🏃",
    title: "¿Qué tan activo/a eres?",
    tag: "Movimiento · AMAF",
    sub: "Tu capacidad física actual determina el circuito que te asignamos.",
    pts: 40,
    bg: "#FFF0E8",
    questions: [
      {
        id: "mov_actual",
        section: "Actividad · Nivel actual",
        text: "¿Cómo describes tu nivel de actividad física actualmente?",
        type: "single",
        options: single([
          ["🛋️", "Sedentario/a — casi no me muevo"],
          ["🚶", "Camino un poco (< 30 min/día)"],
          ["🏃", "Actividad moderada (30–60 min)"],
          ["💪", "Activo/a (ejercicio regular)"],
        ]),
      },
      {
        id: "mov_fatiga",
        section: "Capacidad · Resistencia",
        text: "Me canso fácilmente al subir escaleras o caminar 10 minutos.",
        type: "scale",
        minLabel: "Nunca",
        maxLabel: "Siempre",
        options: SCALE_OPTS,
      },
      {
        id: "mov_dolor",
        section: "Limitaciones · Dolor",
        text: "¿Tienes dolor articular o muscular que limita tu movimiento?",
        type: "single",
        options: single([
          ["✅", "No, me muevo sin dolor"],
          ["⚠️", "Dolor leve ocasional"],
          ["🔴", "Dolor frecuente que me limita"],
        ]),
      },
      {
        id: "mov_tiempo",
        section: "Disponibilidad · Tiempo",
        text: "¿Cuánto tiempo puedes dedicar al ejercicio por día?",
        type: "single",
        options: single([
          ["⏱️", "5–10 minutos"],
          ["🕐", "15–20 minutos"],
          ["🕑", "30–45 minutos"],
          ["🕒", "Más de 45 minutos"],
        ]),
      },
    ],
  },
  {
    id: 5,
    emoji: "🌙",
    title: "¿Cómo duermes?",
    tag: "Sueño",
    sub: "El sueño impacta directamente tu glucosa, tu peso y tu adherencia.",
    pts: 40,
    bg: "#EDE9FE",
    questions: [
      {
        id: "sue_horas",
        section: "Sueño · Horas por noche",
        text: "¿Cuántas horas duermes normalmente por noche?",
        type: "single",
        options: single([
          ["😞", "Menos de 5 horas"],
          ["😐", "5–6 horas"],
          ["😊", "6–7 horas"],
          ["✅", "7–9 horas"],
        ]),
      },
      {
        id: "sue_calidad",
        section: "Sueño · Calidad",
        text: "Me despierto descansado/a y con energía para empezar el día.",
        type: "scale",
        minLabel: "Nunca",
        maxLabel: "Siempre",
        options: SCALE_OPTS,
      },
      {
        id: "sue_ronquidos",
        section: "Red flags · Ronquidos",
        text: "¿Te han dicho que roncas fuerte o que paras de respirar mientras duermes?",
        type: "single",
        options: single([
          ["✅", "No, nunca"],
          ["😐", "A veces"],
          ["🚨", "Sí, frecuentemente"],
        ]),
      },
      {
        id: "sue_somnolencia",
        section: "Red flags · Somnolencia diurna",
        text: "Me da mucho sueño durante el día, aunque haya dormido mis horas.",
        type: "scale",
        minLabel: "Nunca",
        maxLabel: "Siempre",
        options: SCALE_OPTS,
      },
    ],
  },
  {
    id: 6,
    emoji: "🤝",
    title: "¿Qué tan comprometido/a estás?",
    tag: "Adherencia · IAC",
    sub: "Tu motivación real determina cómo te acompañamos.",
    pts: 40,
    bg: "#E6F1FB",
    questions: [
      {
        id: "adh_compromiso",
        section: "Compromiso · Motivación",
        text: "Estoy dispuesto/a a cambiar mis hábitos aunque sea difícil al principio.",
        type: "scale",
        minLabel: "Para nada",
        maxLabel: "Totalmente",
        options: SCALE_OPTS,
      },
      {
        id: "adh_constancia",
        section: "Compromiso · Constancia",
        text: "Cuando empiezo un programa o tratamiento, lo termino aunque sea duro.",
        type: "scale",
        minLabel: "Nunca",
        maxLabel: "Siempre",
        options: SCALE_OPTS,
      },
      {
        id: "adh_barreras",
        section: "Barreras · Obstáculos reales",
        text: "¿Qué podría impedirte seguir el programa con constancia?",
        hint: "Sé honesto/a, esto nos ayuda a personalizar tu apoyo.",
        type: "multi",
        options: multi([
          ["⏰", "Falta de tiempo"],
          ["💸", "Costo económico"],
          ["😔", "Desmotivación"],
          ["👨‍👩‍👧", "Responsabilidades familiares"],
          ["💼", "Trabajo o estudio"],
          ["💪", "Ninguna — estoy listo/a"],
        ]),
      },
      {
        id: "adh_proposito",
        section: "Propósito · Razón principal",
        text: "¿Cuál es tu razón más importante para unirte al programa?",
        type: "single",
        options: single([
          ["🩺", "Controlar mi enfermedad"],
          ["⚖️", "Bajar de peso"],
          ["⚡", "Tener más energía"],
          ["👨‍👩‍👧", "Por mi familia"],
          ["🧠", "Sentirme mejor conmigo mismo/a"],
        ]),
      },
    ],
  },
  {
    id: 7,
    emoji: "❤️",
    title: "¿Cuál es tu riesgo cardiovascular?",
    tag: "Riesgo cardiometabólico ORP",
    sub: "Información clínica confidencial — solo la ve tu equipo médico.",
    pts: 40,
    bg: "#FCEBEB",
    questions: [
      {
        id: "card_hba1c",
        section: "Laboratorios · HbA1c (si la tienes)",
        text: "¿Cuál fue tu último resultado de hemoglobina glicosilada (HbA1c)?",
        hint: 'Si no la tienes, selecciona "No la sé".',
        type: "single",
        options: single([
          ["✅", "Menos de 5.7%"],
          ["⚠️", "5.7% – 6.4%"],
          ["🔴", "6.5% o más"],
          ["❓", "No la sé"],
        ]),
      },
      {
        id: "card_pa",
        section: "Tensión arterial · Última medición",
        text: "¿Cuál es tu presión arterial habitual?",
        type: "single",
        options: single([
          ["✅", "Normal (< 130/80)"],
          ["⚠️", "Elevada (130–140 / 80–90)"],
          ["🔴", "Alta (> 140/90)"],
          ["❓", "No la sé"],
        ]),
      },
      {
        id: "card_tabaco",
        section: "Hábitos · Tabaquismo",
        text: "¿Fumas actualmente o has fumado en los últimos 5 años?",
        type: "single",
        options: single([
          ["✅", "Nunca he fumado"],
          ["⏳", "Fumé pero lo dejé"],
          ["🚬", "Sí, fumo actualmente"],
        ]),
      },
      {
        id: "card_colesterol",
        section: "Laboratorios · Colesterol",
        text: "¿Tu médico te ha dicho que tienes colesterol o triglicéridos altos?",
        type: "single",
        options: single([
          ["✅", "No, están en rango normal"],
          ["⚠️", "Sí, pero controlado con dieta"],
          ["💊", "Sí, tomo medicamento"],
          ["❓", "No lo sé"],
        ]),
      },
    ],
  },
  {
    id: 8,
    emoji: "⚡",
    title: "¿Cómo está tu entorno?",
    tag: "Estrés relacional · ERS",
    sub: "El estrés en casa o en el trabajo es la barrera #1 de la adherencia.",
    pts: 40,
    bg: "#FAEEDA",
    questions: [
      {
        id: "ers_familia",
        section: "Familia · Ambiente en casa",
        text: "El ambiente en mi hogar es tranquilo y me siento apoyado/a.",
        type: "scale",
        minLabel: "Para nada",
        maxLabel: "Totalmente",
        options: SCALE_OPTS,
      },
      {
        id: "ers_trabajo",
        section: "Trabajo · Carga laboral",
        text: "Mi trabajo o estudio me genera estrés frecuente o sobrecarga.",
        type: "scale",
        minLabel: "Nunca",
        maxLabel: "Siempre",
        options: SCALE_OPTS,
      },
      {
        id: "ers_apoyo",
        section: "Red de apoyo · Apoyo externo",
        text: "¿Tienes alguien (familia, amigo, pareja) que te acompañe en este proceso?",
        type: "single",
        options: single([
          ["💪", "Sí, tengo apoyo sólido"],
          ["😐", "Algo de apoyo"],
          ["😔", "Lo hago prácticamente solo/a"],
        ]),
      },
      {
        id: "ers_tiempo",
        section: "Gestión · Tiempo personal",
        text: "Logro reservar tiempo para mí mismo/a en medio de mis responsabilidades.",
        type: "scale",
        minLabel: "Nunca",
        maxLabel: "Siempre",
        options: SCALE_OPTS,
      },
    ],
  },
  {
    id: 9,
    emoji: "🌱",
    title: "¿Cuál es tu propósito?",
    tag: "Propósito · Copp Adresd",
    sub: "Las respuestas más importantes del programa. Sé completamente honesto/a.",
    pts: 50,
    bg: "#FDF6DC",
    questions: [
      {
        id: "prop_urgencia",
        section: "Propósito · Urgencia del cambio",
        text: "Siento que necesito cambiar mis hábitos ahora, no más adelante.",
        type: "scale",
        minLabel: "Para nada",
        maxLabel: "Totalmente",
        options: SCALE_OPTS,
      },
      {
        id: "prop_creencia",
        section: "Mentalidad · Posibilidad de cambio",
        text: "Creo que puedo mejorar mi salud con el esfuerzo y el apoyo correctos.",
        type: "scale",
        minLabel: "No lo creo",
        maxLabel: "Totalmente",
        options: SCALE_OPTS,
      },
      {
        id: "prop_plazo",
        section: "Expectativas · Plazo esperado",
        text: "¿En cuánto tiempo esperas ver resultados concretos en tu salud?",
        type: "single",
        options: single([
          ["⚡", "Menos de 1 mes"],
          ["📅", "2–3 meses"],
          ["🎯", "6 meses"],
          ["♾️", "Es un proceso de vida"],
        ]),
      },
      {
        id: "prop_meta",
        section: "Meta · Objetivo principal",
        text: "Si en 6 meses logras UN solo resultado, ¿cuál quieres que sea?",
        type: "single",
        options: single([
          ["🩸", "Glucosa o HbA1c en rango normal"],
          ["⚖️", "Bajar al menos 5 kg de peso"],
          ["💊", "Reducir o eliminar medicamentos"],
          ["⚡", "Tener energía para disfrutar el día"],
          ["😊", "Sentirme mejor emocionalmente"],
        ]),
      },
      {
        id: "prop_nota",
        section: "Nota personal · Para tu equipo médico",
        text: "Cuéntanos con tus propias palabras: ¿qué te trajo al programa Copp Adresd?",
        hint: "El Dr. Godoy Cruz leerá esto personalmente. Sé tan honesto/a como puedas.",
        type: "open",
      },
    ],
  },
];

/** Meta de la lista de tests (compatibilidad con la lista de TestsPage). */
export const TESTS_META = TESTS.map(
  ({ id, emoji, title, tag, sub, pts, bg }) => ({
    id,
    emoji,
    title,
    tag,
    sub,
    pts,
    bg,
  }),
);
