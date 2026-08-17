import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createCloudTexture, createPlanetTexture, createRingTexture } from '../lib/textures'

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
      // High exponent keeps the glow as a thin halo instead of a drawn outline.
      rim = pow(rim, 3.0);
      gl_FragColor = vec4(vec3(0.35, 0.66, 1.0), rim * 0.5);
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
    // Far enough back that the full ring stays inside the canvas box at every aspect.
    camera.position.set(0, 1.05, 8.4)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const planetTexture = new THREE.CanvasTexture(createPlanetTexture())
    planetTexture.colorSpace = THREE.SRGBColorSpace
    planetTexture.wrapS = THREE.RepeatWrapping

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(1.55, 128, 128),
      new THREE.MeshStandardMaterial({ map: planetTexture, roughness: 0.95, metalness: 0.02 }),
    )
    planet.rotation.z = THREE.MathUtils.degToRad(-14)

    // Second shell, turning faster than the surface. The parallax between the two
    // is what reads as atmosphere instead of as a painted ball.
    const cloudTexture = new THREE.CanvasTexture(createCloudTexture())
    cloudTexture.colorSpace = THREE.SRGBColorSpace
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.575, 96, 96),
      new THREE.MeshStandardMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.55,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
      }),
    )
    clouds.rotation.z = planet.rotation.z

    const atmosphere = new THREE.Mesh(
      // Barely larger than the cloud shell, so the glow hugs the limb instead of
      // drawing its own silhouette as a detached ring.
      new THREE.SphereGeometry(1.6, 64, 64),
      new THREE.ShaderMaterial({
        ...atmosphereShader,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      }),
    )

    const ringTexture = new THREE.CanvasTexture(createRingTexture())
    const ringGeometry = new THREE.RingGeometry(2.0, 3.3, 220, 1)
    // RingGeometry has no usable UVs for a radial stripe, so rewrite u from radius.
    const position = ringGeometry.attributes.position
    const uv = ringGeometry.attributes.uv
    const vertex = new THREE.Vector3()
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i)
      const radial = (vertex.length() - 2.0) / (3.3 - 2.0)
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
    // Shallow enough that the ring reads as a disc, not a line through the planet.
    ring.rotation.x = THREE.MathUtils.degToRad(63)
    ring.rotation.y = THREE.MathUtils.degToRad(-14)

    const group = new THREE.Group()
    group.add(planet, clouds, atmosphere, ring)
    scene.add(group)

    // Three-point rig. The key is warm and slightly off-axis so the terminator
    // falls across the visible face instead of hiding at the edge; the violet
    // bounce keeps the night side readable without flattening it.
    const key = new THREE.DirectionalLight(0xfff0d8, 3.4)
    key.position.set(3.6, 2.8, 2.4)
    const bounce = new THREE.DirectionalLight(0x8052ff, 1.1)
    bounce.position.set(-4.5, -1.2, -1.5)
    const rim = new THREE.DirectionalLight(0x9fd0ff, 1.5)
    rim.position.set(-2.5, 1.8, -3.5)
    scene.add(key, bounce, rim, new THREE.AmbientLight(0x0a1330, 0.4))

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
        // Clouds lead the surface — the differential is the whole point of the shell.
        clouds.rotation.y += 0.0023
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
      cloudTexture.dispose()
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
