/**
 * Procedural textures. The site ships no photography, so every surface is generated
 * at runtime — nothing to download, nothing to license, and the palette stays exact.
 */

/** Cheap value noise: enough structure for banding and dust, no library needed. */
function noise(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return n - Math.floor(n)
}

function smoothNoise(x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const ease = (t: number) => t * t * (3 - 2 * t)
  const u = ease(xf)
  const v = ease(yf)

  const a = noise(xi, yi)
  const b = noise(xi + 1, yi)
  const c = noise(xi, yi + 1)
  const d = noise(xi + 1, yi + 1)

  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
}

function fbm(x: number, y: number, octaves = 5) {
  let value = 0
  let amplitude = 0.5
  let frequency = 1

  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, y * frequency) * amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return value
}

/**
 * Gas-giant style banding in the Astro blues. Bands run along latitude and are
 * warped by noise so the seam between them never reads as a straight line.
 */
export function createPlanetTexture(width = 1024, height = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(width, height)

  // Deep trough → mid → bright crest, sampled by band value.
  const ramp = [
    [4, 12, 34],
    [10, 32, 80],
    [23, 77, 155],
    [90, 169, 255],
    [207, 226, 255],
  ]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width
      const v = y / height

      // Warp the latitude before banding so bands undulate instead of striping.
      const warp = fbm(u * 6, v * 12) * 0.55
      const bands = Math.sin((v * 9 + warp) * Math.PI * 2) * 0.5 + 0.5
      const detail = fbm(u * 18, v * 30, 4) * 0.35
      const t = Math.min(1, Math.max(0, bands * 0.75 + detail))

      const scaled = t * (ramp.length - 1)
      const index = Math.min(ramp.length - 2, Math.floor(scaled))
      const mix = scaled - index
      const from = ramp[index]
      const to = ramp[index + 1]

      const offset = (y * width + x) * 4
      image.data[offset] = from[0] + (to[0] - from[0]) * mix
      image.data[offset + 1] = from[1] + (to[1] - from[1]) * mix
      image.data[offset + 2] = from[2] + (to[2] - from[2]) * mix
      image.data[offset + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  return canvas
}

/**
 * Ring system as a 1D gradient stretched across a strip: alternating dense lanes
 * and gaps, densest in the middle so the ring reads as material, not as a decal.
 */
export function createRingTexture(width = 1024, height = 8): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  for (let x = 0; x < width; x++) {
    const t = x / width
    // Two overlapping lane frequencies plus grain, faded at both edges.
    const lanes = Math.sin(t * Math.PI * 34) * 0.5 + 0.5
    const coarse = Math.sin(t * Math.PI * 7 + 1.2) * 0.5 + 0.5
    const grain = noise(x, 0) * 0.3
    const edge = Math.sin(t * Math.PI)
    const alpha = Math.max(0, (lanes * 0.5 + coarse * 0.4 + grain) * edge - 0.18)

    ctx.fillStyle = `rgba(${180 + coarse * 60}, ${205 + coarse * 30}, 255, ${alpha})`
    ctx.fillRect(x, 0, 1, height)
  }

  return canvas
}
