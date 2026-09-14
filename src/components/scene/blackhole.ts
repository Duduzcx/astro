import * as THREE from 'three'
import { RING_NORMAL } from './triangles'

/**
 * O buraco negro por cima da forma dos triângulos: um horizonte preto que
 * apaga tudo atrás (estrelas, campo, o miolo do disco), um disco de acreção
 * inclinado no mesmo plano dos anéis, com a borda interna branca-quente,
 * um lado mais claro (doppler) e estrias girando mais rápido perto do
 * centro, e dois arcos de pé atrás do horizonte — a luz do lado de trás do
 * disco dobrada por cima e por baixo, o visual do Interstellar sem passe
 * de lente.
 *
 * `presence` é o peso da forma (1 quando os triângulos são o buraco negro),
 * `mix` a dispersão do campo: o disco só aparece com o campo agrupado.
 */
export type BlackHoleState = {
  x: number
  y: number
  scale: number
  opacity: number
  presence: number
  mix: number
}

const INNER = 0.44
/* Borda externa curta: acima de 1,4 o brilho já era quase zero e cada
   pixel do anel custa fill rate no desktop. */
const OUTER = 1.4
const HORIZON = 0.4

const DISC_VERTEX = /* glsl */ `
  varying vec2 vPos;
  varying float vDoppler;
  void main() {
    vPos = position.xy;
    /* Direção tangencial em espaço de câmera: quem vem na nossa direção
       brilha mais, quem se afasta apaga. */
    float a = atan(position.y, position.x);
    vec3 tangent = normalize(normalMatrix * vec3(-sin(a), cos(a), 0.0));
    vDoppler = 1.0 + 0.7 * tangent.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const DISC_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uGain;
  varying vec2 vPos;
  varying float vDoppler;
  void main() {
    float r = length(vPos);
    float a = atan(vPos.y, vPos.x);
    float rn = clamp((r - ${INNER.toFixed(2)}) / (${OUTER.toFixed(2)} - ${INNER.toFixed(2)}), 0.0, 1.0);
    /* Mais brilho para dentro, como 1/r². */
    float radial = pow(1.0 - rn, 2.4);
    float hot = smoothstep(0.14, 0.0, rn);
    vec3 warm = mix(vec3(0.9, 0.3, 0.04), vec3(1.0, 0.68, 0.28), pow(1.0 - rn, 1.6));
    vec3 color = mix(warm, vec3(1.0, 0.96, 0.88), hot);
    /* Estrias: duas ondas por ângulo, torcidas pelo raio, num referencial
       que gira mais depressa perto do centro. Sem ruído por pixel: o disco
       ocupa meia tela por um quinto da página no desktop, e cada instrução
       aqui é fill rate. */
    float spin = uTime * (0.35 + 0.8 / max(r, ${INNER.toFixed(2)}));
    float wave = sin(a * 9.0 + spin + sin(r * 11.0 + uTime * 0.2) * 2.0);
    float fine = sin(a * 23.0 - spin * 1.7 + r * 6.0);
    float streak = 0.62 + 0.24 * wave + 0.14 * fine;
    float alpha = radial * streak * vDoppler;
    /* Anel de fótons: um fio branco colado ao horizonte. */
    float photon = smoothstep(0.022, 0.0, abs(r - ${INNER.toFixed(2)} - 0.012));
    color += vec3(1.0) * photon;
    alpha += photon * 0.9;
    gl_FragColor = vec4(color, alpha * uOpacity * uGain);
  }
`

function ringMaterial(gain: number) {
  return new THREE.ShaderMaterial({
    vertexShader: DISC_VERTEX,
    fragmentShader: DISC_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uGain: { value: gain },
    },
  })
}

export function createBlackHole({ segments }: { segments: number }) {
  const object = new THREE.Group()
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []

  /* Horizonte: esfera preta opaca. Com blending aditivo não existe partícula
     escura, então o preto é literalmente tapar o que está atrás. */
  const horizonGeometry = new THREE.SphereGeometry(HORIZON, 32, 20)
  const horizonMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const horizon = new THREE.Mesh(horizonGeometry, horizonMaterial)
  horizon.renderOrder = -3
  object.add(horizon)
  geometries.push(horizonGeometry)
  materials.push(horizonMaterial)

  /* Disco no plano dos anéis dos triângulos. */
  const discGeometry = new THREE.RingGeometry(INNER, OUTER, segments, 4)
  const discMaterial = ringMaterial(1)
  const disc = new THREE.Mesh(discGeometry, discMaterial)
  disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), RING_NORMAL)
  disc.renderOrder = -1
  object.add(disc)
  geometries.push(discGeometry)
  materials.push(discMaterial)

  /* Arcos dobrados: meio anel de pé, atrás do horizonte, por cima e por
     baixo. Menor e mais fraco embaixo. */
  const topGeometry = new THREE.RingGeometry(INNER, 1.15, segments, 3, 0, Math.PI)
  const topMaterial = ringMaterial(0.6)
  const top = new THREE.Mesh(topGeometry, topMaterial)
  top.position.z = -0.05
  top.renderOrder = -2
  object.add(top)
  geometries.push(topGeometry)
  materials.push(topMaterial)

  const bottomGeometry = new THREE.RingGeometry(INNER, 0.8, segments, 2, Math.PI, Math.PI)
  const bottomMaterial = ringMaterial(0.3)
  const bottom = new THREE.Mesh(bottomGeometry, bottomMaterial)
  bottom.position.z = -0.05
  bottom.renderOrder = -2
  object.add(bottom)
  geometries.push(bottomGeometry)
  materials.push(bottomMaterial)

  const rings = [discMaterial, topMaterial, bottomMaterial]

  return {
    object,
    update(state: BlackHoleState, time: number) {
      /* Só com o campo agrupado: disperso, o disco não tem o que enfeitar. */
      const grouped = 1 - Math.min(Math.max((state.mix - 0.25) / 0.6, 0), 1)
      const strength = state.opacity * state.presence * grouped
      object.visible = strength > 0.01
      if (!object.visible) return
      object.position.set(state.x, state.y, 0)
      object.scale.setScalar(state.scale)
      for (const material of rings) {
        material.uniforms.uTime.value = time
        material.uniforms.uOpacity.value = strength
      }
    },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
    },
  }
}
