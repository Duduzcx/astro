import { chromium, devices } from 'playwright'
const b = await chromium.launch({ headless: false, args: ['--window-position=40,40'] })
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent })
const p = await c.newPage()
const errs = []
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
await p.goto(process.argv[3], { waitUntil: 'networkidle' })
await p.waitForTimeout(12000)
await p.evaluate(() => { for (const s of ['main', 'nav', 'header', 'footer']) document.querySelectorAll(s).forEach((e) => { e.style.visibility = 'hidden' }) })
await p.waitForTimeout(900)
await p.screenshot({ path: process.argv[2], type: 'jpeg', quality: 88 })
console.log(errs.length ? 'ERROS: ' + errs.slice(0, 3).join(' | ') : 'sem erros de console')
await b.close()
