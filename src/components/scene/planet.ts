import * as THREE from 'three'
import { SIMPLEX_NOISE } from './glsl'

/**
 * A fábrica de mundos. Uma esfera com superfície procedural por tipo, com
 * relevo de verdade (a altura vira normal por derivadas de tela, e a luz
 * bate nas montanhas), escurecimento nas bordas, terminador dia/noite,
 * atmosfera, e, na Terra e no alvo, uma camada de nuvens separada girando
 * no seu próprio ritmo. O gigante gasoso pode ter anel, com a sombra do
 * planeta sobre ele.
 *
 * `break` de 0 a 1 é a explosão do alvo: os vértices voam ao longo da
 * normal por ruído, a cor esquenta e o alfa cai. A atmosfera dá o flash.
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
/** Força e cor da atmosfera por tipo. */
const KIND_RIM: Record<PlanetKind, number> = { target: 1.0, earth: 1.6, gas: 1.1, rock: 0.5, ice: 0.8 }
const KIND_ATMOSPHERE: Record<PlanetKind, string> = {
  target: '#6aa0ff',
  earth: '#5f9dff',
  gas: '#e8c9a0',
  rock: '#e0a070',
  ice: '#a9c8ff',
}
/** Quem tem nuvens. */
const KIND_CLOUDS: Record<PlanetKind, boolean> = { target: true, earth: true, gas: false, rock: false, ice: false }

/* Raio casado com a casca do corpo dos triângulos (0,6 a 0,66). */
const RADIUS = 0.62
const CLOUDS = 0.632
const ATMOSPHERE = 0.72

/* Normal perturbada pela altura via derivadas de tela: uma amostra de
   altura por pixel, sem textura. É o perturbNormalArb do three. */
const PERTURB = /* glsl */ `
  vec3 perturb(vec3 surfPos, vec3 surfNorm, float height, float scale) {
    vec3 sigmaX = dFdx(surfPos);
    vec3 sigmaY = dFdy(surfPos);
    vec3 r1 = cross(sigmaY, surfNorm);
    vec3 r2 = cross(surfNorm, sigmaX);
    float det = dot(sigmaX, r1);
    float dhdx = dFdx(height) * scale;
    float dhdy = dFdy(height) * scale;
    vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
    return normalize(abs(det) * surfNorm - grad);
  }
`

