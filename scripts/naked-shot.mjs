/**
 * Captura a cena com o DOM escondido, numa fração da rolagem.
 *
 *   node scripts/naked-shot.mjs <saída.jpeg> <fração>
 *
 * Esconde main, nav, header e footer depois de rolar, então sobra só o
 * canvas. É o único jeito de julgar um astro: atrás dos cartões translúcidos
 * já passaram despercebidos um Saturno usando a mancha de Júpiter e dois
 * erros de enquadramento. Julgue aqui antes de dizer que está bom.
 *
 * O preview sobe em [::1]:4173; 127.0.0.1 não responde. Rode uma captura por
 * vez e sem outra janela por cima — janela ocluída derruba o rAF para 1Hz.
 */
import { chromium, devices } from 'playwright'
const b = await chromium.launch({ headless: false, args: ['--window-position=40,40'] })
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent })
const p = await c.newPage()
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await p.waitForTimeout(9000)
await p.evaluate(async (f) => {
  const max = document.documentElement.scrollHeight - window.innerHeight
  window.scrollTo(0, max * f)
  await new Promise((r) => setTimeout(r, 2500))
  for (const s of ['main', 'nav', 'header', 'footer']) document.querySelectorAll(s).forEach((e) => { e.style.visibility = 'hidden' })
}, Number(process.argv[3]))
await p.waitForTimeout(1200)
await p.screenshot({ path: process.argv[2], type: 'jpeg', quality: 92 })
console.log('ok')
await b.close()
