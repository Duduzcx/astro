/**
 * Capturas e medição da cena com Playwright, para quem está mexendo nela.
 *
 *   node scripts/shot.mjs <url> <largura> <altura> <frações> <prefixo> [--perf] [--clip=x,y,w,h]
 *
 * Abre a página, espera as texturas, rola em passos até cada fração do
 * scroll (0 a 1, separadas por vírgula), espera a cena assentar e salva
 * `<prefixo>-<fração>.jpeg`. Com `--perf`, antes das capturas rola do topo
 * até a maior fração em passos de 14px por frame e imprime a fração de
 * frames acima de 24ms, a média e o pior frame. Com `--clip`, recorta.
 *
 * Exemplo:
 *   node scripts/shot.mjs http://127.0.0.1:4301/ 1280 900 0,0.03,0.2,0.34,0.5 /tmp/a --perf
 */
import { chromium } from 'playwright'

const [, , url, width, height, fracs, prefix, ...flags] = process.argv
if (!url || !width || !height || !fracs || !prefix) {
  console.error('uso: node scripts/shot.mjs <url> <largura> <altura> <frações> <prefixo> [--perf] [--clip=x,y,w,h]')
  process.exit(1)
}
const perf = flags.includes('--perf')
const clipFlag = flags.find((f) => f.startsWith('--clip='))
const clip = clipFlag
  ? (() => {
      const [x, y, w, h] = clipFlag.slice(7).split(',').map(Number)
      return { x, y, width: w, height: h }
    })()
  : undefined

/* Janela fora da tela para não atrapalhar: só para capturas. Medindo,
   a janela fica visível, porque ocluída o navegador reduz o rAF a 1Hz e
   a medida vira lixo. */
const browser = await chromium.launch({
  headless: false,
  args: perf ? ['--window-position=40,40'] : ['--window-position=-2400,0'],
})
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } })
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 200))
})
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 200)))
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(7000)

const fractions = fracs.split(',').map(Number)
const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)

if (perf) {
  const until = Math.max(...fractions)
  const result = await page.evaluate(async (untilFrac) => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    const end = Math.round(maxScroll * untilFrac)
    const frames = []
    let y = 0
    let last = performance.now()
    await new Promise((resolve) => {
      const step = (now) => {
        frames.push(now - last)
        last = now
        y += 14
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
      worstMs: +Math.max(...body).toFixed(0),
    }
  }, until)
  console.log('perf', JSON.stringify(result))
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(1500)
}

for (const fraction of fractions) {
  const target = Math.round(max * fraction)
  await page.evaluate(async (t) => {
    const start = window.scrollY
    const steps = 40
    for (let i = 1; i <= steps; i += 1) {
      window.scrollTo(0, start + ((t - start) * i) / steps)
      await new Promise((r) => setTimeout(r, 30))
    }
  }, target)
  await page.waitForTimeout(1800)
  const path = `${prefix}-${fraction}.jpeg`
  await page.screenshot({ path, type: 'jpeg', quality: 86, clip })
  console.log('shot', path)
}
if (errors.length) console.log('console errors:', JSON.stringify(errors.slice(0, 6)))
await browser.close()
