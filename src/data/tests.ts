export interface ScaleQ {
  text: string
  section?: string
}

export const TESTS_META = [
  { id: 1, emoji: '🩺', title: 'Historia clínica biológica', sub: 'Antecedentes · Examen físico · Sistemas', pts: 50, bg: '#E8F5FF' },
  { id: 2, emoji: '🧠', title: 'Test de temperamento', sub: 'Sanguíneo · Colérico · Melancólico · Flemático', pts: 40, bg: '#F3EFFE' },
  { id: 3, emoji: '🥗', title: 'Test nutricional y hábitos', sub: 'Alimentación · Conducta · Motivación', pts: 40, bg: '#E1F5EE' },
  { id: 4, emoji: '🏃', title: 'Movimiento y actividad física', sub: 'AMAF · Nivel funcional · Capacidad', pts: 40, bg: '#FFF0E8' },
  { id: 5, emoji: '🌙', title: 'Caracterización del sueño', sub: 'Duración · Calidad · Hábitos · Riesgos', pts: 40, bg: '#EDE9FE' },
  { id: 6, emoji: '🤝', title: 'Índice de adherencia IAC-ADRESD', sub: 'Motivación · Autoeficacia · Compromiso', pts: 40, bg: '#E6F1FB' },
  { id: 7, emoji: '❤️', title: 'Riesgo cardiometabólico ORP', sub: 'OMS · Obesidad · Complicaciones · Riesgo', pts: 40, bg: '#FCEBEB' },
  { id: 8, emoji: '⚡', title: 'Test de estrés relacional ERS', sub: 'Familia · Pareja · Trabajo · Entorno social', pts: 40, bg: '#FAEEDA' },
  { id: 9, emoji: '🧬', title: 'Batería inicial completa ANTARES', sub: 'PHS · Propósito · Mentalidad · Perfil final', pts: 50, bg: '#FDF6DC' },
]

export const ANTECS = [
  { ico: '🩸', label: 'Diabetes tipo 2' },
  { ico: '💛', label: 'Prediabetes' },
  { ico: '💙', label: 'Hipertensión' },
  { ico: '❤️', label: 'Enf. cardiovascular' },
  { ico: '🔶', label: 'Colesterol alto' },
  { ico: '🔷', label: 'Triglicéridos altos' },
  { ico: '🟤', label: 'Hígado graso' },
  { ico: '🫁', label: 'Asma / EPOC' },
  { ico: '🦴', label: 'Artrosis' },
  { ico: '🧠', label: 'Depresión / Ansiedad' },
  { ico: '🦋', label: 'Tiroides' },
  { ico: '⚪', label: 'Ninguno' },
]

export const FAM_HX = [
  { ico: '🩸', label: 'Diabetes' },
  { ico: '❤️', label: 'Enf. coronaria' },
  { ico: '💙', label: 'HTA' },
  { ico: '🧠', label: 'ACV' },
  { ico: '🎗', label: 'Cáncer' },
  { ico: '⬜', label: 'Ninguno conocido' },
]

export const SISTEMAS = [
  {
    s: 'Cabeza y cuello',
    ico: '🧠',
    color: '#1B6CA8',
    bg: '#EEF5FF',
    sintomas: ['Cefalea frecuente', 'Mareos o vértigo', 'Visión borrosa', 'Tinnitus', 'Sinusitis', 'Disfagia'],
  },
  {
    s: 'Cardiorrespiratorio',
    ico: '🫀',
    color: '#E24B4A',
    bg: '#FEE9E9',
    sintomas: ['Palpitaciones', 'Dolor de pecho', 'Disnea al esfuerzo', 'Edema en piernas', 'Tos persistente', 'Apnea nocturna'],
  },
  {
    s: 'Digestivo',
    ico: '🫃',
    color: '#D97706',
    bg: '#FEF3C7',
    sintomas: ['Reflujo', 'Náuseas', 'Dolor abdominal', 'Cambio de hábito intestinal', 'Distensión', 'Pérdida de peso'],
  },
  {
    s: 'Osteomuscular',
    ico: '🦴',
    color: '#B45309',
    bg: '#FEF3C7',
    sintomas: ['Dolor articular', 'Dolor lumbar', 'Rigidez matutina', 'Limitación de movimiento'],
  },
  {
    s: 'Psicológico',
    ico: '🧘',
    color: '#4F46E5',
    bg: '#EEF2FF',
    sintomas: ['Tristeza persistente', 'Ansiedad', 'Insomnio', 'Irritabilidad', 'Baja motivación', 'Estrés elevado'],
  },
]

