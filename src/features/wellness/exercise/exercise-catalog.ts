/**
 * Catálogo de ejercicio del kit v5.2 (KAN-139).
 *
 * Generado desde `engine/guide.json` y `engine/engine.js` del devkit: nombres,
 * técnica, respiración, errores y variantes son los textos del producto, no
 * inventados. El plan real lo calculará el backend (KAN-130); aquí se usa para
 * la vista y la sesión guiada.
 */

export interface ExerciseGuideText {
  name: string;
  steps: string[];
  breathing: string;
  mistakes: string[];
  easier: string;
  harder: string;
}

export interface ExerciseGuide {
  es: ExerciseGuideText;
  en: ExerciseGuideText;
}

export const EXERCISE_GUIDE: Record<string, ExerciseGuide> = {
  "walk": {
    es: {
      "name": "Caminata",
      "steps": [
        "Párate derecho, mirada al frente y hombros relajados.",
        "Da pasos naturales: apoya primero el talón y luego la punta del pie.",
        "Balancea los brazos con los codos doblados a 90°.",
        "Elige un ritmo en el que puedas conversar sin ahogarte."
      ],
      "breathing": "Inhala por la nariz durante 2–3 pasos y exhala por la boca durante 2–3 pasos.",
      "mistakes": [
        "Mirar el celular o el piso",
        "Dar pasos demasiado largos",
        "Encorvar la espalda"
      ],
      "easier": "Camina más lento y en terreno plano.",
      "harder": "Sube un poco el paso en los minutos centrales."
    },
    en: {
      "name": "Walking",
      "steps": [
        "Stand tall, eyes forward, shoulders relaxed.",
        "Take natural steps: heel first, then toes.",
        "Swing your arms with elbows bent at 90°.",
        "Pick a pace where you can still hold a conversation."
      ],
      "breathing": "Inhale through your nose for 2–3 steps, exhale through your mouth for 2–3 steps.",
      "mistakes": [
        "Looking at your phone or the floor",
        "Over-striding",
        "Rounding your back"
      ],
      "easier": "Walk slower on flat ground.",
      "harder": "Pick up the pace a little in the middle minutes."
    },
  },
  "bike": {
    es: {
      "name": "Bicicleta estática",
      "steps": [
        "Ajusta el asiento: la rodilla casi se estira al bajar el pedal.",
        "Sujeta el manubrio sin apretar y mantén la espalda larga.",
        "Pedalea a ritmo constante con resistencia baja.",
        "Mantén las rodillas alineadas con los pies, sin abrirlas."
      ],
      "breathing": "Respira de forma continua; si no puedes hablar, baja el ritmo.",
      "mistakes": [
        "Asiento muy bajo",
        "Apretar el manubrio",
        "Rebotar sobre el asiento"
      ],
      "easier": "Reduce la resistencia al mínimo.",
      "harder": "Sube la resistencia un punto en los minutos centrales."
    },
    en: {
      "name": "Stationary bike",
      "steps": [
        "Set the seat so your knee is almost straight at the bottom of the pedal stroke.",
        "Hold the handlebars lightly and keep your back long.",
        "Pedal at a steady pace with low resistance.",
        "Keep knees in line with your feet, not flaring out."
      ],
      "breathing": "Breathe steadily; if you cannot talk, slow down.",
      "mistakes": [
        "Seat too low",
        "Gripping the handlebars tightly",
        "Bouncing on the seat"
      ],
      "easier": "Lower the resistance to the minimum.",
      "harder": "Raise the resistance one notch in the middle minutes."
    },
  },
  "ellip": {
    es: {
      "name": "Elíptica",
      "steps": [
        "Sube con calma sujetándote de los agarres.",
        "Pisa con todo el pie y mantén los talones abajo.",
        "Empuja y jala los brazos al ritmo de las piernas.",
        "Mantén el torso erguido y el abdomen firme."
      ],
      "breathing": "Inhala y exhala de forma pareja, sin contener el aire.",
      "mistakes": [
        "Inclinarse hacia adelante",
        "Apoyarse en los agarres con todo el peso",
        "Ir muy rápido"
      ],
      "easier": "Pedalea más lento y sin mover los brazos.",
      "harder": "Pedalea hacia atrás durante 1 minuto."
    },
    en: {
      "name": "Elliptical",
      "steps": [
        "Step on carefully, holding the handles.",
        "Plant your whole foot and keep heels down.",
        "Push and pull the arms in rhythm with your legs.",
        "Keep your torso upright and your abdomen firm."
      ],
      "breathing": "Breathe in and out evenly without holding your breath.",
      "mistakes": [
        "Leaning forward",
        "Putting all your weight on the handles",
        "Going too fast"
      ],
      "easier": "Move slower and keep the arms still.",
      "harder": "Pedal backwards for 1 minute."
    },
  },
  "hill": {
    es: {
      "name": "Caminata en pendiente suave",
      "steps": [
        "Sube la inclinación a 2–4 %.",
        "Inclina el cuerpo un poco hacia adelante desde los tobillos.",
        "Da pasos cortos y firmes.",
        "No te agarres con fuerza de las barras."
      ],
      "breathing": "Respira profundo y constante; debes poder decir frases cortas.",
      "mistakes": [
        "Agarrarse fuerte de las barras",
        "Pasos largos",
        "Inclinación muy alta"
      ],
      "easier": "Baja la inclinación a 0–1 %.",
      "harder": "Sube 1 % la inclinación en el minuto central."
    },
    en: {
      "name": "Gentle incline walk",
      "steps": [
        "Set the incline to 2–4 %.",
        "Lean slightly forward from the ankles.",
        "Take short, firm steps.",
        "Do not grip the rails tightly."
      ],
      "breathing": "Breathe deeply and steadily; you should be able to say short sentences.",
      "mistakes": [
        "Gripping the rails",
        "Long strides",
        "Incline too high"
      ],
      "easier": "Lower the incline to 0–1 %.",
      "harder": "Raise the incline 1 % in the middle minute."
    },
  },
  "int": {
    es: {
      "name": "Intervalos caminata rápida / suave",
      "steps": [
        "Calienta 1 minuto caminando suave.",
        "Camina rápido 1 minuto (aún puedes hablar con frases cortas).",
        "Camina suave 2 minutos para recuperar el aliento.",
        "Repite hasta completar el tiempo."
      ],
      "breathing": "Exhala largo durante la fase suave para recuperarte.",
      "mistakes": [
        "Correr en lugar de caminar rápido",
        "No recuperar entre intervalos"
      ],
      "easier": "Intervalos de 30 s rápidos y 90 s suaves.",
      "harder": "Intervalos de 90 s rápidos y 90 s suaves."
    },
    en: {
      "name": "Brisk / easy walking intervals",
      "steps": [
        "Warm up with 1 minute of easy walking.",
        "Walk briskly for 1 minute (you can still speak in short sentences).",
        "Walk easy for 2 minutes to recover.",
        "Repeat until the time is up."
      ],
      "breathing": "Exhale slowly during the easy phase to recover.",
      "mistakes": [
        "Running instead of brisk walking",
        "Not recovering between intervals"
      ],
      "easier": "30 s brisk and 90 s easy intervals.",
      "harder": "90 s brisk and 90 s easy intervals."
    },
  },
  "chair": {
    es: {
      "name": "Sentadilla a la silla",
      "steps": [
        "Párate frente a una silla firme con los pies al ancho de los hombros.",
        "Lleva la cadera hacia atrás como si fueras a sentarte.",
        "Toca la silla con los glúteos y sube empujando con los talones.",
        "Mantén las rodillas en línea con los pies y el pecho arriba."
      ],
      "breathing": "Inhala al bajar, exhala al subir. No contengas el aire.",
      "mistakes": [
        "Rodillas que se juntan hacia adentro",
        "Despegar los talones",
        "Dejarse caer sobre la silla"
      ],
      "easier": "Usa una silla más alta o apoya las manos en una mesa.",
      "harder": "Baja contando 3 segundos y sube sin impulso."
    },
    en: {
      "name": "Chair squat",
      "steps": [
        "Stand in front of a sturdy chair, feet shoulder-width apart.",
        "Send your hips back as if you were about to sit.",
        "Lightly touch the chair with your glutes, then push up through your heels.",
        "Keep knees in line with your feet and chest up."
      ],
      "breathing": "Inhale on the way down, exhale on the way up. Do not hold your breath.",
      "mistakes": [
        "Knees caving inward",
        "Heels lifting",
        "Dropping onto the chair"
      ],
      "easier": "Use a higher chair or hold on to a table.",
      "harder": "Lower for 3 seconds and stand up without momentum."
    },
  },
  "row": {
    es: {
      "name": "Remo con banda elástica",
      "steps": [
        "Sentado o de pie, ancla la banda al frente a la altura del pecho.",
        "Toma los extremos con los brazos estirados.",
        "Jala llevando los codos hacia atrás y juntando los omóplatos.",
        "Regresa lento contando 3 segundos."
      ],
      "breathing": "Exhala al jalar, inhala al volver.",
      "mistakes": [
        "Encoger los hombros hacia las orejas",
        "Arquear la espalda",
        "Soltar la banda de golpe"
      ],
      "easier": "Usa una banda más suave o acércate al anclaje.",
      "harder": "Pausa 2 segundos con los omóplatos juntos."
    },
    en: {
      "name": "Resistance band row",
      "steps": [
        "Seated or standing, anchor the band in front of you at chest height.",
        "Hold the ends with arms straight.",
        "Pull, driving elbows back and squeezing shoulder blades together.",
        "Return slowly, counting 3 seconds."
      ],
      "breathing": "Exhale as you pull, inhale as you return.",
      "mistakes": [
        "Shrugging shoulders to ears",
        "Arching the back",
        "Letting the band snap back"
      ],
      "easier": "Use a lighter band or stand closer to the anchor.",
      "harder": "Pause 2 seconds with shoulder blades together."
    },
  },
  "wall": {
    es: {
      "name": "Flexiones de pared",
      "steps": [
        "Párate a un brazo de distancia de la pared.",
        "Apoya las manos a la altura de los hombros.",
        "Dobla los codos y acerca el pecho a la pared con el cuerpo en línea recta.",
        "Empuja para volver al inicio."
      ],
      "breathing": "Inhala al acercarte, exhala al empujar.",
      "mistakes": [
        "Dejar caer la cadera",
        "Abrir mucho los codos",
        "Ir muy rápido"
      ],
      "easier": "Párate más cerca de la pared.",
      "harder": "Párate más lejos o usa una mesa firme más baja."
    },
    en: {
      "name": "Wall push-ups",
      "steps": [
        "Stand an arm’s length from the wall.",
        "Place your hands on the wall at shoulder height.",
        "Bend your elbows and bring your chest toward the wall, body in a straight line.",
        "Push back to the start."
      ],
      "breathing": "Inhale as you lean in, exhale as you push.",
      "mistakes": [
        "Letting the hips sag",
        "Flaring the elbows",
        "Going too fast"
      ],
      "easier": "Stand closer to the wall.",
      "harder": "Stand farther away or use a lower sturdy table."
    },
  },
  "bridge": {
    es: {
      "name": "Puente de glúteos",
      "steps": [
        "Acuéstate boca arriba con las rodillas dobladas y los pies al ancho de la cadera.",
        "Aprieta los glúteos y sube la cadera hasta formar una línea de hombros a rodillas.",
        "Sostén 1–2 segundos arriba.",
        "Baja lento, vértebra por vértebra."
      ],
      "breathing": "Exhala al subir, inhala al bajar.",
      "mistakes": [
        "Arquear la zona lumbar",
        "Empujar con la punta de los pies",
        "Subir demasiado"
      ],
      "easier": "Sube solo la mitad del recorrido.",
      "harder": "Sostén 4 segundos arriba."
    },
    en: {
      "name": "Glute bridge",
      "steps": [
        "Lie on your back, knees bent, feet hip-width apart.",
        "Squeeze your glutes and lift your hips into a line from shoulders to knees.",
        "Hold 1–2 seconds at the top.",
        "Lower slowly, one vertebra at a time."
      ],
      "breathing": "Exhale as you lift, inhale as you lower.",
      "mistakes": [
        "Over-arching the lower back",
        "Pushing through the toes",
        "Lifting too high"
      ],
      "easier": "Lift only halfway.",
      "harder": "Hold for 4 seconds at the top."
    },
  },
  "lunge": {
    es: {
      "name": "Zancadas asistidas",
      "steps": [
        "Párate junto a una silla o pared para apoyarte.",
        "Da un paso corto hacia adelante.",
        "Baja la cadera recto hacia abajo, con la rodilla de adelante sobre el tobillo.",
        "Empuja con el talón delantero para volver. Alterna las piernas."
      ],
      "breathing": "Inhala al bajar, exhala al subir.",
      "mistakes": [
        "Paso demasiado largo",
        "La rodilla pasa la punta del pie",
        "Inclinar el torso"
      ],
      "easier": "Baja solo unos centímetros.",
      "harder": "Suelta un poco el apoyo."
    },
    en: {
      "name": "Assisted lunges",
      "steps": [
        "Stand next to a chair or wall for support.",
        "Take a short step forward.",
        "Lower your hips straight down, front knee over the ankle.",
        "Push through the front heel to return. Alternate legs."
      ],
      "breathing": "Inhale as you lower, exhale as you rise.",
      "mistakes": [
        "Step too long",
        "Knee going past the toes",
        "Leaning the torso"
      ],
      "easier": "Lower only a few centimeters.",
      "harder": "Use a little less support."
    },
  },
  "plank": {
    es: {
      "name": "Plancha en rodillas",
      "steps": [
        "Apoya los antebrazos y las rodillas en una colchoneta.",
        "Coloca los codos justo debajo de los hombros.",
        "Forma una línea recta de rodillas a cabeza con el abdomen firme.",
        "Sostén 15–20 segundos respirando normal y descansa."
      ],
      "breathing": "Respira normal. Nunca contengas el aire.",
      "mistakes": [
        "Hundir la cadera",
        "Subir la cadera",
        "Contener la respiración"
      ],
      "easier": "Hazla 10 segundos o apoya las manos en una mesa.",
      "harder": "Sostén 30 segundos."
    },
    en: {
      "name": "Knee plank",
      "steps": [
        "Rest your forearms and knees on a mat.",
        "Place elbows directly under your shoulders.",
        "Form a straight line from knees to head with your abdomen firm.",
        "Hold 15–20 seconds breathing normally, then rest."
      ],
      "breathing": "Breathe normally. Never hold your breath.",
      "mistakes": [
        "Sagging hips",
        "Raising hips too high",
        "Holding your breath"
      ],
      "easier": "Hold 10 seconds or place your hands on a table.",
      "harder": "Hold 30 seconds."
    },
  },
  "mob": {
    es: {
      "name": "Movilidad articular",
      "steps": [
        "De pie, haz 10 círculos suaves de hombros hacia atrás.",
        "Haz 5 círculos de cadera hacia cada lado.",
        "Gira cada tobillo 8 veces.",
        "Inclina el cuello suavemente hacia cada lado, sin forzar."
      ],
      "breathing": "Respira lento y profundo durante todo el movimiento.",
      "mistakes": [
        "Mover rápido o con rebotes",
        "Forzar hasta sentir dolor"
      ],
      "easier": "Reduce el tamaño de los círculos.",
      "harder": "Agrega 5 repeticiones por zona."
    },
    en: {
      "name": "Joint mobility",
      "steps": [
        "Standing, make 10 gentle backward shoulder circles.",
        "Make 5 hip circles in each direction.",
        "Rotate each ankle 8 times.",
        "Gently tilt your neck to each side without forcing."
      ],
      "breathing": "Breathe slowly and deeply throughout.",
      "mistakes": [
        "Moving fast or bouncing",
        "Forcing into pain"
      ],
      "easier": "Make smaller circles.",
      "harder": "Add 5 repetitions per area."
    },
  },
  "str": {
    es: {
      "name": "Estiramientos suaves",
      "steps": [
        "Hombros: cruza un brazo sobre el pecho y sostén 20–30 s por lado.",
        "Pantorrillas: apoya las manos en la pared y estira una pierna hacia atrás.",
        "Muslo trasero: sentado, estira una pierna y baja el pecho sin redondear la espalda.",
        "Mantén cada posición sin rebotes: tensión suave, nunca dolor."
      ],
      "breathing": "Exhala lento al profundizar el estiramiento.",
      "mistakes": [
        "Rebotar",
        "Estirar hasta sentir dolor",
        "Contener la respiración"
      ],
      "easier": "Sostén 15 segundos.",
      "harder": "Sostén 40 segundos."
    },
    en: {
      "name": "Gentle stretching",
      "steps": [
        "Shoulders: cross one arm over your chest and hold 20–30 s per side.",
        "Calves: hands on the wall, stretch one leg back.",
        "Hamstrings: seated, extend one leg and lean forward without rounding your back.",
        "Hold each position without bouncing: gentle tension, never pain."
      ],
      "breathing": "Exhale slowly as you deepen the stretch.",
      "mistakes": [
        "Bouncing",
        "Stretching into pain",
        "Holding your breath"
      ],
      "easier": "Hold 15 seconds.",
      "harder": "Hold 40 seconds."
    },
  },
  "bal": {
    es: {
      "name": "Equilibrio con apoyo",
      "steps": [
        "Párate junto a una pared o silla firme con una mano apoyada.",
        "Levanta un pie 2–3 cm del piso y sostén 10–20 s.",
        "Mira un punto fijo al frente.",
        "Cambia de pierna."
      ],
      "breathing": "Respira normal y relajado.",
      "mistakes": [
        "Mirar al piso",
        "Soltar el apoyo antes de tiempo"
      ],
      "easier": "Apoya la punta del pie levantado en el piso.",
      "harder": "Usa solo un dedo de apoyo."
    },
    en: {
      "name": "Supported balance",
      "steps": [
        "Stand next to a wall or sturdy chair with one hand on it.",
        "Lift one foot 2–3 cm off the floor and hold 10–20 s.",
        "Look at a fixed point ahead.",
        "Switch legs."
      ],
      "breathing": "Breathe normally and stay relaxed.",
      "mistakes": [
        "Looking at the floor",
        "Letting go of the support too soon"
      ],
      "easier": "Keep the toes of the lifted foot touching the floor.",
      "harder": "Use just one finger for support."
    },
  },
  "breath": {
    es: {
      "name": "Respiración diafragmática",
      "steps": [
        "Siéntate o acuéstate cómodo con una mano en el pecho y otra en el abdomen.",
        "Inhala 4 segundos por la nariz inflando el abdomen.",
        "Exhala 6 segundos por la boca, suave.",
        "Repite sin forzar con los hombros relajados."
      ],
      "breathing": "La mano del pecho casi no se mueve; la del abdomen sube y baja.",
      "mistakes": [
        "Subir los hombros",
        "Forzar el aire"
      ],
      "easier": "Inhala 3 y exhala 4 segundos.",
      "harder": "Inhala 5 y exhala 7 segundos."
    },
    en: {
      "name": "Diaphragmatic breathing",
      "steps": [
        "Sit or lie down comfortably, one hand on your chest and one on your belly.",
        "Inhale for 4 seconds through your nose, expanding your belly.",
        "Exhale for 6 seconds through your mouth, softly.",
        "Repeat without forcing, shoulders relaxed."
      ],
      "breathing": "The chest hand barely moves; the belly hand rises and falls.",
      "mistakes": [
        "Raising the shoulders",
        "Forcing the air"
      ],
      "easier": "Inhale 3 and exhale 4 seconds.",
      "harder": "Inhale 5 and exhale 7 seconds."
    },
  },
  "kpush": {
    es: {
      "name": "Flexiones en rodillas",
      "steps": [
        "Apoya manos y rodillas en una colchoneta, manos un poco más anchas que los hombros.",
        "Forma una línea recta desde las rodillas hasta la cabeza, abdomen firme.",
        "Baja el pecho hacia el piso doblando los codos a 45° del cuerpo.",
        "Empuja el piso para volver sin bloquear los codos."
      ],
      "breathing": "Inhala al bajar, exhala al empujar.",
      "mistakes": [
        "Dejar caer la cadera",
        "Abrir los codos en cruz",
        "Bajar solo la cabeza"
      ],
      "easier": "Haz las flexiones de pared o con las manos sobre una mesa.",
      "harder": "Pasa a flexiones completas o baja contando 4 segundos."
    },
    en: {
      "name": "Knee push-ups",
      "steps": [
        "Place hands and knees on a mat, hands slightly wider than shoulders.",
        "Form a straight line from knees to head, abdomen firm.",
        "Lower your chest toward the floor, elbows at 45° from your body.",
        "Push the floor away to return without locking the elbows."
      ],
      "breathing": "Inhale as you lower, exhale as you push.",
      "mistakes": [
        "Letting the hips sag",
        "Flaring elbows out wide",
        "Lowering only the head"
      ],
      "easier": "Do wall push-ups or hands on a table.",
      "harder": "Move to full push-ups or lower for 4 seconds."
    },
  },
  "press": {
    es: {
      "name": "Press de hombros con mancuernas",
      "steps": [
        "Sentado en una silla firme o de pie, mancuernas (o botellas con agua) a la altura de los hombros.",
        "Mantén el abdomen firme y las costillas abajo.",
        "Empuja hacia arriba hasta casi estirar los brazos.",
        "Baja lento hasta los hombros contando 3 segundos."
      ],
      "breathing": "Exhala al empujar, inhala al bajar.",
      "mistakes": [
        "Arquear la espalda",
        "Subir los hombros hacia las orejas",
        "Usar impulso con las piernas"
      ],
      "easier": "Usa menos peso o hazlo con una sola mancuerna.",
      "harder": "Sube el peso un poco cuando completes todas las series."
    },
    en: {
      "name": "Dumbbell shoulder press",
      "steps": [
        "Seated on a sturdy chair or standing, dumbbells (or water bottles) at shoulder height.",
        "Keep your abdomen firm and ribs down.",
        "Press up until your arms are almost straight.",
        "Lower slowly to shoulder height, counting 3 seconds."
      ],
      "breathing": "Exhale as you press, inhale as you lower.",
      "mistakes": [
        "Arching the back",
        "Shrugging toward the ears",
        "Using leg momentum"
      ],
      "easier": "Use lighter weight or one dumbbell.",
      "harder": "Increase the weight slightly when you finish all sets."
    },
  },
  "tri": {
    es: {
      "name": "Extensión de tríceps con banda",
      "steps": [
        "Pisa la banda con un pie o ánclala arriba y toma los extremos.",
        "Pega los codos a las costillas.",
        "Estira los antebrazos hacia abajo hasta casi bloquear los codos.",
        "Vuelve lento sin despegar los codos."
      ],
      "breathing": "Exhala al estirar, inhala al volver.",
      "mistakes": [
        "Mover los codos hacia adelante",
        "Inclinar el torso",
        "Soltar la banda de golpe"
      ],
      "easier": "Usa una banda más suave.",
      "harder": "Usa una banda más fuerte o sostén 1 segundo abajo."
    },
    en: {
      "name": "Band triceps extension",
      "steps": [
        "Step on the band or anchor it high and hold the ends.",
        "Keep elbows tucked against your ribs.",
        "Straighten your forearms down until the elbows are almost locked.",
        "Return slowly without letting the elbows move."
      ],
      "breathing": "Exhale as you extend, inhale as you return.",
      "mistakes": [
        "Letting elbows drift forward",
        "Leaning the torso",
        "Letting the band snap back"
      ],
      "easier": "Use a lighter band.",
      "harder": "Use a stronger band or hold 1 second at the bottom."
    },
  },
  "curl": {
    es: {
      "name": "Curl de bíceps",
      "steps": [
        "De pie o sentado, una mancuerna (o botella) en cada mano con las palmas al frente.",
        "Pega los codos a las costillas.",
        "Dobla los codos subiendo el peso hacia los hombros.",
        "Baja lento contando 3 segundos."
      ],
      "breathing": "Exhala al subir, inhala al bajar.",
      "mistakes": [
        "Balancear el cuerpo",
        "Mover los codos hacia adelante",
        "Bajar de golpe"
      ],
      "easier": "Usa menos peso o alterna un brazo a la vez.",
      "harder": "Sube el peso un poco cuando completes todas las series."
    },
    en: {
      "name": "Biceps curl",
      "steps": [
        "Standing or seated, a dumbbell (or bottle) in each hand, palms forward.",
        "Keep elbows tucked against your ribs.",
        "Bend your elbows, lifting the weight toward your shoulders.",
        "Lower slowly, counting 3 seconds."
      ],
      "breathing": "Exhale as you lift, inhale as you lower.",
      "mistakes": [
        "Swinging the body",
        "Letting elbows drift forward",
        "Dropping the weight"
      ],
      "easier": "Use lighter weight or alternate one arm at a time.",
      "harder": "Increase the weight slightly when you finish all sets."
    },
  },
  "drow": {
    es: {
      "name": "Remo con mancuerna a una mano",
      "steps": [
        "Apoya una mano y una rodilla en una silla o banco firme; la espalda queda recta, casi paralela al piso.",
        "Toma la mancuerna con el brazo estirado.",
        "Jala el codo hacia la cadera juntando el omóplato.",
        "Baja lento contando 3 segundos. Cambia de lado."
      ],
      "breathing": "Exhala al jalar, inhala al bajar.",
      "mistakes": [
        "Girar el torso",
        "Redondear la espalda",
        "Jalar con el hombro en lugar de la espalda"
      ],
      "easier": "Usa menos peso o la banda elástica.",
      "harder": "Pausa 2 segundos arriba."
    },
    en: {
      "name": "One-arm dumbbell row",
      "steps": [
        "Place one hand and one knee on a sturdy chair or bench; your back is flat, almost parallel to the floor.",
        "Hold the dumbbell with your arm straight.",
        "Pull your elbow toward your hip, squeezing the shoulder blade.",
        "Lower slowly, counting 3 seconds. Switch sides."
      ],
      "breathing": "Exhale as you pull, inhale as you lower.",
      "mistakes": [
        "Twisting the torso",
        "Rounding the back",
        "Pulling with the shoulder instead of the back"
      ],
      "easier": "Use lighter weight or the resistance band.",
      "harder": "Pause 2 seconds at the top."
    },
  },
  "gob": {
    es: {
      "name": "Sentadilla con mancuerna",
      "steps": [
        "Sostén una mancuerna (o botella grande) pegada al pecho con las dos manos.",
        "Pies al ancho de los hombros, puntas un poco hacia afuera.",
        "Baja la cadera como si te sentaras, con el pecho arriba.",
        "Empuja con los talones para subir."
      ],
      "breathing": "Inhala al bajar, exhala al subir.",
      "mistakes": [
        "Rodillas hacia adentro",
        "Despegar los talones",
        "Redondear la espalda"
      ],
      "easier": "Haz la sentadilla a la silla sin peso.",
      "harder": "Baja contando 4 segundos o sube el peso."
    },
    en: {
      "name": "Goblet squat",
      "steps": [
        "Hold a dumbbell (or large bottle) against your chest with both hands.",
        "Feet shoulder-width apart, toes slightly out.",
        "Lower your hips as if sitting, chest up.",
        "Push through your heels to stand."
      ],
      "breathing": "Inhale as you lower, exhale as you rise.",
      "mistakes": [
        "Knees caving in",
        "Heels lifting",
        "Rounding the back"
      ],
      "easier": "Do the chair squat with no weight.",
      "harder": "Lower for 4 seconds or increase the weight."
    },
  },
  "rdl": {
    es: {
      "name": "Peso muerto rumano con mancuernas",
      "steps": [
        "De pie, mancuernas (o botellas) frente a los muslos y rodillas ligeramente dobladas.",
        "Lleva la cadera hacia atrás con la espalda recta, deslizando las mancuernas cerca de las piernas.",
        "Baja hasta sentir el estiramiento atrás del muslo.",
        "Aprieta glúteos para subir."
      ],
      "breathing": "Inhala al bajar, exhala al subir.",
      "mistakes": [
        "Redondear la espalda",
        "Doblar demasiado las rodillas",
        "Alejar el peso del cuerpo"
      ],
      "easier": "Hazlo sin peso o con una banda.",
      "harder": "Baja contando 4 segundos o sube el peso."
    },
    en: {
      "name": "Romanian deadlift with dumbbells",
      "steps": [
        "Standing, dumbbells (or bottles) in front of your thighs, knees slightly bent.",
        "Send your hips back with a flat back, sliding the weights close to your legs.",
        "Lower until you feel a stretch behind your thighs.",
        "Squeeze your glutes to stand."
      ],
      "breathing": "Inhale as you lower, exhale as you rise.",
      "mistakes": [
        "Rounding the back",
        "Bending the knees too much",
        "Letting the weight drift away from the body"
      ],
      "easier": "Do it without weight or with a band.",
      "harder": "Lower for 4 seconds or increase the weight."
    },
  },
  "calf": {
    es: {
      "name": "Elevación de talones",
      "steps": [
        "Párate junto a una pared o silla y apoya una mano.",
        "Sube sobre la punta de los pies lo más alto que puedas.",
        "Sostén 1 segundo arriba.",
        "Baja lento contando 3 segundos."
      ],
      "breathing": "Exhala al subir, inhala al bajar.",
      "mistakes": [
        "Rebotar",
        "Doblar las rodillas",
        "Soltar el apoyo"
      ],
      "easier": "Sube solo la mitad.",
      "harder": "Hazlo con un pie a la vez."
    },
    en: {
      "name": "Calf raises",
      "steps": [
        "Stand next to a wall or chair and rest one hand on it.",
        "Rise onto the balls of your feet as high as you can.",
        "Hold 1 second at the top.",
        "Lower slowly, counting 3 seconds."
      ],
      "breathing": "Exhale as you rise, inhale as you lower.",
      "mistakes": [
        "Bouncing",
        "Bending the knees",
        "Letting go of the support"
      ],
      "easier": "Rise only halfway.",
      "harder": "Do it one foot at a time."
    },
  },
  "step": {
    es: {
      "name": "Subida al escalón",
      "steps": [
        "Párate frente a un escalón o banco bajo y estable.",
        "Sube con un pie apoyando todo el pie.",
        "Sube el otro pie y baja controlado con el mismo pie por el que subiste.",
        "Alterna el pie que inicia."
      ],
      "breathing": "Exhala al subir, inhala al bajar.",
      "mistakes": [
        "Empujarte con el pie de abajo",
        "Meter la rodilla hacia adentro",
        "Escalón inestable"
      ],
      "easier": "Usa un escalón más bajo y apóyate en una pared.",
      "harder": "Agrega mancuernas o sube más lento."
    },
    en: {
      "name": "Step-ups",
      "steps": [
        "Stand in front of a low, stable step or bench.",
        "Step up with one foot, placing the whole foot on the step.",
        "Bring the other foot up, then step down in control.",
        "Alternate the leading foot."
      ],
      "breathing": "Exhale as you step up, inhale as you step down.",
      "mistakes": [
        "Pushing off the lower foot",
        "Knee caving in",
        "Unstable step"
      ],
      "easier": "Use a lower step and hold a wall.",
      "harder": "Add dumbbells or go slower."
    },
  },
  "dead": {
    es: {
      "name": "Bicho muerto",
      "steps": [
        "Acuéstate boca arriba con los brazos al techo y las rodillas dobladas a 90° sobre la cadera.",
        "Pega la zona lumbar al piso con el abdomen firme.",
        "Baja lento un brazo y la pierna contraria sin despegar la espalda.",
        "Vuelve y cambia de lado."
      ],
      "breathing": "Exhala al bajar, inhala al volver.",
      "mistakes": [
        "Arquear la espalda",
        "Moverse muy rápido"
      ],
      "easier": "Mueve solo las piernas o solo los brazos.",
      "harder": "Sostén 2 segundos abajo."
    },
    en: {
      "name": "Dead bug",
      "steps": [
        "Lie on your back with arms toward the ceiling and knees bent at 90° over your hips.",
        "Press your lower back into the floor with your abdomen firm.",
        "Slowly lower one arm and the opposite leg without lifting your back.",
        "Return and switch sides."
      ],
      "breathing": "Exhale as you lower, inhale as you return.",
      "mistakes": [
        "Arching the back",
        "Moving too fast"
      ],
      "easier": "Move only legs or only arms.",
      "harder": "Hold 2 seconds at the bottom."
    },
  },
  "bird": {
    es: {
      "name": "Pájaro-perro",
      "steps": [
        "Apoya manos y rodillas en una colchoneta, espalda recta.",
        "Estira un brazo hacia adelante y la pierna contraria hacia atrás.",
        "Mantén la cadera nivelada, sin girar.",
        "Sostén 2 segundos y cambia de lado."
      ],
      "breathing": "Respira normal, sin contener el aire.",
      "mistakes": [
        "Girar la cadera",
        "Arquear la espalda",
        "Levantar demasiado"
      ],
      "easier": "Levanta solo un brazo o solo una pierna.",
      "harder": "Sostén 5 segundos."
    },
    en: {
      "name": "Bird dog",
      "steps": [
        "Place hands and knees on a mat, back flat.",
        "Reach one arm forward and the opposite leg back.",
        "Keep your hips level, no twisting.",
        "Hold 2 seconds and switch sides."
      ],
      "breathing": "Breathe normally without holding your breath.",
      "mistakes": [
        "Twisting the hips",
        "Arching the back",
        "Lifting too high"
      ],
      "easier": "Lift only one arm or only one leg.",
      "harder": "Hold 5 seconds."
    },
  },
};

