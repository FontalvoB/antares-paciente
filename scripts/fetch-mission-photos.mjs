/**
 * Descarga las fotos de las tarjetas de misión del protocolo diario.
 * Solo acepta licencias CC0 / dominio público (sin atribución obligatoria).
 *
 *   node scripts/fetch-mission-photos.mjs          → lista candidatas
 *   node scripts/fetch-mission-photos.mjs --save   → descarga la elegida
 */
import { writeFile, mkdir } from 'node:fs/promises'

const OUT = new URL('../src/assets/missions/', import.meta.url)

const QUERIES = {
  podcast: 'podcast microphone headphones',
  vitals: 'blood pressure monitor health',
  nut: 'healthy salad vegetables',
  ejercicio: 'gym dumbbell weights',
  nutribiotico: 'supplement capsules pills',
  emocional: 'meditation calm nature',
}

/** Índice del resultado elegido para cada misión (se fija tras revisar). */
const PICK = JSON.parse(process.env.PICK ?? '{}')

async function search(query) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=6&license=cc0,pdm&extension=jpg`
  const res = await fetch(url, { headers: { 'User-Agent': 'copp-adresd-ui/1.0' } })
  if (!res.ok) throw new Error(`${query}: HTTP ${res.status}`)
  const json = await res.json()
  return json.results.map((r) => ({ title: r.title, url: r.url, license: r.license, w: r.width, h: r.height }))
}

async function main() {
  const save = process.argv.includes('--save')
  const candidates = process.argv.includes('--candidates')
  if (save) await mkdir(OUT, { recursive: true })

  if (candidates) {
    const dir = new URL('../.shots/candidates/', import.meta.url)
    await mkdir(dir, { recursive: true })
    for (const [id, query] of Object.entries(QUERIES)) {
      const results = await search(query)
      for (const [i, r] of results.entries()) {
        const img = await fetch(r.url, { headers: { 'User-Agent': 'copp-adresd-ui/1.0' } })
        if (!img.ok) continue
        await writeFile(new URL(`${id}-${i}.jpg`, dir), Buffer.from(await img.arrayBuffer()))
      }
      console.log(`${id}: ${results.length} candidatas`)
    }
    return
  }

  for (const [id, query] of Object.entries(QUERIES)) {
    const results = await search(query)
    if (!save) {
      console.log(`\n## ${id} — "${query}"`)
      results.forEach((r, i) => console.log(`  [${i}] ${r.license} ${r.w}x${r.h} · ${r.title}\n      ${r.url}`))
      continue
    }
    const chosen = results[PICK[id] ?? 0]
    if (!chosen) {
      console.log(`${id}: sin resultados`)
      continue
    }
    const img = await fetch(chosen.url, { headers: { 'User-Agent': 'copp-adresd-ui/1.0' } })
    const buf = Buffer.from(await img.arrayBuffer())
    await writeFile(new URL(`${id}.jpg`, OUT), buf)
    console.log(`${id}.jpg ← ${chosen.license} · ${chosen.title} (${Math.round(buf.length / 1024)} kB)`)
  }
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
