import { chromium, devices } from 'playwright'
const alvo = process.argv[2]
const b = await chromium.launch({ headless: false, args: ['--window-position=40,40'] })
for (const perfil of ['pc', 'celular']) {
  const c = await b.newContext(perfil === 'pc'
    ? { viewport: { width: 1440, height: 900 } }
    : { ...devices['iPhone 13'], isMobile: true, hasTouch: true })
  const p = await c.newPage()
  const erros = []
  const rede = []
  p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text().slice(0, 150)) })
  p.on('pageerror', (e) => erros.push('JS: ' + String(e).slice(0, 150)))
  p.on('response', (r) => { if (r.status() >= 400) rede.push(r.status() + ' ' + r.url().split('/').pop()) })
  await p.goto(alvo, { waitUntil: 'networkidle' })
  await p.waitForTimeout(8000)
  await p.evaluate(() => { const bt = document.getElementById('entrada-botao'); if (bt) bt.click() })
  await p.waitForTimeout(1600)
  const r = await p.evaluate(() => {
    const ancoras = [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href'))
    const quebradas = ancoras.filter((h) => h && h.length > 1 && !document.querySelector(h))
    const semAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length
    const niveis = [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => Number(h.tagName[1]))
    let saltos = 0
    for (let i = 1; i < niveis.length; i++) if (niveis[i] - niveis[i - 1] > 1) saltos++
    const botoesSemNome = [...document.querySelectorAll('button')].filter(
      (x) => !x.textContent.trim() && !x.getAttribute('aria-label')).length
    const externosSemRel = [...document.querySelectorAll('a[target="_blank"]')].filter(
      (a) => !(a.getAttribute('rel') || '').includes('noopener')).length
    return {
      tela: !!document.getElementById('entrada'),
      canvas: !!document.querySelector('canvas'),
      h1: document.querySelectorAll('h1').length,
      ancoras: ancoras.length, ancorasQuebradas: quebradas,
      imgSemAlt: semAlt, saltosDeTitulo: saltos,
      botoesSemNome, externosSemRel,
      rolavel: document.documentElement.scrollHeight > innerHeight + 100,
      titulo: document.title.length, descricao: (document.querySelector('meta[name=description]') || {}).content?.length || 0,
    }
  })
  console.log(perfil.padEnd(8), JSON.stringify(r))
  console.log('  erros:', erros.slice(0, 3).join(' | ') || 'nenhum', '| rede>=400:', rede.slice(0, 3).join(' | ') || 'nenhuma')
  await c.close()
}
await b.close()