/** Patrón semanal por objetivo (C F M P L J R / etc.). */
export const PATTERN: Record<string, string> = {
  bajar: "CFCFCMC",
  masa: "PLJRFKR",
  def: "PLJHFKR",
};

/** Reparto de los 4 ejercicios del día por tipo de día. */
export const DAY_TYPES: Record<string, string[]> = {
  C: ["mob", "card", "card", "str"],
  F: ["legs", "push", "pull", "core"],
  M: ["mob", "bal", "breath", "str"],
  P: ["push", "push", "core", "str"],
  L: ["legs", "legs", "core", "str"],
  J: ["pull", "pull", "core", "str"],
  R: ["cardlow", "mob", "str", "breath"],
  K: ["core", "core", "card", "str"],
  H: ["cardhi", "cardhi", "push", "str"],
};

export const DAY_NAMES: Record<string, [string, string]> = {
  C: ["Cardio suave", "Easy cardio"],
  F: ["Cuerpo completo", "Full body"],
  M: ["Movilidad", "Mobility"],
  P: ["Empuje", "Push"],
  L: ["Piernas", "Legs"],
  J: ["Tirón", "Pull"],
  R: ["Recuperación activa", "Active recovery"],
  K: ["Core + cardio", "Core + cardio"],
  H: ["Intervalos + fuerza", "Intervals + strength"],
};