export const TEMP_QS: ScaleQ[] = [
  { text: 'Me resulta fácil iniciar conversación con personas que no conozco.', section: '🔴 Sanguíneo' },
  { text: 'Disfruto estar rodeado de personas y participar en actividades sociales.' },
  { text: 'Expreso fácilmente mis emociones.' },
  { text: 'Suelo entusiasmarme rápidamente con nuevas ideas o proyectos.' },
  { text: 'Me gusta contar historias y hacer reír a los demás.' },
  { text: 'Me aburro cuando algo se vuelve demasiado rutinario.' },
  { text: 'Suelo actuar espontáneamente.' },
  { text: 'Cuando estoy motivado, contagio mi entusiasmo a otros.' },
  { text: 'Cuando tengo un objetivo, hago todo lo posible por alcanzarlo.', section: '🟠 Colérico' },
  { text: 'Me gusta tomar decisiones y asumir el liderazgo.' },
  { text: 'Me impaciento cuando las cosas avanzan muy lentamente.' },
  { text: 'Suelo decir directamente lo que pienso.' },
  { text: 'Los obstáculos me hacen esforzarme todavía más.' },
  { text: 'Me gusta competir y superar desafíos.' },
  { text: 'Prefiero actuar antes que quedarme analizando.' },
  { text: 'Cuando algo no funciona, busco rápidamente una solución.' },
  { text: 'Antes de decidir, analizo cuidadosamente las posibilidades.', section: '🔵 Melancólico' },
  { text: 'Me fijo mucho en los detalles.' },
  { text: 'Me preocupa hacer las cosas correctamente.' },
  { text: 'Soy exigente conmigo mismo/a.' },
  { text: 'Recuerdo con facilidad situaciones que me afectaron emocionalmente.' },
  { text: 'Necesito comprender profundamente cómo y por qué funcionan las cosas.' },
  { text: 'Me molesta cometer errores que podrían haberse evitado.' },
  { text: 'Suelo pensar mucho antes de actuar.' },
  { text: 'Mantengo la calma incluso cuando otros están alterados.', section: '🟢 Flemático' },
  { text: 'Prefiero evitar discusiones y conflictos innecesarios.' },
  { text: 'Soy paciente con otras personas.' },
  { text: 'Me adapto bien a diferentes personalidades.' },
  { text: 'Valoro la estabilidad y la tranquilidad.' },
  { text: 'Prefiero escuchar antes que hablar.' },
  { text: 'Las situaciones de presión rara vez me hacen perder el control.' },
  { text: 'Las personas acuden a mí cuando necesitan ser escuchadas.' },
]

