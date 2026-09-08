/** Añade claves nuevas al final de es.json y en.json conservando el orden y el formato. */
import { readFile, writeFile } from 'node:fs/promises'

const KEYS = {
  // Inicio — accesos y progreso semanal
  '{done} de {total} hábitos en meta': '{done} of {total} habits on target',
  'Cumplimiento promedio': 'Average adherence',
  '7 / 8 vasos': '7 / 8 glasses',
  'Módulo 5 de 8': 'Module 5 of 8',

  // Visualización del perfil — pantalla
  'Visualización del perfil': 'Body profile view',
  'Índices y mediciones corporales': 'Body indices and measurements',
  'Medición del 05/08/2026': 'Measured on 05/08/2026',
  '3 índices': '3 indices',
  'Índices sobre tu cuerpo': 'Indices on your body',
  'Toca un índice para ver qué significa y cuál es tu meta.':
    'Tap an index to see what it means and what your target is.',
  'Toca una zona del cuerpo o un índice para ver el detalle.':
    'Tap a body area or an index to see the details.',
  Frente: 'Front',
  Espalda: 'Back',
  'Abdomen y cintura': 'Abdomen and waist',
  'Tronco y caderas': 'Torso and hips',
  'Antebrazo · sitio de medición': 'Forearm · measurement site',
  'Masa corporal': 'Body mass',
  'Estatura completa': 'Full stature',
  'Muñeca y antebrazo': 'Wrist and forearm',
  'Figura del cuerpo con los índices de salud señalados':
    'Body figure with the health indices marked on it',
  Mediciones: 'Measurements',

  // Visualización del perfil — índices
  Glucosa: 'Glucose',
  Sobrepeso: 'Overweight',
  'Sobre el rango': 'Above range',
  'En rango': 'In range',
  'Relación entre tu peso y tu talla. Bajó 1.2 puntos desde el inicio del protocolo.':
    'The ratio between your weight and your height. It dropped 1.2 points since the protocol started.',
  'Grasa corporal estimada por el método Deurenberg con tu índice cintura-cadera.':
    'Body fat estimated with the Deurenberg method using your waist-to-hip ratio.',
  'Glucosa en ayunas del último laboratorio. Está en rango, cerca del umbral de prediabetes.':
    'Fasting glucose from your latest lab. It is in range, close to the prediabetes threshold.',
  'Meta ≤ 25.0': 'Target ≤ 25.0',
  'Meta ≤ 24%': 'Target ≤ 24%',
  'Meta < 100 mg/dL': 'Target < 100 mg/dL',

  // Visualización del perfil — tramos de las escalas de referencia
  Bajo: 'Low',
  Normal: 'Normal',
  Obesidad: 'Obesity',
  Atlética: 'Athletic',
  Saludable: 'Healthy',
  Elevada: 'High',
  'Muy alta': 'Very high',
  Baja: 'Low',
  Prediabetes: 'Prediabetes',
  Diabetes: 'Diabetes',

  // Visualización del perfil — mediciones y lecturas derivadas
  Talla: 'Height',
  Cintura: 'Waist',
  Cadera: 'Hip',
  Muñeca: 'Wrist',
  'Meta del ciclo: 70.0 kg': 'Cycle target: 70.0 kg',
  'Medida sin calzado': 'Measured without shoes',
  'Riesgo cardiometabólico desde 88 cm': 'Cardiometabolic risk from 88 cm up',
  'Base del índice cintura-cadera': 'Basis of the waist-to-hip ratio',
  'Define tu complexión ósea': 'Defines your bone frame size',
  'Índice cintura-cadera': 'Waist-to-hip ratio',
  'Riesgo moderado': 'Moderate risk',
  'Complexión ósea': 'Bone frame size',
  Mediana: 'Medium',
  'Talla ÷ muñeca = 10.2': 'Height ÷ wrist = 10.2',
  '0.85': '0.85',
  'Mediciones tomadas en consulta el 05/08/2026. El % de grasa es un estimado calculado con fórmulas validadas y no reemplaza una bioimpedancia clínica.':
    'Measurements taken in consultation on 05/08/2026. Body fat % is an estimate computed with validated formulas and does not replace a clinical bioimpedance test.',

  // Reproductor del protocolo (claves pendientes en la rama)
  'Audio en streaming': 'Streaming audio',
  'Error al iniciar la reproducción de audio.': 'Error starting audio playback.',
  'No se pudo reproducir el archivo de audio.': 'The audio file could not be played.',
}

async function patch(file, pick) {
  const raw = await readFile(file, 'utf8')
  const dict = JSON.parse(raw)
  let added = 0
  for (const [key, en] of Object.entries(KEYS)) {
    if (key in dict) continue
    dict[key] = pick(key, en)
    added += 1
  }
  await writeFile(file, `${JSON.stringify(dict, null, 2).replace(/\n/g, '\r\n')}\r\n`, 'utf8')
  console.log(`${file}: +${added}`)
}

await patch('src/i18n/es.json', (key) => key)
await patch('src/i18n/en.json', (_key, en) => en)
