import { chromium } from 'playwright'
const b = await chromium.launch({ headless: false, args: ['--window-position=40,40'] })
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const p = await c.newPage()
const erros = []
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text().slice(0, 140)) })
p.on('pageerror', (e) => erros.push('JS: ' + String(e).slice(0, 140)))
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await p.waitForTimeout(8000)
const tr = await p.evaluate(() => new Promise((resolve) => {
  const m = document.querySelector('main'), t0 = performance.now(), am = []
  document.getElementById('entrada-botao').click()
  const v = setInterval(() => {
    const cs = getComputedStyle(m)
    am.push(Math.round(performance.now() - t0) + 'ms:' + (document.documentElement.classList.contains('site-entrando') ? 'classe' : 'sem') + '/op' + Number(cs.opacity).toFixed(2))
    if (performance.now() - t0 > 1700) { clearInterval(v); resolve(am.filter((_, i) => i % 3 === 0)) }
  }, 100)
}))
console.log('transicao:', tr.join('  '))
await p.evaluate(() => { const t = document.getElementById('entrada'); if (t && t.parentNode) t.parentNode.removeChild(t); document.documentElement.style.overflow = '' })
const S = process.argv[2]
for (const f of [0.0, 0.04, 0.08, 0.13]) {
  await p.evaluate(async (fr) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, max * fr)
    await new Promise((r) => setTimeout(r, 2200))
    for (const s of ['main', 'nav', 'header', 'footer']) document.querySelectorAll(s).forEach((e) => { e.style.visibility = 'hidden' })
  }, f)
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${S}/pc-${f}.jpeg`, type: 'jpeg', quality: 86 })
}
console.log('erros:', erros.join(' | ') || 'nenhum')
await b.close()