export const NUT_QS: ScaleQ[] = [
  { text: 'Incluyo verduras u hortalizas en mis comidas principales.', section: '🥦 Calidad alimentaria' },
  { text: 'Consumo frutas regularmente.' },
  { text: 'Consumo fuentes de proteína de buena calidad diariamente.' },
  { text: 'Consumo alimentos ricos en fibra (legumbres, cereales integrales).' },
  { text: 'Prefiero alimentos mínimamente procesados frente a ultraprocesados.' },
  { text: 'Mantengo horarios relativamente regulares para mis comidas.', section: '⏰ Organización' },
  { text: 'Planifico con anticipación lo que voy a comer.' },
  { text: 'Como sentado/a y presto atención a lo que estoy comiendo.' },
  { text: 'Puedo reconocer cuándo estoy satisfecho/a y detenerme.' },
  { text: 'Consumo bebidas azucaradas o snacks ultraprocesados con frecuencia.', section: '⚠ Conductas de riesgo' },
  { text: 'Cuando estoy estresado/a o triste, aumento mi consumo de comida.' },
  { text: 'Tengo dificultad para controlar porciones de ciertos alimentos.' },
  { text: 'Bebo agua regularmente durante el día.', section: '💧 Hidratación' },
  { text: 'En mi casa hay alimentos que facilitan una alimentación saludable.', section: '🏠 Entorno' },
  { text: 'Tengo una razón personal importante para mejorar mi alimentación.', section: '🎯 Motivación' },
  { text: 'Estoy dispuesto/a a modificar algunos hábitos alimentarios.' },
  { text: 'Cuando fracaso en un hábito, puedo volver a intentarlo.' },
]

export const MOV_QS: ScaleQ[] = [
  { text: 'Puedo cambiar de posición en la cama.', section: '🟣 Movilidad' },
  { text: 'Puedo sentarme en la cama con o sin ayuda.' },
  { text: 'Puedo permanecer sentado/a durante 5 minutos.', section: '🔵 Sedestación' },
  { text: 'Puedo incorporarme de una silla con seguridad.' },
  { text: 'Puedo permanecer de pie durante 1 minuto.', section: '🟢 Bipedestación' },
  { text: 'Puedo mantener el equilibrio estando de pie.' },
  { text: 'Puedo caminar dentro de mi vivienda.', section: '🟡 Marcha' },
  { text: 'Puedo caminar durante 5 minutos sin detenerme.' },
  { text: 'Puedo caminar fuera de casa.' },
  { text: 'Puedo realizar actividades domésticas básicas.', section: '🟠 Capacidad funcional' },
  { text: 'Tengo confianza para moverme.', section: '🔴 Autopercepción' },
  { text: 'Estoy dispuesto/a a realizar actividad física diariamente.' },
]

export const SLEEP_QS: ScaleQ[] = [
  { text: 'Me acuesto aproximadamente a la misma hora todos los días.', section: '⏰ Regularidad' },
  { text: 'Me levanto aproximadamente a la misma hora todos los días.' },
  { text: 'Duermo el tiempo que necesito para sentirme descansado/a.', section: '🛏 Duración' },
  { text: 'Me duermo con relativa facilidad.' },
  { text: 'Me despierto sintiéndome descansado/a.', section: '🌅 Funcionamiento diurno' },
  { text: 'Tengo energía suficiente durante el día.' },
  { text: 'Evito el teléfono inmediatamente antes de dormir.', section: '📱 Hábitos' },
  { text: 'Evito la cafeína varias horas antes de acostarme.' },
  { text: 'Puedo dejar de pensar en mis responsabilidades a la hora de dormir.', section: '🧠 Desconexión' },
]

export const SLEEP_FLAGS = [
  { ico: '😴', label: 'Ronquido intenso' },
  { ico: '⏸', label: 'Pausas respiratorias' },
  { ico: '😰', label: 'Despertar con ahogo' },
  { ico: '🌞', label: 'Somnolencia diurna' },
  { ico: '😩', label: 'Insomnio persistente' },
]

export const ADHER_QS: ScaleQ[] = [
  { text: 'Tengo una razón personal importante para mejorar mi salud.', section: '🧠 Motivación' },
  { text: 'Mejorar mi salud es actualmente una prioridad para mí.' },
  { text: 'Creo que soy capaz de cambiar hábitos que afectan mi salud.', section: '💪 Autoeficacia' },
  { text: 'Cuando tengo una recaída, soy capaz de volver a comenzar.' },
  { text: 'Puedo reservar tiempo de manera regular para cuidar mi salud.', section: '⏰ Organización' },
  { text: 'Estoy dispuesto/a a realizar cambios progresivos en mi alimentación.', section: '🥗 Hábitos' },
  { text: 'Estoy dispuesto/a a aumentar progresivamente mi actividad física.' },
  { text: 'Tengo al menos una persona que puede apoyarme durante este proceso.', section: '👥 Apoyo' },
  { text: 'Entiendo que una recaída no significa que haya fracasado.', section: '🔄 Resiliencia' },
  { text: 'Estoy dispuesto/a a informar honestamente mis avances y dificultades.', section: '📲 Compromiso' },
]

