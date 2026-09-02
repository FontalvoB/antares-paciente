// Seeds deterministas del módulo de Clubes (mismo contenido en ERP y app).
// Fechas relativas a una base fija para que las demos sean repetibles.

import type {
  Club,
  ClubAnalytics,
  ClubNotification,
  ModerationReport,
} from "../graphql/clubs";

const BASE = new Date("2026-09-01T12:00:00Z");

function iso(offsetMinutes: number): string {
  return new Date(BASE.getTime() + offsetMinutes * 60_000).toISOString();
}

export const CLUB_CATEGORIES = [
  "Salud",
  "Deporte",
  "Bienestar",
  "Nutrición",
  "Embarazo",
  "Diabetes",
  "Adultos mayores",
  "Empresas",
  "Hobbies",
] as const;

export const CATEGORY_GRADIENTS: Record<string, string> = {
  Salud: "linear-gradient(135deg, #0ea5e9, #1d4ed8)",
  Deporte: "linear-gradient(135deg, #22c55e, #15803d)",
  Bienestar: "linear-gradient(135deg, #a78bfa, #6d28d9)",
  Nutrición: "linear-gradient(135deg, #f59e0b, #b45309)",
  Embarazo: "linear-gradient(135deg, #ec4899, #9d174d)",
  Diabetes: "linear-gradient(135deg, #06b6d4, #0e7490)",
  "Adultos mayores": "linear-gradient(135deg, #64748b, #334155)",
  Empresas: "linear-gradient(135deg, #6366f1, #4338ca)",
  Hobbies: "linear-gradient(135deg, #f97316, #c2410c)",
};

export function coverGradient(category: string): string {
  return CATEGORY_GRADIENTS[category] ?? CATEGORY_GRADIENTS.Salud;
}

export interface SeedMember {
  id: string;
  displayName: string;
  role: "ADMIN" | "MODERADOR" | "MIEMBRO";
  status: "ACTIVO" | "PENDIENTE" | "EXPULSADO" | "SILENCIADO";
  mutedUntil: string | null;
  joinedAt: string;
}

export interface SeedPost {
  id: string;
  body: string;
  type: "TEXTO" | "IMAGEN" | "VIDEO" | "ENCUESTA" | "ANUNCIO";
  visibility: "PUBLICO" | "PRIVADO";
  pinned?: boolean;
  featured?: boolean;
  scheduledFor?: string;
  status?: "BORRADOR" | "PROGRAMADO" | "PUBLICADO";
  authorId: string;
  likes?: string[];
  createdAt?: string;
  poll?: { question: string; options: { text: string; votes: string[] }[] };
  comments?: {
    id: string;
    body: string;
    authorId: string;
    createdAt: string;
    likes?: string[];
  }[];
}

export interface SeedEvent {
  id: string;
  title: string;
  description: string;
  type: "PRESENCIAL" | "VIRTUAL";
  startsAt: string;
  endsAt: string;
  location?: string | null;
  meetingUrl?: string | null;
  maxAttendees: number | null;
  confirmed: string[]; // ids de miembros
  waitlist: string[];
  status: "ABIERTO" | "LLENO" | "FINALIZADO" | "CANCELADO";
}

export interface SeedLive {
  id: string;
  title: string;
  scheduledStartAt: string;
  status: "PROGRAMADO" | "ACTIVO" | "FINALIZADO" | "CANCELADO";
  eventId?: string | null;
  speakers: string[];
  chat: { senderId: string; body: string; sentAt: string }[];
}

export interface SeedClub {
  club: Omit<Club, "memberCount" | "myMembership">;
  members: SeedMember[];
  posts: SeedPost[];
  events: SeedEvent[];
  lives: SeedLive[];
  analytics: ClubAnalytics;
  reports: ModerationReport[];
  requests: { memberId: string; reason: string }[];
}

function member(
  id: string,
  displayName: string,
  role: "ADMIN" | "MODERADOR" | "MIEMBRO",
  joinedMinutesAgo: number,
): SeedMember {
  return {
    id,
    displayName,
    role,
    status: "ACTIVO",
    mutedUntil: null,
    joinedAt: iso(-joinedMinutesAgo),
  };
}

function post(
  id: string,
  body: string,
  type: SeedPost["type"],
  visibility: "PUBLICO" | "PRIVADO",
  authorId: string,
  opts: Partial<SeedPost> = {},
): SeedPost {
  return {
    id,
    body,
    type,
    visibility,
    authorId,
    likes: ["m-1"],
    createdAt: iso(-60),
    status: "PUBLICADO",
    ...opts,
  };
}

