# ANTARES Paciente — Prompt de contexto

## Objetivo
App móvil para pacientes del programa COPP-ADRESD (obesidad/diabetes/prevención).
El paciente interactúa con su equipo médico, sigue su programa de salud, registra
hábitos diarios, y se conecta con una comunidad de apoyo. Datos mock, sin backend.

## Stack
React 19 + Ionic 8 (iOS mode) + Capacitor 8 + Vite + TypeScript + Framer Motion.
Navegación por state machine (no react-router).

## Flujo
Login → Onboarding 5 pasos → Tests 9 evaluaciones → App principal

## Pantallas (14)
| ID       | Pantalla           | Descripción
|----------|--------------------|---------------------------------------------
| login    | Login              | Email + contraseña, fondo cosmos con estrellas
| onb      | Onboarding         | Datos → OTP → Emergencia → HIPAA → Contraseña
| tests    | Tests de salud     | 9 evaluaciones (temp, nutrición, sueño, etc.)
| home     | Inicio             | Saludo, métricas (IMC/HbA1c/adherencia/puntos)
| book     | Citas              | Próximas citas telemedicina/presencial
| hc       | Historia clínica   | Diagnósticos ICD-10, medicamentos, lab, vitales
| nut      | Nutrición          | Plan del día 4 comidas, macros, agua, adherencia
| edu      | Academia BIO       | Cursos: nutrición, ejercicio, psicología
| infinito | INFINITO           | Bienestar holístico, espiritualidad, meditación
| bt       | Wearable           | Bluetooth, dispositivos, datos de salud
| chat     | Chat IA            | Agentes (base/nutrición/médica/psicología)
| com      | Comunidad          | Feed social, posts, amigos, likes
| prog     | Programa del día   | 5 pasos diarios, timer, puntos
| prof     | Perfil             | Datos, seguro, equipo médico, logout

## Bottom Nav (5 tabs)
Inicio | Citos | SOS | Chat | Perfil

## Paleta de colores
  Cosmos  #071428  Fondo oscuro profundo
  Navy    #102a50  Headers, toolbar
  Blue    #2f78df  Primary (botones, links)
  Teal    #1d9e75  Éxito, salud, riesgo bajo
  Ice     #62d8ff  Highlight de marca
  Gold    #62d8ff  Badges, chips destacados
  Purple  #7c3aed  INFINITO, espiritualidad
  Orange  #e87b2b  Puntos, logros
  Red     #e24b4a  Alertas
  Panic   #ff2d55  Botón emergencia
  Safe    #30d158  Confirmaciones
  BG app  #f4f7fb  Fondo claro pantallas
  Text    #14213b  Texto principal
  Muted   #6f84a0  Texto secundario

## Fuentes
  Inter         — fuente principal
  Space Grotesk — títulos display (.display)

## Border radius
  sm: 10px | md: 16px | lg: 20px | xl: 24px

## Componentes clave
  Screen/Scroll      Layout base
  PageHeader         Encabezado título/subtítulo
  BottomNav          Navegación inferior con SOS
  PanicOverlay       Overlay de emergencia
  VoiceOverlay       Agente de voz
  ToastHost          Notificaciones toast
  MarkdownBubble     Renderizado markdown en chat
  Forms              ChipGrid, ScaleList (tests)

## Estado (AppContext)
Flow, screen, usuario, testsDone, hydration, mealsLogged,
chat, watchConnected, program, pointsToday, pointsTotal, posts

## Estilo visual
- Fondo oscuro cosmos con gradientes radiales en desktop
- Phone frame en desktop (430x920, border-radius 40px, border negro)
- Full screen en móvil
- Transiciones: fade + slide (Framer Motion, 0.26s)
- Onboarding: cascade animation (CSS stagger)
- Chips glass: fondo semi-transparente, blur
- Cards: sombra suave, bordes redondeados