export const POOL: Record<string, string[]> = {
  card: ["walk", "bike", "ellip", "hill", "int"],
  cardlow: ["walk", "bike", "ellip"],
  cardhi: ["int", "hill", "ellip", "bike", "walk"],
  push: ["wall", "tri", "kpush", "press"],
  pull: ["row", "curl", "drow"],
  legs: ["chair", "bridge", "calf", "lunge", "step", "gob", "rdl"],
  core: ["dead", "bird", "plank"],
  mob: ["mob"],
  str: ["str"],
  bal: ["bal"],
  breath: ["breath"],
};

/** Semana mínima en la que cada ejercicio se desbloquea. */
export const UNLOCK_WEEK: Record<string, number> = {
  walk: 1,
  bike: 1,
  mob: 1,
  str: 1,
  breath: 1,
  bal: 1,
  chair: 1,
  wall: 1,
  bridge: 1,
  row: 1,
  dead: 1,
  tri: 2,
  curl: 2,
  ellip: 3,
  calf: 3,
  kpush: 4,
  bird: 4,
  drow: 5,
  press: 7,
  hill: 8,
  plank: 9,
  lunge: 10,
  int: 14,
  step: 16,
  gob: 20,
  rdl: 26,
};

export const PHASES: { name: [string, string]; from: number; to: number; level: number }[] = [
  { name: ["Adaptación", "Adaptation"], from: 1, to: 8, level: 0 },
  { name: ["Construcción", "Build"], from: 9, to: 20, level: 1 },
  { name: ["Intensificación", "Intensify"], from: 21, to: 36, level: 2 },
  { name: ["Consolidación", "Consolidate"], from: 37, to: 52, level: 3 },
];

/** Ejercicios de impacto alto: se filtran si hay dolor ≥4. */
export const HIGH_IMPACT = new Set(["int", "hill"]);
