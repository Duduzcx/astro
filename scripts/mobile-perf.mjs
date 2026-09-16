/**
 * Medição de celular de verdade: iPhone 13 emulado (390x844, DPR 3) com o
 * processador quatro vezes mais lento, que é a faixa de um aparelho mediano.
 * Uma janela de 400px no desktop mente: lá a razão de pixels é 1 e a CPU é a
 * do computador.
 *
 *   node scripts/mobile-perf.mjs <url> [fração final]
 */
import { chromium, devices } from 'playwright'

const url = process.argv[2] || 'http://127.0.0.1:4173/'
const until = Number(process.argv[3] || 0.4)
const browser = await chromium.launch({ headless: false, args: ['--window-position=40,40'] })
const ctx = await browser.newContext({ ...devices['iPhone 13'], isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(12000)
const result = await page.evaluate(async (untilFrac) => {
  const max = document.documentElement.scrollHeight - window.innerHeight
  const end = Math.round(max * untilFrac)
  const frames = []
  let y = 0
  let last = performance.now()
  await new Promise((resolve) => {
    const step = (now) => {
      frames.push(now - last)
      last = now
      y += 22
      window.scrollTo(0, y)
      if (y < end) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })
  const body = frames.slice(5)
  const long = body.filter((f) => f > 24).length
  return {
    frames: body.length,
    longPct: +((100 * long) / body.length).toFixed(2),
    avgMs: +(body.reduce((a, b) => a + b, 0) / body.length).toFixed(1),
    worstMs: Math.round(Math.max(...body)),
  }
}, until)
console.log('mobile', JSON.stringify(result))
await browser.close()
