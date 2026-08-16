import { useEffect, useRef } from 'react'

type Point = {
  /** Unit-sphere coordinates. Radius is applied at draw time. */
  x: number
  y: number
  z: number
}

type Satellite = {
  /** Angle along its own ring, in radians. */
  angle: number
  speed: number
  /** Ring tilt around the x axis. */
  tilt: number
  radius: number
}

const SHELL_POINTS = 1500
const SATELLITES = 5

/** Fibonacci sphere — even coverage without the pole clustering of naive lat/long sampling. */
function buildShell(count: number): Point[] {
  const points: Point[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const ring = Math.sqrt(1 - y * y)
    const theta = golden * i
    points.push({ x: Math.cos(theta) * ring, y, z: Math.sin(theta) * ring })
  }
  return points
}

function buildSatellites(count: number): Satellite[] {
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2,
    speed: 0.0022 + i * 0.0006,
    tilt: -0.9 + i * 0.42,
    radius: 1.22 + i * 0.13,
  }))
}

/**
 * The page signature: a rotating point-shell with satellites tracing tilted orbits
 * around it. Canvas 2D on purpose — a WebGL dependency buys nothing at this fidelity.
 */
export function OrbitField({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const shell = buildShell(SHELL_POINTS)
    const satellites = buildSatellites(SATELLITES)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let radius = 0
    let frame = 0
    let spin = 0
    // Pointer parallax, eased toward the raw target so the shell never snaps.
    let tiltTarget = 0
    let tilt = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      radius = Math.min(width, height) * 0.34
    }

    const onPointerMove = (event: PointerEvent) => {
      tiltTarget = (event.clientY / window.innerHeight - 0.5) * 0.5
    }

    const project = (p: Point, sin: number, cos: number, sinT: number, cosT: number) => {
      // Yaw first, then pitch, then a weak perspective divide.
      const x = p.x * cos - p.z * sin
      const zYaw = p.x * sin + p.z * cos
      const y = p.y * cosT - zYaw * sinT
      const z = p.y * sinT + zYaw * cosT
      const scale = 1 / (2.6 - z)
      return {
        sx: width / 2 + x * radius * scale * 2.6,
        sy: height / 2 + y * radius * scale * 2.6,
        depth: (z + 1) / 2,
      }
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height)
      tilt += (tiltTarget - tilt) * 0.05

      const sin = Math.sin(spin)
      const cos = Math.cos(spin)
      const sinT = Math.sin(tilt)
      const cosT = Math.cos(tilt)

      // Core glow — the shell reads as lit from inside rather than drawn as outline.
      const glow = ctx.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        radius * 2.2,
      )
      glow.addColorStop(0, 'rgba(27, 77, 255, 0.22)')
      glow.addColorStop(0.45, 'rgba(10, 32, 80, 0.14)')
      glow.addColorStop(1, 'rgba(3, 10, 28, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, width, height)

      for (const point of shell) {
        const { sx, sy, depth } = project(point, sin, cos, sinT, cosT)
        // Back-facing points stay faint, so the shell has a readable front and back.
        const alpha = 0.06 + depth * depth * 0.62
        const size = 0.5 + depth * 1.25
        ctx.fillStyle =
          depth > 0.82
            ? `rgba(207, 226, 255, ${alpha})`
            : `rgba(90, 169, 255, ${alpha * 0.85})`
        ctx.fillRect(sx, sy, size, size)
      }

      for (const satellite of satellites) {
        const point: Point = {
          x: Math.cos(satellite.angle) * satellite.radius,
          y: Math.sin(satellite.angle) * satellite.radius * Math.sin(satellite.tilt),
          z: Math.sin(satellite.angle) * satellite.radius * Math.cos(satellite.tilt),
        }
        const { sx, sy, depth } = project(point, sin, cos, sinT, cosT)
        ctx.beginPath()
        ctx.arc(sx, sy, 1.4 + depth * 2.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(237, 243, 255, ${0.25 + depth * 0.7})`
        ctx.fill()
        if (!reduceMotion) satellite.angle += satellite.speed
      }

      // With reduced motion the shell is drawn once and left alone.
      if (reduceMotion) return
      spin += 0.0011
      frame = requestAnimationFrame(render)
    }

    const resizeAndRedraw = () => {
      resize()
      if (reduceMotion) render()
    }

    resize()
    render()

    window.addEventListener('resize', resizeAndRedraw)
    if (!reduceMotion) window.addEventListener('pointermove', onPointerMove)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resizeAndRedraw)
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />
}