export function createSeeds(): SeedClub[] {
  const managers = [
    member("m-1", "Equipo ANTARES", "ADMIN", 60_000),
    member("m-2", "María Fernanda Rojas", "ADMIN", 30_000),
    member("m-3", "Carlos Andrés Pardo", "MODERADOR", 20_000),
  ];

  const commonMembers = [
    member("m-4", "Luisa Martínez", "MIEMBRO", 15_000),
    member("m-5", "Andrés Felipe Gil", "MIEMBRO", 14_000),
    member("m-6", "Valentina Ospina", "MIEMBRO", 13_000),
    member("m-7", "Jorge Iván Salazar", "MIEMBRO", 12_000),
    member("m-8", "Daniela Cárdenas", "MIEMBRO", 10_000),
    member("m-9", "Ricardo Peña", "MIEMBRO", 9_000),
    member("m-10", "Sofía Herrera", "MIEMBRO", 8_000),
    member("m-11", "Manuel Estrada", "MIEMBRO", 7_000),
  ];

  return [
    {
      club: {
        id: "club-1",
        slug: "caminantes-adres",
        name: "Caminantes ADRES",
        description:
          "Club para quienes quieren moverse más: caminatas grupales, retos de pasos y acompañamiento entre miembros.",
        rules: [
          "Respeto ante todo",
          "No compartir datos médicos de terceros",
          "Participa al menos una vez al mes",
        ],
        objectives: [
          "Fomentar 10.000 pasos diarios",
          "Crear grupos de caminata por ciudad",
        ],
        category: "Deporte",
        tags: ["caminata", "pasos", "reto", "grupal"],
        coverUrl: null,
        logoUrl: null,
        visibility: "PUBLICO",
        maxMembers: 500,
        status: "ACTIVO",
        createdAt: iso(-60_000),
      },
      members: [managers[0], managers[1], ...commonMembers],
      requests: [{ memberId: "m-12", reason: "Quiero unirme a los retos" }],
      posts: [
        post(
          "p-1",
          "¡Nuevo reto de septiembre! 300.000 pasos en el mes. ¿Quién se apunta? 💪",
          "ANUNCIO",
          "PUBLICO",
          "m-2",
          {
            pinned: true,
            likes: [
              "m-1",
              "m-2",
              "m-3",
              "m-4",
              "m-5",
              "m-6",
              "m-7",
              "m-8",
              "m-9",
              "m-10",
              "m-11",
            ],
          },
        ),
        post(
          "p-2",
          "Fotos de la caminata del domingo en el parque Simón Bolívar. ¡Gracias a los 45 asistentes!",
          "IMAGEN",
          "PUBLICO",
          "m-3",
          { featured: true, likes: ["m-1", "m-2", "m-4", "m-6", "m-9"] },
        ),
        post(
          "p-3",
          "Encuesta: ¿qué día prefieres para las caminatas grupales?",
          "ENCUESTA",
          "PUBLICO",
          "m-2",
          {
            poll: {
              question: "¿Qué día prefieres para caminar?",
              options: [
                { text: "Sábado", votes: ["m-1", "m-4", "m-5", "m-6", "m-7"] },
                {
                  text: "Domingo",
                  votes: ["m-2", "m-3", "m-8", "m-9", "m-10", "m-11"],
                },
              ],
            },
          },
        ),
        post(
          "p-4",
          "Guía de calentamiento antes de caminar (solo miembros)",
          "TEXTO",
          "PRIVADO",
          "m-3",
        ),
        post(
          "p-5",
          "Publicación programada: resultados del reto de agosto",
          "TEXTO",
          "PUBLICO",
          "m-2",
          { scheduledFor: iso(1_440), status: "PROGRAMADO" },
        ),
        post(
          "p-6",
          "Borrador: nota para el boletín del club",
          "TEXTO",
          "PUBLICO",
          "m-2",
          { status: "BORRADOR" },
        ),
      ],
      events: [
        {
          id: "ev-1",
          title: "Caminata al amanecer — Parque Simón Bolívar",
          description: "Caminata de 5 km con estiramiento guiado al final.",
          type: "PRESENCIAL",
          startsAt: iso(4_320),
          endsAt: iso(4_500),
          location: "Parque Simón Bolívar, entrada sur",
          maxAttendees: 50,
          confirmed: ["m-1", "m-2", "m-3", "m-4", "m-5", "m-6"],
          waitlist: [],
          status: "ABIERTO",
        },
        {
          id: "ev-2",
          title: "Charla: prevención de lesiones al caminar",
          description: "Sesión virtual con fisioterapeuta invitado.",
          type: "VIRTUAL",
          startsAt: iso(7_200),
          endsAt: iso(7_500),
          meetingUrl: "https://meet.example.com/caminantes",
          maxAttendees: 100,
          confirmed: Array.from({ length: 100 }, (_, i) => `m-${4 + (i % 8)}`),
          waitlist: ["m-1", "m-2", "m-3"],
          status: "LLENO",
        },
      ],
      lives: [
        {
          id: "lv-1",
          title: "En vivo: estiramientos con el equipo",
          scheduledStartAt: iso(2_880),
          status: "PROGRAMADO",
          speakers: ["m-2", "m-3"],
          chat: [],
        },
      ],
      analytics: {
        activeMembers: 486,
        weeklyGrowth: 12.4,
        engagement: 38,
        topPosts: [
          {
            postId: "p-1",
            title: "Nuevo reto de septiembre",
            likes: 11,
            comments: 4,
          },
          {
            postId: "p-2",
            title: "Fotos de la caminata",
            likes: 5,
            comments: 2,
          },
        ],
        retention: 74,
        eventParticipation: [
          { eventId: "ev-1", title: "Caminata al amanecer", confirmed: 6 },
          { eventId: "ev-2", title: "Charla de lesiones", confirmed: 100 },
        ],
      },
      reports: [
        {
          id: "r-1",
          clubId: "club-1",
          targetType: "POST",
          targetId: "p-4",
          targetPreview: "Guía de calentamiento...",
          reason: "Contenido inapropiado",
          details: "Contiene publicidad no autorizada.",
          createdAt: iso(-300),
          reportedBy: { id: "m-4", displayName: "Luisa Martínez" },
          status: "PENDIENTE",
          resolution: null,
        },
      ],
    },
    {
      club: {
        id: "club-2",
        slug: "nutricion-inteligente",
        name: "Nutrición Inteligente",
        description:
          "Aprende a comer mejor con planes prácticos, recetas y respuestas de nutricionistas.",
        rules: [
          "Nada de dietas milagro",
          "Consulta siempre a tu nutricionista",
        ],
        objectives: ["Educación nutricional continua"],
        category: "Nutrición",
        tags: ["recetas", "nutricionistas", "planes"],
        coverUrl: null,
        logoUrl: null,
        visibility: "PRIVADO",
        maxMembers: 200,
        status: "ACTIVO",
        createdAt: iso(-45_000),
      },
      members: [
        managers[0],
        managers[2],
        commonMembers[0],
        commonMembers[1],
        commonMembers[2],
      ],
      requests: [
        { memberId: "m-12", reason: "Soy paciente interesada en planes" },
        { memberId: "m-13", reason: "Quiero recetas para diabéticos" },
      ],
      posts: [
        post(
          "p-7",
          "Receta de la semana: bowl de quinoa con verduras asadas 🥗",
          "IMAGEN",
          "PUBLICO",
          "m-3",
          { likes: ["m-1", "m-4", "m-5", "m-6", "m-8"] },
        ),
        post(
          "p-8",
          "Plan semanal de menús disponible en la biblioteca del club",
          "ANUNCIO",
          "PRIVADO",
          "m-3",
        ),
      ],
      events: [
        {
          id: "ev-3",
          title: "Taller virtual: etiquetas nutricionales",
          description: "Aprende a leer la letra pequeña.",
          type: "VIRTUAL",
          startsAt: iso(8_640),
          endsAt: iso(8_940),
          meetingUrl: "https://meet.example.com/nutricion",
          maxAttendees: 60,
          confirmed: ["m-1", "m-2", "m-4"],
          waitlist: [],
          status: "ABIERTO",
        },
      ],
      lives: [],
      analytics: {
        activeMembers: 118,
        weeklyGrowth: 5.1,
        engagement: 26,
        topPosts: [
          {
            postId: "p-7",
            title: "Receta de la semana",
            likes: 5,
            comments: 1,
          },
        ],
        retention: 81,
        eventParticipation: [
          { eventId: "ev-3", title: "Etiquetas nutricionales", confirmed: 3 },
        ],
      },
      reports: [],
    },
    {
      club: {
        id: "club-3",
        slug: "embarazo-plena",
        name: "Embarazo Plena",
        description:
          "Acompañamiento para futuras mamás: información por trimestre, ejercicios seguros y comunidad.",
        rules: ["No sustituir el consejo médico", "Empatía y cero juicios"],
        objectives: ["Acompañar cada trimestre", "Reducir ansiedad prenatal"],
        category: "Embarazo",
        tags: ["maternidad", "trimestres", "acompañamiento"],
        coverUrl: null,
        logoUrl: null,
        visibility: "INVITACION",
        maxMembers: 100,
        status: "ACTIVO",
        createdAt: iso(-30_000),
      },
      members: [
        managers[1],
        managers[2],
        commonMembers[3],
        commonMembers[4],
        commonMembers[5],
      ],
      requests: [],
      posts: [
        post(
          "p-9",
          "Semana a semana: qué esperar en el tercer trimestre",
          "TEXTO",
          "PUBLICO",
          "m-2",
          { likes: ["m-1", "m-7", "m-8", "m-9"] },
        ),
        post(
          "p-10",
          "Video: ejercicios de respiración para el parto",
          "VIDEO",
          "PRIVADO",
          "m-3",
        ),
      ],
      events: [
        {
          id: "ev-4",
          title: "Encuentro presencial: preparación al parto",
          description: "Sesión guiada con matrona invitada.",
          type: "PRESENCIAL",
          startsAt: iso(10_080),
          endsAt: iso(10_380),
          location: "Clínica ADRES, sala 3",
          maxAttendees: 20,
          confirmed: ["m-1", "m-7", "m-8"],
          waitlist: ["m-9", "m-10"],
          status: "LLENO",
        },
      ],
      lives: [
        {
          id: "lv-2",
          title: "En vivo: dudas frecuentes del tercer trimestre",
          scheduledStartAt: iso(-120),
          status: "ACTIVO",
          speakers: ["m-2"],
          chat: [
            {
              senderId: "m-7",
              body: "¿Es normal el dolor de espalda a las 32 semanas?",
              sentAt: iso(-8),
            },
            {
              senderId: "m-2",
              body: "Sí, muy común. Vamos a ver ejercicios de alivio ahora.",
              sentAt: iso(-6),
            },
            {
              senderId: "m-8",
              body: "Gracias por el dato 🙏",
              sentAt: iso(-3),
            },
          ],
        },
      ],
      analytics: {
        activeMembers: 64,
        weeklyGrowth: 3.2,
        engagement: 44,
        topPosts: [
          { postId: "p-9", title: "Semana a semana", likes: 4, comments: 3 },
        ],
        retention: 88,
        eventParticipation: [
          { eventId: "ev-4", title: "Preparación al parto", confirmed: 3 },
        ],
      },
      reports: [],
    },
    {
      club: {
        id: "club-4",
        slug: "diabetes-en-control",
        name: "Diabetes en Control",
        description:
          "Educación, recetas y apoyo entre personas con diabetes tipo 2.",
        rules: [
          "Compartir datos médicos solo si es tuyo",
          "Sin consejos médicos individuales",
        ],
        objectives: ["Empoderar el autocuidado"],
        category: "Diabetes",
        tags: ["glucosa", "alimentación", "autocuidado"],
        coverUrl: null,
        logoUrl: null,
        visibility: "PUBLICO",
        maxMembers: 1000,
        status: "ACTIVO",
        createdAt: iso(-25_000),
      },
      members: [managers[0], managers[2], commonMembers[6], commonMembers[7]],
      requests: [],
      posts: [
        post(
          "p-11",
          "Infografía: ¿qué significa tu hemoglobina glicosilada?",
          "IMAGEN",
          "PUBLICO",
          "m-3",
          { likes: ["m-1", "m-2", "m-10", "m-11"] },
        ),
      ],
      events: [],
      lives: [],
      analytics: {
        activeMembers: 421,
        weeklyGrowth: 8.7,
        engagement: 31,
        topPosts: [
          {
            postId: "p-11",
            title: "Hemoglobina glicosilada",
            likes: 4,
            comments: 1,
          },
        ],
        retention: 69,
        eventParticipation: [],
      },
      reports: [],
    },
    {
      club: {
        id: "club-5",
        slug: "bienestar-empresarial",
        name: "Bienestar Empresarial",
        description:
          "Programas de salud laboral para empresas aliadas: pausas activas, retos y conferencias.",
        rules: ["Contenido corporativo aprobado"],
        objectives: ["Reducir ausentismo", "Mejorar clima laboral"],
        category: "Empresas",
        tags: ["empresas", "salud laboral"],
        coverUrl: null,
        logoUrl: null,
        visibility: "PRIVADO",
        maxMembers: null,
        status: "ACTIVO",
        createdAt: iso(-20_000),
      },
      members: [
        managers[1],
        commonMembers[0],
        commonMembers[2],
        commonMembers[4],
      ],
      requests: [
        { memberId: "m-14", reason: "Soy líder de bienestar en mi empresa" },
      ],
      posts: [
        post(
          "p-12",
          "Reto de pausas activas: 2 minutos cada hora ⏰",
          "ANUNCIO",
          "PUBLICO",
          "m-2",
        ),
        post(
          "p-13",
          "Informe trimestral de participación (interno)",
          "TEXTO",
          "PRIVADO",
          "m-2",
          { status: "BORRADOR" },
        ),
      ],
      events: [],
      lives: [],
      analytics: {
        activeMembers: 89,
        weeklyGrowth: 2.4,
        engagement: 22,
        topPosts: [
          { postId: "p-12", title: "Pausas activas", likes: 1, comments: 0 },
        ],
        retention: 76,
        eventParticipation: [],
      },
      reports: [],
    },
    {
      club: {
        id: "club-6",
        slug: "adultos-mayores-activos",
        name: "Adultos Mayores Activos",
        description:
          "Ejercicio suave, memoria y socialización para mayores de 60.",
        rules: ["Paciencia y respeto", "Ritmo propio"],
        objectives: ["Prevenir el sedentarismo"],
        category: "Adultos mayores",
        tags: ["60+", "memoria", "ejercicio suave"],
        coverUrl: null,
        logoUrl: null,
        visibility: "PUBLICO",
        maxMembers: 300,
        status: "ACTIVO",
        createdAt: iso(-15_000),
      },
      members: [managers[0], managers[2], commonMembers[1], commonMembers[3]],
      requests: [],
      posts: [
        post(
          "p-14",
          "Rutina de 15 minutos para movilidad articular 🧘",
          "VIDEO",
          "PUBLICO",
          "m-3",
        ),
      ],
      events: [
        {
          id: "ev-5",
          title: "Tarde de juegos de memoria",
          description: "Bingo, crucigramas y café.",
          type: "PRESENCIAL",
          startsAt: iso(11_520),
          endsAt: iso(11_820),
          location: "Centro comunitario La Esperanza",
          maxAttendees: 40,
          confirmed: ["m-1", "m-5", "m-7"],
          waitlist: [],
          status: "ABIERTO",
        },
      ],
      lives: [],
      analytics: {
        activeMembers: 156,
        weeklyGrowth: 1.8,
        engagement: 35,
        topPosts: [
          {
            postId: "p-14",
            title: "Movilidad articular",
            likes: 1,
            comments: 0,
          },
        ],
        retention: 91,
        eventParticipation: [
          { eventId: "ev-5", title: "Juegos de memoria", confirmed: 3 },
        ],
      },
      reports: [],
    },
    {
      club: {
        id: "club-7",
        slug: "salud-mental-conversa",
        name: "Salud Mental Conversa",
        description:
          "Espacio seguro para hablar de emociones con psicólogos invitados.",
        rules: [
          "Confidencialidad absoluta",
          "Sin juicios",
          "No dar diagnósticos",
        ],
        objectives: ["Desnormalizar pedir ayuda"],
        category: "Bienestar",
        tags: ["emociones", "psicología", "grupo de apoyo"],
        coverUrl: null,
        logoUrl: null,
        visibility: "INVITACION",
        maxMembers: 150,
        status: "ACTIVO",
        createdAt: iso(-10_000),
      },
      members: [
        managers[1],
        managers[2],
        commonMembers[5],
        commonMembers[6],
        commonMembers[7],
      ],
      requests: [],
      posts: [
        post(
          "p-15",
          "Recursos de apoyo emocional disponibles 24/7",
          "ANUNCIO",
          "PUBLICO",
          "m-2",
          { pinned: true },
        ),
        post(
          "p-16",
          "Nota interna: pauta de sesiones de grupo",
          "TEXTO",
          "PRIVADO",
          "m-2",
          { status: "BORRADOR" },
        ),
      ],
      events: [],
      lives: [
        {
          id: "lv-3",
          title: "En vivo: manejo de la ansiedad con psicóloga invitada",
          scheduledStartAt: iso(14_400),
          status: "PROGRAMADO",
          speakers: ["m-2"],
          chat: [],
        },
      ],
      analytics: {
        activeMembers: 97,
        weeklyGrowth: 6.3,
        engagement: 52,
        topPosts: [
          { postId: "p-15", title: "Recursos de apoyo", likes: 1, comments: 0 },
        ],
        retention: 84,
        eventParticipation: [],
      },
      reports: [],
    },
    {
      club: {
        id: "club-8",
        slug: "fotografia-ciudad",
        name: "Fotografía de Ciudad",
        description:
          "Comparte tu mirada de la ciudad: salidas fotográficas y críticas constructivas.",
        rules: ["Críticas constructivas", "Cuidar el espacio público"],
        objectives: ["Salida mensual"],
        category: "Hobbies",
        tags: ["fotografía", "urbano"],
        coverUrl: null,
        logoUrl: null,
        visibility: "PUBLICO",
        maxMembers: 200,
        status: "ACTIVO",
        createdAt: iso(-8_000),
      },
      members: [
        managers[0],
        commonMembers[0],
        commonMembers[1],
        commonMembers[2],
        commonMembers[3],
      ],
      requests: [],
      posts: [
        post(
          "p-17",
          "Ganadora del reto de agosto: 'Espejos en la ciudad' 📸",
          "IMAGEN",
          "PUBLICO",
          "m-3",
        ),
      ],
      events: [],
      lives: [],
      analytics: {
        activeMembers: 133,
        weeklyGrowth: 4.0,
        engagement: 29,
        topPosts: [
          {
            postId: "p-17",
            title: "Ganadora reto agosto",
            likes: 1,
            comments: 0,
          },
        ],
        retention: 72,
        eventParticipation: [],
      },
      reports: [],
    },
    {
      club: {
        id: "club-9",
        slug: "reto-10k-pasos",
        name: "Reto 10K Pasos",
        description: "Club archivado: reto global de actividad terminado.",
        rules: ["Reto temporal"],
        objectives: ["10.000 pasos diarios por 60 días"],
        category: "Deporte",
        tags: ["reto", "pasos"],
        coverUrl: null,
        logoUrl: null,
        visibility: "PUBLICO",
        maxMembers: 2000,
        status: "ARCHIVADO",
        createdAt: iso(-90_000),
      },
      members: [managers[0], commonMembers[4], commonMembers[5]],
      requests: [],
      posts: [
        post(
          "p-18",
          "Reto finalizado. ¡Gracias a los 1.400 participantes!",
          "ANUNCIO",
          "PUBLICO",
          "m-2",
        ),
      ],
      events: [],
      lives: [],
      analytics: {
        activeMembers: 0,
        weeklyGrowth: 0,
        engagement: 0,
        topPosts: [
          { postId: "p-18", title: "Reto finalizado", likes: 1, comments: 0 },
        ],
        retention: 58,
        eventParticipation: [],
      },
      reports: [],
    },
  ];
}