export const CARDIO_QS: ScaleQ[] = [
  { text: '¿Tiene diagnóstico de hipertensión arterial?', section: '🫀 Cardiometabólico' },
  { text: '¿Tiene diagnóstico de diabetes tipo 2 o prediabetes?' },
  { text: '¿Tiene colesterol o triglicéridos elevados?' },
  { text: '¿Tiene enfermedad cardiovascular, coronaria o ACV?' },
  { text: '¿Le han informado que tiene hígado graso?' },
  { text: '¿Ronca habitualmente o muy fuerte?', section: '🫁 Sueño' },
  { text: '¿Se despierta cansado/a aunque haya dormido varias horas?' },
  { text: '¿Tiene dolor frecuente en rodillas, caderas o columna?', section: '🦴 Músculo-esquelético' },
  { text: '¿Utiliza la comida frecuentemente para manejar estrés?', section: '🧠 Conductual' },
  { text: '¿Ha realizado múltiples dietas y recuperado el peso?' },
]

export const STRESS_QS: ScaleQ[] = [
  { text: 'Siento que dentro de mi familia tengo conflictos que me generan estrés.', section: '👨‍👩‍👧 Familia' },
  { text: 'Los problemas familiares interfieren con mi descanso o sueño.' },
  { text: 'Mi relación de pareja genera situaciones que me producen estrés.', section: '❤️ Pareja' },
  { text: 'Los conflictos de pareja afectan mi sueño, alimentación o bienestar.' },
  { text: 'Mi trabajo me genera un nivel importante de estrés.', section: '💼 Laboral' },
  { text: 'Tengo dificultades para desconectarme mentalmente del trabajo.' },
  { text: 'Me cuesta decir “no” cuando alguien me pide algo.', section: '🧑‍🤝‍🧑 Social' },
  { text: 'Cuando tengo conflictos, aumenta mi necesidad de comer o picar.', section: '🧠 Impacto' },
  { text: 'El estrés de mis relaciones está afectando mi calidad de vida.' },
]

export const PURPOSE_SCALE: ScaleQ[] = [
  { text: 'Mi estado de salud depende principalmente de mis propias acciones.', section: '🧠 Mentalidad de salud' },
  { text: 'Cuando fracaso en un hábito, me recupero sin abandonar el proceso.' },
  { text: 'Creo que cambios pequeños y constantes producen resultados importantes.' },
  { text: 'Me veo capaz de construir una versión más saludable de mí mismo/a.' },
]

export const PURPOSE_OPEN = [
  { q: '¿Para qué quieres estar saludable?', ph: 'Ej: Para tener más energía con mis hijos...' },
  { q: '¿Qué quieres poder hacer dentro de 5 años que hoy se te dificulta?', ph: 'Ej: Correr, viajar, subir escaleras sin cansarme...' },
  { q: '¿Qué perderías si tu salud empeorara?', ph: 'Ej: Tiempo con mi familia, calidad de vida...' },
]

export const PRIORITIES = [
  { id: 1, ico: '🥗', label: 'Nutrición' },
  { id: 2, ico: '🏃', label: 'Movimiento' },
  { id: 3, ico: '🌙', label: 'Sueño' },
  { id: 4, ico: '🧠', label: 'Bienestar mental' },
  { id: 5, ico: '❤️', label: 'Peso y metabolismo' },
  { id: 6, ico: '👥', label: 'Relaciones' },
]
