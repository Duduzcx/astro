import { chromium, devices } from 'playwright'
const b = await chromium.launch({ headless: false, args: ['--window-position=40,40'] })
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent })
const p = await c.newPage()
const msgs = []
p.on('console', (m) => msgs.push(m.type() + ': ' + m.text().slice(0, 200)))
p.on('pageerror', (e) => msgs.push('PAGEERROR: ' + String(e).slice(0, 200)))
p.on('requestfailed', (r) => msgs.push('FALHOU: ' + r.url().slice(0, 120) + ' -> ' + (r.failure()?.errorText || '')))
await p.goto('https://astrosolucoes.netlify.app/', { waitUntil: 'networkidle' })
await p.waitForTimeout(14000)
const rel = msgs.filter((m) => /draco|glb|wasm|worker|blob|error|falhou/i.test(m))
console.log(rel.length ? rel.slice(0, 8).join('\n') : 'nada relevante')
await b.close()
