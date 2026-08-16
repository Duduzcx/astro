import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createPlanetTexture, createRingTexture } from '../lib/textures'

/** Rim light. Cheap fresnel — brightest where the surface turns away from the camera. */
const atmosphereShader = {
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vViewDir = normalize(-viewPosition.xyz);
      gl_Position = projectionMatrix * viewPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
      rim = pow(rim, 2.6);
      gl_FragColor = vec4(vec3(0.35, 0.66, 1.0), rim * 0.85);
    }
  `,
}

/**
 * The planet object. Real 3D because the whole point is a lit sphere with a ring
 * crossing in front of and behind it — depth a 2D fake cannot sell.
 */
export function Planet({ className = '' }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 0.85, 6.2)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const planetTexture = new THREE.CanvasTexture(createPlanetTexture())
    planetTexture.colorSpace = THREE.SRGBColorSpace
    planetTexture.wrapS = THREE.RepeatWrapping

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(1.55, 96, 96),
      new THREE.MeshStandardMaterial({ map: planetTexture, roughness: 0.92, metalness: 0.05 }),
    )
    planet.rotation.z = THREE.MathUtils.degToRad(-14)

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.68, 64, 64),
      new THREE.ShaderMaterial({
        ...atmosphereShader,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      }),
    )

    const ringTexture = new THREE.CanvasTexture(createRingTexture())
    const ringGeometry = new THREE.RingGeometry(2.1, 3.35, 180, 1)
    // RingGeometry has no usable UVs for a radial stripe, so rewrite u from radius.
    const position = ringGeometry.attributes.position
    const uv = ringGeometry.attributes.uv
    const vertex = new THREE.Vector3()
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i)
      const radial = (vertex.length() - 2.1) / (3.35 - 2.1)
      uv.setXY(i, radial, 0.5)
    }

    const ring = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({
        map: ringTexture,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    )
    ring.rotation.x = THREE.MathUtils.degToRad(74)
    ring.rotation.y = THREE.MathUtils.degToRad(-12)

    const group = new THREE.Group()
    group.add(planet, atmosphere, ring)
    scene.add(group)

    // Key light upper right, cold fill from the opposite side, almost no ambient.
    const key = new THREE.DirectionalLight(0xdfeaff, 3.1)
    key.position.set(4, 3.4, 3)
    const fill = new THREE.DirectionalLight(0x1b4dff, 0.9)
    fill.position.set(-5, -1.5, -2)
    scene.add(key, fill, new THREE.AmbientLight(0x0a2050, 0.55))

    let pointerX = 0
    let pointerY = 0
    let tiltX = 0
    let tiltY = 0
    let frame = 0

    const resize = () => {
      const { clientWidth, clientHeight } = mount
      if (!clientWidth || !clientHeight) return
      renderer.setSize(clientWidth, clientHeight)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
    }

    const onPointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 0.42
      pointerY = (event.clientY / window.innerHeight - 0.5) * 0.26
    }

    const render = () => {
      tiltX += (pointerY - tiltX) * 0.045
      tiltY += (pointerX - tiltY) * 0.045
      group.rotation.x = tiltX
      group.rotation.y = tiltY

      if (!reduceMotion) {
        planet.rotation.y += 0.0016
        ring.rotation.z += 0.0004
      }

      renderer.render(scene, camera)
      if (reduceMotion) return
      frame = requestAnimationFrame(render)
    }

    resize()
    render()

    const observer = new ResizeObserver(() => {
      resize()
      if (reduceMotion) renderer.render(scene, camera)
    })
    observer.observe(mount)
    if (!reduceMotion) window.addEventListener('pointermove', onPointerMove)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      renderer.dispose()
      planetTexture.dispose()
      ringTexture.dispose()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const material = object.material as THREE.Material | THREE.Material[]
          if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
          else material.dispose()
        }
      })
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} aria-hidden="true" className={className} />
}

// Default export so the three.js bundle can be code-split behind React.lazy.
export default Planet
