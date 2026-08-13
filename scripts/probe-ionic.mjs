import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 430, height: 920, isMobile: true, hasTouch: true })
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 })

  await page.waitForSelector('ion-input.fld', { timeout: 10000 })

  const data = await page.evaluate(() => {
    const cs = (el, props) => {
      if (!el) return null
      const s = getComputedStyle(el)
      const o = {}
      for (const p of props) o[p] = s.getPropertyValue(p)
      return o
    }
    const out = {}
    const inp = document.querySelector('ion-input.fld .native-input')
    const inpHost = document.querySelector('ion-input.fld')
    const chain = []
    let el = inp
    while (el) {
      const s = getComputedStyle(el)
      chain.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '',
        fs: s.fontSize,
        fw: s.fontWeight,
        ff: s.fontFamily.split(',')[0],
        color: s.color,
      })
      el = el.parentElement
    }
    out.chain = chain
    out.wrapperBox = (() => {
      const w = inp ? inp.parentElement.parentElement : null
      return w ? { h: w.getBoundingClientRect().height, fs: getComputedStyle(w).fontSize } : null
    })()
    out.input = inp ? cs(inp, ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color']) : null
    out.inputBox = inp ? { h: inp.getBoundingClientRect().height, w: inp.getBoundingClientRect().width } : null
    out.inputHostBox = inpHost ? { h: inpHost.getBoundingClientRect().height, w: inpHost.getBoundingClientRect().width } : null
    const sel = document.querySelector('ion-select.fld .select-text')
    const selHost = document.querySelector('ion-select.fld')
    out.select = sel ? cs(sel, ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color']) : null
    out.selectHost = cs(selHost, ['font-size', 'min-height', 'height', 'padding-top', 'padding-bottom', 'border-top-width'])
    out.selectHostBox = selHost ? { h: selHost.getBoundingClientRect().height, w: selHost.getBoundingClientRect().width } : null
    const shadow = inp ? inp.getRootNode() : null
    out.hasNativeInput = !!inp
    return out
  })

  console.log(JSON.stringify(data, null, 2))
  await page.screenshot({ path: 'C:/Users/CARLOS~1/AppData/Local/Temp/opencode/onboarding-actual.png' })
  await browser.close()
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