const SURFACE_VERTEX = /* glsl */ `
  uniform float uBreak;
  varying vec3 vNormalV;
  varying vec3 vObj;
  varying vec3 vViewPos;
  ${SIMPLEX_NOISE}
  void main() {
    vec3 p = position;
    float chunk = snoise(position * 2.2 + 7.0) * 0.5 + 0.5;
    float burst = uBreak * uBreak;
    p += normal * (0.15 + 0.85 * chunk) * burst * 0.7;
    vObj = position;
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const SURFACE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uBreak;
  uniform float uOpacity;
  uniform float uKind;
  uniform float uDetail;
  uniform vec3 uLight;
  varying vec3 vNormalV;
  varying vec3 vObj;
  varying vec3 vViewPos;
  ${SIMPLEX_NOISE}
  ${PERTURB}

  void main() {
    vec3 q = vObj / ${RADIUS.toFixed(2)};
    vec3 albedo;
    float height = 0.0;
    float relief = 1.0;
    float water = 0.0;
    float land = 1.0;

    if (uKind < 0.5) {
      /* O alvo: mundo de gelo e oceano, montanhas claras. */
      float base = fbm3(q * 2.6);
      float e = base + 0.2 * fbm3(q * 5.0);
      land = smoothstep(0.0, 0.08, e);
      water = 1.0 - land;
      vec3 ocean = mix(vec3(0.04, 0.1, 0.3), vec3(0.1, 0.26, 0.6), smoothstep(-0.4, 0.0, e));
      vec3 ice = mix(vec3(0.6, 0.7, 0.9), vec3(0.9, 0.93, 0.97), smoothstep(0.1, 0.45, e));
      albedo = mix(ocean, ice, land);
      /* Contínua na costa: máscara na altura vira degrau, e degrau vira
         bloco na derivada de tela. */
      height = max(base, 0.0);
      relief = 0.55;
    } else if (uKind < 1.5) {
      /* A Terra: oceano fundo com plataforma clara, areia na costa, verde
         nas baixadas, terra nos planaltos, neve nas montanhas, calotas. */
      float base = fbm3(q * 2.2);
      float e = base + 0.35 * fbm(q * 6.5);
      land = smoothstep(0.0, 0.05, e);
      water = 1.0 - land;
      vec3 ocean = mix(vec3(0.02, 0.07, 0.24), vec3(0.04, 0.26, 0.55), smoothstep(-0.45, 0.0, e));
      vec3 sand = vec3(0.72, 0.66, 0.48);
      vec3 low = vec3(0.14, 0.34, 0.12);
      vec3 high = vec3(0.5, 0.42, 0.28);
      vec3 snow = vec3(0.95, 0.96, 0.98);
      vec3 terrain = mix(sand, low, smoothstep(0.02, 0.09, e));
      terrain = mix(terrain, high, smoothstep(0.18, 0.4, e));
      terrain = mix(terrain, snow, smoothstep(0.48, 0.6, e));
      albedo = mix(ocean, terrain, land);
      float polar = smoothstep(0.7, 0.86, abs(q.y) + snoise(q * 5.0) * 0.05);
      albedo = mix(albedo, snow, polar);
      water *= 1.0 - polar;
      height = max(base, 0.0);
      relief = 0.6;
    } else if (uKind < 2.5) {
      /* Gigante gasoso: faixas por latitude com o domínio torcido por
         ruído, turbulência fina, uma tempestade oval. */
      vec3 w = q + 0.3 * vec3(fbm(q * 2.5), fbm(q * 2.5 + 9.0), 0.0);
      float band = fbm(vec3(w.y * 6.5, w.x * 0.6, w.z * 0.6));
      float fine = fbm(w * 10.0) * 0.18;
      float t = band + fine;
      vec3 cream = vec3(0.9, 0.84, 0.72);
      vec3 tan = vec3(0.72, 0.55, 0.38);
      vec3 rust = vec3(0.5, 0.3, 0.2);
      vec3 grey = vec3(0.6, 0.6, 0.62);
      albedo = mix(cream, tan, smoothstep(-0.25, 0.15, t));
      albedo = mix(albedo, rust, smoothstep(0.2, 0.45, t));
      albedo = mix(albedo, grey, smoothstep(-0.55, -0.35, t) * (1.0 - smoothstep(-0.35, -0.2, t)));
      float storm = smoothstep(0.34, 0.12, length((q.xy - vec2(0.5, -0.28)) * vec2(1.0, 2.2)));
      albedo = mix(albedo, vec3(0.8, 0.4, 0.28), storm * 0.85);
      /* Gás não tem relevo. */
      height = 0.0;
      relief = 0.0;
    } else if (uKind < 3.5) {
      /* Rochoso: basalto escuro nas baixadas, poeira ferrugem em cima,
         crateras com borda erguida, calotas pequenas. */
      float base = fbm3(q * 3.0);
      float e = base + 0.22 * fbm3(q * 6.0);
      float craterField = snoise(q * 6.0);
      float crater = smoothstep(0.52, 0.62, craterField);
      float rim = smoothstep(0.45, 0.52, craterField) * (1.0 - crater);
      vec3 basalt = vec3(0.28, 0.16, 0.12);
      vec3 dust = vec3(0.82, 0.5, 0.33);
      vec3 bright = vec3(0.92, 0.7, 0.54);
      albedo = mix(basalt, dust, smoothstep(-0.45, 0.2, e));
      albedo = mix(albedo, bright, rim * 0.6);
      albedo = mix(albedo, basalt * 0.8, crater);
      float polar = smoothstep(0.86, 0.95, abs(q.y));
      albedo = mix(albedo, vec3(0.9, 0.9, 0.92), polar);
      height = max(base, -0.2) * 0.6 - crater * 0.3;
      relief = 0.7;
    } else {
      /* Lua de gelo: casca clara com fendas finas avermelhadas. */
      float e = fbm3(q * 3.0);
      float crackA = smoothstep(0.05, 0.0, abs(snoise(q * 6.0)));
      float crackB = smoothstep(0.03, 0.0, abs(snoise(q * 11.0 + 3.0))) * 0.6;
      float cracks = max(crackA, crackB);
      vec3 shell = mix(vec3(0.74, 0.82, 0.92), vec3(0.94, 0.96, 1.0), smoothstep(-0.3, 0.4, e));
      albedo = mix(shell, vec3(0.55, 0.32, 0.26), cracks * 0.75);
      height = e * 0.2;
      relief = 0.6;
      water = 0.35;
    }

    vec3 geomN = normalize(vNormalV);
    vec3 n = perturb(vViewPos, geomN, height, relief * uDetail);
    vec3 v = normalize(-vViewPos);
    float facing = dot(n, uLight);
    float day = smoothstep(-0.18, 0.4, facing);
    float dayGeom = smoothstep(-0.18, 0.4, dot(geomN, uLight));
    vec3 color = albedo * (0.05 + 0.95 * day);

    /* Especular só na água e no gelo. */
    float spec = pow(max(dot(reflect(-uLight, n), v), 0.0), 60.0) * water * 0.5 * dayGeom;
    color += spec;

    /* Escurecimento nas bordas: uma esfera de verdade não é chapada. */
    float limb = mix(0.45, 1.0, pow(max(dot(geomN, v), 0.0), 0.55));
    color *= limb;

    /* Terminador quente: a luz rasante esquenta a linha entre dia e noite. */
    float twilight = smoothstep(0.25, 0.0, abs(dot(geomN, uLight))) * dayGeom;
    color += vec3(0.9, 0.45, 0.2) * twilight * 0.12;

    if (uKind > 0.5 && uKind < 1.5) {
      float cities = smoothstep(0.5, 0.8, snoise(q * 26.0)) * smoothstep(0.55, 0.75, snoise(q * 4.0 + 2.0)) * land;
      color += vec3(1.0, 0.78, 0.45) * cities * (1.0 - dayGeom) * 1.1;
    }

    float heat = sin(clamp(uBreak, 0.0, 1.0) * 3.14159);
    color = mix(color, vec3(1.0, 0.55, 0.2), heat * 0.7);
    color += vec3(1.0, 0.8, 0.5) * heat * 0.6;
    float alpha = uOpacity * (1.0 - smoothstep(0.2, 0.75, uBreak));
    gl_FragColor = vec4(color, alpha);
  }
`

