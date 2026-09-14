import * as THREE from 'three'
import { SIMPLEX_NOISE } from './glsl'

/**
 * O planeta de verdade: uma esfera com superfície procedural (oceano cobalto,
 * gelo ivory, calotas, nuvens), terminador dia/noite e borda de atmosfera.
 * Fica dentro da casca de triângulos, que vira a crosta brilhante em volta.
 *
 * `break` de 0 a 1 é a explosão: os vértices voam ao longo da normal por
 * ruído, a cor esquenta para laranja no meio do caminho e o alfa cai. A
 * atmosfera dá o flash: incha e clareia no pico e some junto.
 */
export type PlanetState = {
  x: number
  y: number
  /** Profundidade: a Terra do hero fica longe, para caber na tela. */
  z?: number
  scale: number
  opacity: number
  break: number
}

/** target: o planeta que explode. earth: a Terra do hero. gas, rock, ice: o desfile. */
export type PlanetKind = 'target' | 'earth' | 'gas' | 'rock' | 'ice'

const KIND_INDEX: Record<PlanetKind, number> = { target: 0, earth: 1, gas: 2, rock: 3, ice: 4 }
/** Força da atmosfera por tipo. */
const KIND_RIM: Record<PlanetKind, number> = { target: 1, earth: 1.5, gas: 1.2, rock: 0.45, ice: 0.9 }

/* Raio casado com a casca do corpo dos triângulos (0,6 a 0,66). */
const RADIUS = 0.62
const ATMOSPHERE = 0.72

