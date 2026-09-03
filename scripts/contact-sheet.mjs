/** Compone las fotos candidatas en una hoja de contacto para revisarlas de un vistazo. */
import { readdir, writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const DIR = 'C:/Users/ByronFontalvo/antares-paciente/.shots/candidates'

const files = (await readdir(DIR)).filter((f) => f.endsWith('.jpg')).sort()

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin:0; background:#fff; font:12px system-ui; }
  .grid { display:grid; grid-template-columns:repeat(6,1fr); gap:6px; padding:8px; }
  figure { margin:0; }
  img { width:100%; height:110px; object-fit:cover; border-radius:6px; display:block; }
  figcaption { font-size:10px; padding-top:2px; color:#333; }
</style>
<div class="grid">
${files.map((f) => `<figure><img src="./${f}"><figcaption>${f.replace('.jpg', '')}</figcaption></figure>`).join('\n')}
</div>`

await writeFile(`${DIR}/index.html`, html)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] })
const page = await browser.newPage()
await page.setViewport({ width: 1100, height: 900 })
await page.goto(`file:///${DIR}/index.html`, { waitUntil: 'networkidle0' })
await page.screenshot({ path: `${DIR}/../contact-sheet.png`, fullPage: true })
console.log('listo')
await browser.close()