const CLOUDS_VERTEX = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vObj;
  varying vec3 vView;
  void main() {
    vObj = position;
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const CLOUDS_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uBreak;
  uniform vec3 uLight;
  varying vec3 vNormalV;
  varying vec3 vObj;
  varying vec3 vView;
  ${SIMPLEX_NOISE}
  void main() {
    vec3 q = vObj / ${CLOUDS.toFixed(3)};
    float c = fbm(q * 2.8 + vec3(uTime * 0.01, 0.0, 0.0)) + 0.15 * fbm3(q * 5.5);
    float cover = smoothstep(0.08, 0.5, c);
    vec3 n = normalize(vNormalV);
    float day = smoothstep(-0.2, 0.35, dot(n, uLight));
    float limb = mix(0.6, 1.0, pow(max(dot(n, normalize(vView)), 0.0), 0.5));
    vec3 color = vec3(1.0, 0.99, 0.98) * (0.12 + 0.88 * day) * limb;
    float alpha = cover * 0.9 * uOpacity * (1.0 - uBreak);
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
  uniform vec3 uColor;
  uniform vec3 uLight;
  varying vec3 vNormalV;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(vView);
    float rim = pow(1.0 - abs(dot(n, v)), 3.2) * uRim;
    float day = 0.25 + 0.75 * smoothstep(-0.45, 0.45, dot(n, uLight));
    float heat = sin(clamp(uBreak, 0.0, 1.0) * 3.14159);
    vec3 color = mix(uColor, vec3(1.0, 0.75, 0.45), heat);
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
  uniform vec3 uLightLocal;
  varying vec2 vPos;
  varying vec3 vNormalV;
  ${SIMPLEX_NOISE}
  void main() {
    float r = length(vPos);
    float t = (r - ${(RADIUS * 1.45).toFixed(3)}) / ${(RADIUS * 0.9).toFixed(3)};
    /* Faixas finas com ruído, uma divisão limpa e uma segunda mais fraca. */
    float bands = 0.5 + 0.5 * sin(t * 70.0 + snoise(vec3(t * 9.0, 0.0, 0.0)) * 4.0);
    float coarse = 0.5 + 0.5 * sin(t * 14.0 + 1.0);
    float gapA = smoothstep(0.6, 0.63, t) * smoothstep(0.7, 0.67, t);
    float gapB = smoothstep(0.34, 0.355, t) * smoothstep(0.39, 0.375, t);
    float alpha = smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.88, t) * (0.25 + 0.4 * bands + 0.2 * coarse);
    alpha *= 1.0 - gapA * 0.9 - gapB * 0.5;
    /* Sombra do planeta: pontos atrás dele em relação à luz, dentro do
       cilindro de sombra, escurecem. */
    vec3 p = vec3(vPos, 0.0);
    float along = dot(p, uLightLocal);
    float off = length(p - uLightLocal * along);
    float shadow = smoothstep(${(RADIUS * 1.02).toFixed(3)}, ${(RADIUS * 0.94).toFixed(3)}, off) * step(along, 0.0);
    float lit = 0.4 + 0.6 * abs(dot(normalize(vNormalV), uLight));
    vec3 color = mix(vec3(0.78, 0.7, 0.58), vec3(0.96, 0.92, 0.84), bands) * lit * (1.0 - shadow * 0.85);
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

export function createPlanet({
  segments,
  kind = 'target',
  spin = 0.04,
  ring = false,
  detail = 1,
}: {
  segments: number
  kind?: PlanetKind
  /** Rotação em rad/s. A Terra, enorme, gira bem mais devagar. */
  spin?: number
  /** Anel inclinado, para o gigante gasoso. */
  ring?: boolean
  /** Força do relevo; 0 desliga. */
  detail?: number
}) {
  const object = new THREE.Group()
  const kindIndex = KIND_INDEX[kind]
  /* Luz fixa em espaço de câmera: o terminador fica parado enquanto a
     superfície gira. */
  const light = new THREE.Vector3(-0.55, 0.42, 0.72).normalize()

  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []

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
      uDetail: { value: detail },
      uLight: { value: light },
    },
  })
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial)
  /* Desenha antes dos triângulos: com a profundidade gravada, a metade de
     trás da casca some atrás do planeta e só a crosta da frente fica. */
  surface.renderOrder = -3
  object.add(surface)
  geometries.push(surfaceGeometry)
  materials.push(surfaceMaterial)

  let clouds: THREE.Mesh | null = null
  let cloudsMaterial: THREE.ShaderMaterial | null = null
  if (KIND_CLOUDS[kind]) {
    const cloudsGeometry = new THREE.SphereGeometry(CLOUDS, segments, Math.round(segments * 0.62))
    cloudsMaterial = new THREE.ShaderMaterial({
      vertexShader: CLOUDS_VERTEX,
      fragmentShader: CLOUDS_FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uBreak: { value: 0 },
        uLight: { value: light },
      },
    })
    clouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial)
    clouds.renderOrder = -2
    object.add(clouds)
    geometries.push(cloudsGeometry)
    materials.push(cloudsMaterial)
  }

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
      uColor: { value: new THREE.Color(KIND_ATMOSPHERE[kind]) },
      uLight: { value: light },
    },
  })
  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
  atmosphere.renderOrder = -1
  object.add(atmosphere)
  geometries.push(atmosphereGeometry)
  materials.push(atmosphereMaterial)

  let ringMesh: THREE.Mesh | null = null
  let ringMaterial: THREE.ShaderMaterial | null = null
  const lightLocal = new THREE.Vector3()
  const ringQuaternion = new THREE.Quaternion()
  if (ring) {
    const ringGeometry = new THREE.RingGeometry(RADIUS * 1.45, RADIUS * 2.35, 128, 3)
    ringMaterial = new THREE.ShaderMaterial({
      vertexShader: RING_VERTEX,
      fragmentShader: RING_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uOpacity: { value: 1 },
        uLight: { value: light },
        uLightLocal: { value: lightLocal },
      },
    })
    ringMesh = new THREE.Mesh(ringGeometry, ringMaterial)
    ringMesh.rotation.x = 1.3
    ringMesh.rotation.y = 0.35
    ringMesh.renderOrder = -1
    object.add(ringMesh)
    geometries.push(ringGeometry)
    materials.push(ringMaterial)
  }

  return {
    object,
    update(state: PlanetState, time: number) {
      object.visible = state.opacity > 0.015 && state.break < 0.999
      if (!object.visible) return
      object.position.set(state.x, state.y, state.z ?? 0)
      object.scale.setScalar(state.scale)
      surface.rotation.y = time * spin
      if (clouds) clouds.rotation.y = time * spin * 1.35
      const heat = Math.sin(Math.min(Math.max(state.break, 0), 1) * Math.PI)
      atmosphere.scale.setScalar(1 + heat * 0.5)
      surfaceMaterial.uniforms.uTime.value = time
      surfaceMaterial.uniforms.uBreak.value = state.break
      surfaceMaterial.uniforms.uOpacity.value = state.opacity
      if (cloudsMaterial) {
        cloudsMaterial.uniforms.uTime.value = time
        cloudsMaterial.uniforms.uBreak.value = state.break
        cloudsMaterial.uniforms.uOpacity.value = state.opacity
      }
      atmosphereMaterial.uniforms.uBreak.value = state.break
      atmosphereMaterial.uniforms.uOpacity.value = state.opacity
      if (ringMesh && ringMaterial) {
        ringMaterial.uniforms.uOpacity.value = state.opacity
        /* A luz em espaço do anel, para a sombra do planeta cair certo. */
        ringMesh.getWorldQuaternion(ringQuaternion).invert()
        lightLocal.copy(light).applyQuaternion(ringQuaternion)
      }
    },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
    },
  }
}
