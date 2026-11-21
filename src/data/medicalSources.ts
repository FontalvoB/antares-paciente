interface MedicalCitation {
  organization: string;
  title: string;
  year: number;
  url: `https://${string}`;
}

export const medicalSources = [
  {
    id: "imc",
    title: "IMC y clasificación de peso",
    summary:
      "El IMC se calcula dividiendo el peso en kilogramos por la estatura en metros al cuadrado. En adultos, la OMS define sobrepeso desde 25 y obesidad desde 30.",
    sources: [
      {
        organization: "Organización Mundial de la Salud (OMS)",
        title: "Obesidad y sobrepeso",
        year: 2024,
        url: "https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight",
      },
    ],
  },
  {
    id: "hba1c",
    title: "HbA1c y prediabetes",
    summary:
      "Una HbA1c inferior al 5,7 % está por debajo del umbral de prediabetes (5,7–6,4 %). Si tienes diabetes, tu equipo de salud define tu objetivo de tratamiento.",
    sources: [
      {
        organization: "Asociación Americana de Diabetes (ADA)",
        title:
          "Diagnóstico y clasificación de la diabetes. Estándares de atención en diabetes",
        year: 2026,
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12690183/",
      },
      {
        organization:
          "Centros para el Control y la Prevención de Enfermedades (CDC)",
        title: "Prueba de A1c para diabetes y prediabetes",
        year: 2024,
        url: "https://www.cdc.gov/diabetes/diabetes-testing/prediabetes-a1c-test.html",
      },
    ],
  },
  {
    id: "fat",
    title: "Porcentaje de grasa corporal",
    summary:
      "El porcentaje de grasa corporal estima qué proporción del peso corresponde a grasa y su interpretación depende de la edad, el sexo y el método de medición.",
    sources: [
      {
        organization: "The American Journal of Clinical Nutrition",
        title:
          "Rangos saludables de grasa corporal. Un método para elaborar guías basadas en el IMC (Gallagher y cols.)",
        year: 2000,
        url: "https://pubmed.ncbi.nlm.nih.gov/10966886/",
      },
    ],
  },
  {
    id: "nutrition",
    title: "Nutrición, calorías y macronutrientes",
    summary:
      "Las guías de alimentación saludable y las ingestas de referencia orientan sobre energía y macronutrientes. Las necesidades varían según la persona.",
    sources: [
      {
        organization: "Organización Mundial de la Salud (OMS)",
        title: "Alimentación saludable",
        year: 2026,
        url: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
      },
      {
        organization: "National Academies",
        title:
          "Ingestas dietéticas de referencia de energía, carbohidratos, fibra, grasas, colesterol, proteínas y aminoácidos",
        year: 2005,
        url: "https://www.nationalacademies.org/publications/10490",
      },
    ],
  },
  {
    id: "hydration",
    title: "Hidratación",
    summary:
      "La ingesta de agua total incluye el agua de alimentos y bebidas. Es una referencia general que puede variar con la actividad, el clima y la salud.",
    sources: [
      {
        organization: "National Academies",
        title:
          "Ingestas dietéticas de referencia de agua, potasio, sodio, cloruro y sulfato",
        year: 2005,
        url: "https://www.nationalacademies.org/publications/10925",
      },
    ],
  },
  {
    id: "activity",
    title: "Actividad física y sedentarismo",
    summary:
      "La OMS recomienda hacer actividad física con regularidad y reducir el tiempo que pasamos en actividades sedentarias.",
    sources: [
      {
        organization: "Organización Mundial de la Salud (OMS)",
        title:
          "Directrices de la OMS sobre actividad física y hábitos sedentarios",
        year: 2020,
        url: "https://www.who.int/publications/i/item/9789240015128",
      },
    ],
  },
  {
    id: "sleep",
    title: "Sueño",
    summary:
      "La AASM y la Sleep Research Society recomiendan que los adultos de 18 a 60 años duerman regularmente 7 horas o más por noche.",
    sources: [
      {
        organization:
          "American Academy of Sleep Medicine y Sleep Research Society",
        title:
          "Duración recomendada del sueño para un adulto sano. Declaración conjunta de consenso",
        year: 2015,
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/",
      },
    ],
  },
  {
    id: "adherence",
    title: "Adherencia y puntos del programa",
    summary:
      "La adherencia registra el seguimiento semanal y los puntos (XP) reconocen el avance. Son métricas internas del programa y carecen de validación como cálculos clínicos.",
    sources: [
      {
        organization: "Programa COPP-ADRESD",
        title: "Programa COPP-ADRESD. Adherencia y puntos",
        year: 2026,
        url: "https://www.coppadresd.com/",
      },
    ],
  },
  {
    id: "wearable",
    title: "Accesorio de bienestar (no dispositivo médico)",
    summary:
      "El anillo o la banda es un accesorio de bienestar de consumo. No es un dispositivo médico y sus lecturas son estimaciones, no mediciones clínicas.",
    sources: [
      {
        organization:
          "Administración de Alimentos y Medicamentos de EE. UU. (FDA)",
        title: "Bienestar general. Política para dispositivos de bajo riesgo",
        year: 2019,
        url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices",
      },
    ],
  },
  {
    id: "ai",
    title: "IA y telemedicina",
    summary:
      "El asistente de IA ofrece información educativa y no sustituye a un profesional de la salud. La telemedicina permite consultar a un profesional cuando el servicio está disponible.",
    sources: [
      {
        organization: "Organización Mundial de la Salud (OMS)",
        title: "Ética y gobernanza de la inteligencia artificial para la salud",
        year: 2021,
        url: "https://www.who.int/publications/i/item/9789240029200",
      },
      {
        organization: "Copp Adresd",
        title: "Política de privacidad de Copp Adresd",
        year: 2026,
        url: "https://diomedescerda.github.io/coppadresd-privacy/",
      },
    ],
  },
] as const satisfies readonly {
  id: string;
  title: string;
  summary: string;
  sources: readonly MedicalCitation[];
}[];

export type MedicalSourceSectionId = (typeof medicalSources)[number]["id"];
