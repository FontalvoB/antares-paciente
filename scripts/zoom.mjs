/**
 * Amplía una región de una imagen para inspeccionar detalles de diseño.
 *
 *   node scripts/zoom.mjs <ruta> <x> <y> <w> <h> <escala> <salida>
 */
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const [src, x, y, w, h, scale = '3', out = 'zoom'] = process.argv.slice(2)
const s = Number(scale)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: Math.round(Number(w) * s), height: Math.round(Number(h) * s) })
const data = `data:image/png;base64,${readFileSync(src).toString('base64')}`
await page.setContent(
  `<body style="margin:0;overflow:hidden"><img src="${data}" style="position:absolute;left:${-Number(x) * s}px;top:${-Number(y) * s}px;transform:scale(${s});transform-origin:0 0;image-rendering:pixelated"></body>`,
)
await page.waitForNetworkIdle()
await page.screenshot({ path: `C:/Users/ByronFontalvo/antares-paciente/.shots/${out}.png` })
console.log(`.shots/${out}.png`)
await browser.close()