const SURFACE_VERTEX = /* glsl */ `
  uniform float uBreak;
  varying vec3 vNormalV;
  varying vec3 vObj;
  varying vec3 vView;
  ${SIMPLEX_NOISE}
  void main() {
    vec3 p = position;
    /* Cada região voa com força própria: o ruído por posição faz pedaços,
       não um balão inflando. */
    float chunk = snoise(position * 2.2 + 7.0) * 0.5 + 0.5;
    float burst = uBreak * uBreak;
    p += normal * (0.15 + 0.85 * chunk) * burst * 0.7;
    vObj = position;
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const SURFACE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uBreak;
  uniform float uOpacity;
  uniform float uKind;
  uniform vec3 uLight;
  varying vec3 vNormalV;
  varying vec3 vObj;
  varying vec3 vView;
  ${SIMPLEX_NOISE}
  void main() {
    /* Superfície em espaço do objeto: gira junto com a malha. */
    vec3 q = vObj / ${RADIUS.toFixed(2)};
    float e = fbm(q * 2.6);
    float land = smoothstep(0.02, 0.12, e);
    vec3 albedo;
    float clouds = 0.0;
    float spec = 0.0;
    if (uKind > 1.5 && uKind < 2.5) {
      /* Gigante gasoso: faixas por latitude, torcidas por ruído, sem chão. */
      float twist = snoise(q * 2.0) * 0.5;
      float band = fbm(vec3(q.y * 5.0 + twist, q.x * 0.5, q.z * 0.5));
      vec3 cream = vec3(0.93, 0.86, 0.72);
      vec3 tan = vec3(0.76, 0.56, 0.36);
      vec3 rust = vec3(0.55, 0.33, 0.22);
      albedo = mix(cream, tan, smoothstep(-0.2, 0.2, band));
      albedo = mix(albedo, rust, smoothstep(0.25, 0.5, band));
      float storm = smoothstep(0.35, 0.15, length(vec2(q.x - 0.55, q.y + 0.25) * vec2(1.0, 1.8)));
      albedo = mix(albedo, vec3(0.85, 0.42, 0.28), storm * 0.8);
      land = 1.0;
    } else if (uKind > 2.5 && uKind < 3.5) {
      /* Rochoso: ferrugem, crateras escuras com borda clara. */
      float relief = fbm(q * 4.0);
      albedo = mix(vec3(0.5, 0.25, 0.16), vec3(0.82, 0.52, 0.36), smoothstep(-0.3, 0.4, relief));
      float craterField = snoise(q * 9.0);
      float crater = smoothstep(0.5, 0.58, craterField);
      float rimLight = smoothstep(0.42, 0.5, craterField) * (1.0 - crater);
      albedo = mix(albedo, albedo * 0.45, crater);
      albedo += rimLight * 0.15;
      land = 1.0;
    } else if (uKind > 3.5) {
      /* Lua de gelo: branco-azul com fendas escuras. */
      float sheen = fbm(q * 3.0);
      albedo = mix(vec3(0.72, 0.82, 0.94), vec3(0.94, 0.97, 1.0), smoothstep(-0.2, 0.4, sheen));
      float cracks = smoothstep(0.03, 0.0, abs(snoise(q * 7.0)));
      albedo = mix(albedo, vec3(0.3, 0.45, 0.7), cracks * 0.7);
      land = 0.2;
    } else if (uKind > 0.5) {
      /* A Terra: oceano fundo, plataformas claras, verde nas baixadas e
         terra nos planaltos, calotas, nuvens largas. */
      vec3 ocean = mix(vec3(0.02, 0.09, 0.3), vec3(0.05, 0.3, 0.62), smoothstep(-0.35, 0.02, e));
      vec3 terrain = mix(vec3(0.15, 0.35, 0.13), vec3(0.55, 0.47, 0.3), smoothstep(0.12, 0.42, e));
      albedo = mix(ocean, terrain, land);
      float polar = smoothstep(0.66, 0.84, abs(q.y));
      albedo = mix(albedo, vec3(0.95, 0.97, 1.0), polar);
      float c = fbm(q * 3.2 + vec3(uTime * 0.012, 0.0, uTime * 0.008));
      clouds = smoothstep(0.14, 0.4, c);
      albedo = mix(albedo, vec3(0.97), clouds * 0.75);
    } else {
      vec3 ocean = mix(vec3(0.05, 0.12, 0.34), vec3(0.11, 0.27, 0.64), smoothstep(-0.3, 0.0, e));
      vec3 ice = mix(vec3(0.62, 0.72, 0.92), vec3(0.86, 0.9, 0.96), smoothstep(0.1, 0.35, e));
      albedo = mix(ocean, ice, land);
      float polar = smoothstep(0.62, 0.82, abs(q.y));
      albedo = mix(albedo, vec3(0.94, 0.96, 0.99), polar * 0.85);
      float c = fbm(q * 3.4 + vec3(uTime * 0.015, 0.0, uTime * 0.01));
      clouds = smoothstep(0.16, 0.42, c);
      /* Nuvens contidas: o texto do Manifesto passa por cima do planeta. */
      albedo = mix(albedo, vec3(0.9, 0.93, 0.98), clouds * 0.5);
    }

    vec3 n = normalize(vNormalV);
    vec3 v = normalize(vView);
    float facing = dot(n, uLight);
    /* Terminador macio, noite com um resto de luz. */
    float day = smoothstep(-0.22, 0.38, facing);
    vec3 color = albedo * (0.07 + 0.93 * day);
    spec = pow(max(dot(reflect(-uLight, n), v), 0.0), 40.0) * (1.0 - land) * 0.35 * day;
    color += spec;
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    color += vec3(0.35, 0.55, 1.0) * fresnel * (0.3 + 0.7 * day);
    if (uKind > 0.5 && uKind < 1.5) {
      /* Luzes de cidade no lado noturno, só em terra e fora das nuvens. */
      float cities = smoothstep(0.5, 0.8, snoise(q * 26.0)) * land * (1.0 - clouds * 0.7);
      color += vec3(1.0, 0.78, 0.45) * cities * (1.0 - day) * 0.9;
    }

    /* Explosão: esquenta no meio do caminho e some no fim. */
    float heat = sin(clamp(uBreak, 0.0, 1.0) * 3.14159);
    color = mix(color, vec3(1.0, 0.55, 0.2), heat * 0.7);
    color += vec3(1.0, 0.8, 0.5) * heat * 0.6;
    /* Some cedo: quem carrega os detritos são os triângulos. */
    float alpha = uOpacity * (1.0 - smoothstep(0.2, 0.75, uBreak));
    gl_FragColor = vec4(color, alpha);
  }
`

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vView;
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uBreak;
  uniform float uRim;
  uniform vec3 uLight;
  varying vec3 vNormalV;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(vView);
    /* Lado de trás da esfera maior: só a borda passa por fora do planeta,
       que tapa o miolo pela profundidade. */
    float rim = pow(1.0 - abs(dot(n, v)), 3.0) * uRim;
    float day = 0.35 + 0.65 * smoothstep(-0.4, 0.5, dot(n, uLight));
    float heat = sin(clamp(uBreak, 0.0, 1.0) * 3.14159);
    vec3 color = mix(vec3(0.4, 0.62, 1.0), vec3(1.0, 0.75, 0.45), heat);
    float alpha = rim * day * uOpacity * (1.0 - uBreak) + rim * heat * heat * 2.0 * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`

const RING_VERTEX = /* glsl */ `
  varying vec2 vPos;
  varying vec3 vNormalV;
  void main() {
    vPos = position.xy;
    vNormalV = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const RING_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uLight;
  varying vec2 vPos;
  varying vec3 vNormalV;
  ${SIMPLEX_NOISE}
  void main() {
    float r = length(vPos);
    float t = (r - ${(RADIUS * 1.45).toFixed(3)}) / ${(RADIUS * 0.9).toFixed(3)};
    float bands = 0.5 + 0.5 * sin(t * 42.0 + snoise(vec3(t * 5.0, 0.0, 0.0)) * 3.0);
    float gap = smoothstep(0.62, 0.66, t) * smoothstep(0.72, 0.68, t);
    float alpha = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.9, t) * (0.3 + 0.45 * bands) * (1.0 - gap * 0.85);
    float lit = 0.45 + 0.55 * abs(dot(normalize(vNormalV), uLight));
    vec3 color = mix(vec3(0.82, 0.74, 0.6), vec3(0.95, 0.9, 0.8), bands) * lit;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

export function createPlanet({
  segments,
  kind = 'target',
  spin = 0.04,
  ring = false,
}: {
  segments: number
  kind?: PlanetKind
  /** Rotação em rad/s. A Terra, enorme, gira bem mais devagar. */
  spin?: number
  /** Anel inclinado, para o gigante gasoso. */
  ring?: boolean
}) {
  const object = new THREE.Group()
  const kindIndex = KIND_INDEX[kind]
  /* Luz fixa em espaço de câmera: o terminador fica parado enquanto a
     superfície gira. */
  const light = new THREE.Vector3(-0.55, 0.42, 0.72).normalize()

  const surfaceGeometry = new THREE.SphereGeometry(RADIUS, segments, Math.round(segments * 0.62))
  const surfaceMaterial = new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uBreak: { value: 0 },
      uOpacity: { value: 1 },
      uKind: { value: kindIndex },
      uLight: { value: light },
    },
  })
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial)
  /* Desenha antes dos triângulos: com a profundidade gravada, a metade de
     trás da casca some atrás do planeta e só a crosta da frente fica. */
  surface.renderOrder = -2
  object.add(surface)

  const atmosphereGeometry = new THREE.SphereGeometry(ATMOSPHERE, segments, Math.round(segments * 0.62))
  const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uOpacity: { value: 1 },
      uBreak: { value: 0 },
      uRim: { value: KIND_RIM[kind] },
      uLight: { value: light },
    },
  })
  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
  atmosphere.renderOrder = -1
  object.add(atmosphere)

  /* Anel: faixas de alfa por ruído, inclinado, dos dois lados. */
  let ringGeometry: THREE.RingGeometry | null = null
  let ringMaterial: THREE.ShaderMaterial | null = null
  if (ring) {
    ringGeometry = new THREE.RingGeometry(RADIUS * 1.45, RADIUS * 2.35, 96, 3)
    ringMaterial = new THREE.ShaderMaterial({
      vertexShader: RING_VERTEX,
      fragmentShader: RING_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: 1 }, uLight: { value: light } },
    })
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial)
    ringMesh.rotation.x = 1.25
    ringMesh.rotation.y = 0.3
    ringMesh.renderOrder = -1
    object.add(ringMesh)
  }

  return {
    object,
    update(state: PlanetState, time: number) {
      object.visible = state.opacity > 0.015 && state.break < 0.999
      if (!object.visible) return
      object.position.set(state.x, state.y, state.z ?? 0)
      object.scale.setScalar(state.scale)
      surface.rotation.y = time * spin
      const heat = Math.sin(Math.min(Math.max(state.break, 0), 1) * Math.PI)
      atmosphere.scale.setScalar(1 + heat * 0.5)
      surfaceMaterial.uniforms.uTime.value = time
      surfaceMaterial.uniforms.uBreak.value = state.break
      surfaceMaterial.uniforms.uOpacity.value = state.opacity
      atmosphereMaterial.uniforms.uBreak.value = state.break
      atmosphereMaterial.uniforms.uOpacity.value = state.opacity
      if (ringMaterial) ringMaterial.uniforms.uOpacity.value = state.opacity
    },
    dispose() {
      surfaceGeometry.dispose()
      surfaceMaterial.dispose()
      atmosphereGeometry.dispose()
      atmosphereMaterial.dispose()
      ringGeometry?.dispose()
      ringMaterial?.dispose()
    },
  }
}
