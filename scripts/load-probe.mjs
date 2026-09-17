/**
 * Quanto tempo até a cena aparecer, num celular mediano.
 *
 * O container do canvas nasce em `opacity-0` e sobe quando o primeiro quadro
 * é desenhado, então a opacidade dele é o marco honesto de "a cena apareceu".
 * Mede também a maior tarefa que trava o thread principal, que é o que faz a
 * página parecer congelada antes de qualquer coisa surgir.
 *
 *   node scripts/load-probe.mjs <url> [device]
 */
import { chromium, devices } from 'playwright'

const url = process.argv[2] || 'http://localhost:4173/'
const deviceName = process.argv[3] || 'iPhone 13'
const browser = await chromium.launch({ headless: false, args: ['--window-position=40,40'] })
const ctx = await browser.newContext({ ...devices[deviceName], isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

await page.addInitScript(() => {
  window.__marks = { longest: 0, tasks: 0, firstPaint: 0 }
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__marks.tasks += 1
      window.__marks.longest = Math.max(window.__marks.longest, Math.round(entry.duration))
    }
  }).observe({ type: 'longtask', buffered: true })
  const seek = () => {
    const el = document.querySelector('canvas')?.parentElement
    if (el && parseFloat(getComputedStyle(el).opacity) > 0.05) {
      window.__marks.firstPaint = Math.round(performance.now())
      return
    }
    requestAnimationFrame(seek)
  }
  requestAnimationFrame(seek)
})

const started = Date.now()
await page.goto(url)
await page.waitForFunction(() => window.__marks.firstPaint > 0, null, { timeout: 60000 })
  .catch(() => console.log('cena nao apareceu em 60s'))
await page.waitForTimeout(6000)

const out = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0]
  const textures = performance
    .getEntriesByType('resource')
    .filter((r) => /\.(webp|png|jpe?g)$/.test(r.name) && r.name.includes('/space/'))
  const glb = performance.getEntriesByType('resource').find((r) => r.name.endsWith('.glb'))
  return {
    cenaVisivelMs: window.__marks.firstPaint,
    maiorTravadaMs: window.__marks.longest,
    tarefasLongas: window.__marks.tasks,
    domInterativoMs: Math.round(nav.domInteractive),
    texturas: textures.length,
    primeiraTexturaMs: textures.length ? Math.round(Math.min(...textures.map((t) => t.startTime))) : null,
    ultimaTexturaMs: textures.length ? Math.round(Math.max(...textures.map((t) => t.responseEnd))) : null,
    glbMs: glb ? Math.round(glb.responseEnd) : 'NAO BAIXOU',
    glbKb: glb ? Math.round(glb.transferSize / 1024) : null,
  }
})
console.log(JSON.stringify(out))
console.log('parede', Date.now() - started, 'ms')
await browser.close()
