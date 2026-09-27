/**
 * O ruído do disco de acreção, calculado fora do thread principal.
 *
 * Recebe o tamanho da textura e devolve os bytes RGBA; quem sabe o que cada
 * canal significa é makeNoiseTexture, em blackhole.ts. A conta é a mesma de
 * sempre, byte a byte — mudou de thread, não de resultado. São 65 mil
 * pixels com quatro fbm cada a 256: uns 136ms medidos no desktop, que
 * ficavam no meio da montagem da cena segurando o primeiro quadro.
 */
function gerar(size: number) {
  const data = new Uint8Array(size * size * 4)
  const hash = (x: number, y: number, seed: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return s - Math.floor(s)
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const valueNoise = (x: number, y: number, period: number, seed: number) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = fade(x - x0)
    const fy = fade(y - y0)
    const ix0 = ((x0 % period) + period) % period
    const iy0 = ((y0 % period) + period) % period
    const ix1 = (ix0 + 1) % period
    const iy1 = (iy0 + 1) % period
    const a = hash(ix0, iy0, seed)
    const b = hash(ix1, iy0, seed)
    const c = hash(ix0, iy1, seed)
    const d = hash(ix1, iy1, seed)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
  const fbm = (u: number, v: number, base: number, octaves: number, seed: number) => {
    let sum = 0
    let amp = 0.5
    let period = base
    let norm = 0
    for (let o = 0; o < octaves; o += 1) {
      sum += amp * valueNoise(u * period, v * period, period, seed + o * 3.1)
      norm += amp
      amp *= 0.55
      period *= 2
    }
    return sum / norm
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size
      const i = (y * size + x) * 4
      /* Estrias: malha esticada no eixo do ângulo (u), fina no raio (v). */
      const streak = fbm(u, v * 5, 4, 4, 1)
      const grain = fbm(u * 2, v * 8, 8, 3, 7)
      const spare = fbm(u, v, 4, 3, 13)
      data[i] = Math.round(Math.min(Math.max((streak - 0.5) * 1.9 + 0.5, 0), 1) * 255)
      data[i + 1] = Math.round(Math.min(Math.max((grain - 0.5) * 2.2 + 0.5, 0), 1) * 255)
      data[i + 2] = Math.round(spare * 255)
      data[i + 3] = 255
    }
  }
  return data
}

self.addEventListener('message', (evento: MessageEvent<number>) => {
  const data = gerar(evento.data)
  /* Transferido, e não copiado: o buffer muda de dono, e a thread principal
     o recebe sem alocar nada. */
  ;(self as unknown as { postMessage(dados: Uint8Array, transferir: Transferable[]): void }).postMessage(
    data,
    [data.buffer],
  )
})
