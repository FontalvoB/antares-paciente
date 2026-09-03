/** Añade claves nuevas al final de es.json y en.json conservando el orden y el formato. */
import { readFile, writeFile } from 'node:fs/promises'

const KEYS = {
  'Agenda tu control': 'Book your check-up',
  'Elige profesional y horario disponible': 'Pick a professional and an available time',
  'No pudimos cargar tus citas': "We couldn't load your appointments",
  'Revisa tu conexión e intenta de nuevo': 'Check your connection and try again',
  'Sin datos': 'No data',
  'Cargando tus citas': 'Loading your appointments',
  'Unirse a tu cita': 'Join your appointment',
  'Agendar una cita': 'Book an appointment',
  'Reintentar cargar tus citas': 'Retry loading your appointments',
  'Semana {cur} de {total}': 'Week {cur} of {total}',
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