// Perfiles disponibles para solicitudes pendientes y participantes nuevos.
export const REQUEST_PROFILES: Record<string, string> = {
  "m-12": "Paola Restrepo",
  "m-13": "Felipe Cárdenas",
  "m-14": "Laura Jiménez",
};

export const NOTIFICATION_SEEDS: ClubNotification[] = [
  {
    id: "n-1",
    clubId: "club-2",
    type: "SOLICITUD_APROBADA",
    payload: "Tu solicitud al club Nutrición Inteligente fue aprobada",
    readAt: null,
    createdAt: iso(-600),
  },
  {
    id: "n-2",
    clubId: "club-1",
    type: "NUEVO_EVENTO",
    payload: "Nuevo evento: Caminata al amanecer — Parque Simón Bolívar",
    readAt: null,
    createdAt: iso(-300),
  },
  {
    id: "n-3",
    clubId: "club-3",
    type: "LIVE_PROGRAMADO",
    payload: "Live programado: dudas frecuentes del tercer trimestre",
    readAt: iso(-120),
    createdAt: iso(-400),
  },
  {
    id: "n-4",
    clubId: "club-2",
    type: "RECORDATORIO_EVENTO",
    payload: "Recordatorio: Taller de etiquetas nutricionales mañana",
    readAt: null,
    createdAt: iso(-90),
  },
  {
    id: "n-5",
    clubId: "club-7",
    type: "INVITACION",
    payload: "Fuiste invitado a Salud Mental Conversa",
    readAt: null,
    createdAt: iso(-60),
  },
];
