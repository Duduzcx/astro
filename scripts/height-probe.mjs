/**
 * Mede junto duas coisas durante a mesma rolagem: o custo por quadro e a
 * estabilidade da altura do documento. A cena lê o progresso como
 * scrollY / (scrollHeight - palco), então altura que muda no meio da rolagem
 * desloca a coreografia inteira.
 */
import { chromium, devices } from 'playwright'

const url = process.argv[2] || 'http://localhost:4173/'
const until = Number(process.argv[3] || 1.0)
const browser = await chromium.launch({ headless: false, args: ['--window-position=40,40'] })
const deviceName = process.argv[4] || 'iPhone 13'
const ctx = await browser.newContext({ ...devices[deviceName], isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(12000)
const result = await page.evaluate(async (untilFrac) => {
  const doc = document.documentElement
  const startHeight = doc.scrollHeight
  /* Acima de 1 o argumento vale em pixels. Comparar duas versoes pela fracao
     mente quando uma delas muda a altura do documento: a fracao percorreria
     menos pagina e o custo medio cairia sozinho. */
  const max = doc.scrollHeight - window.innerHeight
  const end = untilFrac > 1 ? Math.round(untilFrac) : Math.round(max * untilFrac)
  const frames = []
  const heights = []
  let y = 0
  let last = performance.now()
  await new Promise((resolve) => {
    const step = (now) => {
      frames.push(now - last)
      last = now
      heights.push(doc.scrollHeight)
      y += 22
      window.scrollTo(0, y)
      if (y < end) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })
  const body = frames.slice(5)
  let changes = 0
  for (let i = 1; i < heights.length; i += 1) if (heights[i] !== heights[i - 1]) changes += 1
  return {
    frames: body.length,
    longPct: +((100 * body.filter((f) => f > 24).length) / body.length).toFixed(2),
    avgMs: +(body.reduce((a, b) => a + b, 0) / body.length).toFixed(1),
    worstMs: Math.round(Math.max(...body)),
    heightStart: startHeight,
    heightMin: Math.min(...heights),
    heightMax: Math.max(...heights),
    heightChanges: changes,
  }
}, until)
console.log(JSON.stringify(result))
await browser.close()
