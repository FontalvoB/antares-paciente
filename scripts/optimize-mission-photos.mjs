/**
 * Reescala y recomprime las fotos de misión al tamaño real de la tarjeta.
 * Evita meter megas de imagen en el bundle móvil.
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const DIR = new URL('../src/assets/missions/', import.meta.url)
const WIDTH = 820
const HEIGHT = 520
const QUALITY = 0.78

const files = (await readdir(DIR)).filter((f) => f.endsWith('.jpg'))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.goto('about:blank')

for (const file of files) {
  const src = new URL(file, DIR)
  const before = (await stat(src)).size
  const base64 = (await readFile(src)).toString('base64')

  const out = await page.evaluate(
    async (data, w, h, q) =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          // Recorte centrado tipo object-fit: cover.
          const scale = Math.max(w / img.width, h / img.height)
          const dw = img.width * scale
          const dh = img.height * scale
          ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
          resolve(canvas.toDataURL('image/jpeg', q))
        }
        img.src = `data:image/jpeg;base64,${data}`
      }),
    base64,
    WIDTH,
    HEIGHT,
    QUALITY,
  )

  const buf = Buffer.from(out.split(',')[1], 'base64')
  await writeFile(src, buf)
  console.log(`${file}: ${Math.round(before / 1024)} kB → ${Math.round(buf.length / 1024)} kB`)
}

await browser.close()
