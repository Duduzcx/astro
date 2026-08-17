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
export function createPlanetTexture(width = 1536, height = 768): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(width, height)

  // Deep trough → mid → bright crest, sampled by band value.
  const ramp = [
    [3, 6, 22],
    [8, 24, 68],
    [21, 66, 148],
    [76, 148, 240],
    [188, 219, 255],
  ]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width
      const v = y / height

      // Sample noise on a circle in u so the texture is periodic — otherwise the
      // sphere shows a vertical seam where the map wraps.
      const angle = u * Math.PI * 2
      const cu = Math.cos(angle)
      const su = Math.sin(angle)

      // Two-stage domain warp. The first pass bends the latitude, the second
      // shears it sideways — that shear is what turns flat stripes into the
      // stretched, curled flow a gas envelope actually has.
      const warpA = fbm(cu * 2.2 + 5, su * 2.2 + v * 9) - 0.5
      const shear = fbm(cu * 4 + warpA * 2 + 31, su * 4 + v * 16) - 0.5
      const latitude = v * 11 + warpA * 1.35 + shear * 0.9

      const bands = Math.sin(latitude * Math.PI * 2) * 0.5 + 0.5
      const detail = fbm(cu * 10 + shear * 3 + 17, su * 10 + v * 26, 5) * 0.3

      // Storms: sparse bright ovals riding the bands, strongest at mid latitude.
      const stormField = fbm(cu * 5 + 61, su * 5 + v * 7, 3)
      const stormMask = Math.max(0, stormField - 0.62) * 2.6
      const latitudeMask = Math.sin(v * Math.PI)

      // Poles run darker, as they do on every banded body.
      const poles = Math.pow(latitudeMask, 0.45)

      const t = Math.min(
        1,
        Math.max(0, (bands * 0.72 + detail + stormMask * 0.5 * latitudeMask) * poles),
      )

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
 * Cloud veil for a second, slightly larger shell that turns at its own rate.
 * Two shells moving at different speeds is what stops the planet from reading
 * as a painted ball.
 */
export function createCloudTexture(width = 1024, height = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(width, height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width
      const v = y / height
      const angle = u * Math.PI * 2
      const cu = Math.cos(angle)
      const su = Math.sin(angle)

      // Streaks stretched along longitude: high frequency in v, low in u.
      const streak = fbm(cu * 3 + 11, su * 3 + v * 22, 4)
      const wisp = fbm(cu * 7 + 43, su * 7 + v * 40, 3)
      const value = Math.max(0, streak * 0.75 + wisp * 0.45 - 0.52) * 2.4
      const fade = Math.pow(Math.sin(v * Math.PI), 0.7)

      const offset = (y * width + x) * 4
      image.data[offset] = 235
      image.data[offset + 1] = 245
      image.data[offset + 2] = 255
      image.data[offset + 3] = Math.min(255, value * fade * 255)
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
    const lanes = Math.sin(t * Math.PI * 16) * 0.5 + 0.5
    const coarse = Math.sin(t * Math.PI * 5 + 1.2) * 0.5 + 0.5
    const grain = noise(x, 0) * 0.3
    const edge = Math.sin(t * Math.PI)
    const alpha = Math.max(0, (lanes * 0.45 + coarse * 0.4 + grain) * edge - 0.16)

    // Dim and blue: the ring frames the planet, it does not compete with it.
    ctx.fillStyle = `rgba(${86 + coarse * 60}, ${140 + coarse * 50}, ${226 + coarse * 26}, ${Math.min(0.5, alpha)})`
    ctx.fillRect(x, 0, 1, height)
  }

  return canvas
}
