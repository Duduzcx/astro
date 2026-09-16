/** Altura real de cada seção num celular, para calibrar contain-intrinsic-size. */
import { chromium, devices } from 'playwright'
const url = process.argv[2] || 'http://localhost:4173/'
const browser = await chromium.launch({ headless: false, args: ['--window-position=40,40'] })
const ctx = await browser.newContext({ ...devices['iPhone 13'], isMobile: true, hasTouch: true })
const page = await ctx.newPage()
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
/* Passa a pagina inteira uma vez para tudo renderizar e assentar. */
await page.evaluate(async () => {
  const max = document.documentElement.scrollHeight
  for (let y = 0; y < max; y += 600) {
    window.scrollTo(0, y)
    await new Promise((r) => setTimeout(r, 40))
  }
  window.scrollTo(0, 0)
  await new Promise((r) => setTimeout(r, 300))
})
const rows = await page.evaluate(() =>
  [...document.querySelectorAll('main > section')].map((s, i) => ({
    i,
    id: s.id || '(sem id)',
    /* Caixa de conteudo, que e o que contain-intrinsic-size define: a borda
       e o padding da secao continuam somando por fora. */
    h: Math.round(
      s.getBoundingClientRect().height -
        parseFloat(getComputedStyle(s).paddingTop) -
        parseFloat(getComputedStyle(s).paddingBottom),
    ),
  })),
)
console.log(JSON.stringify(rows))
console.log('total', rows.reduce((a, r) => a + r.h, 0), 'doc', await page.evaluate(() => document.documentElement.scrollHeight))
await browser.close()
