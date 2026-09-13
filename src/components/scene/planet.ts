import * as THREE from 'three'

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
  scale: number
  opacity: number
  break: number
}

/* Raio casado com a casca do corpo dos triângulos (0,6 a 0,66). */
const RADIUS = 0.62
const ATMOSPHERE = 0.72

/* Ruído simplex 3D (Ashima Arts, MIT), o de sempre. */
const NOISE = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
  float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i += 1) {
      sum += amp * snoise(p);
      p = p * 2.03 + 11.0;
      amp *= 0.5;
    }
    return sum;
  }
`

const SURFACE_VERTEX = /* glsl */ `
  uniform float uBreak;
  varying vec3 vNormalV;
  varying vec3 vObj;
  varying vec3 vView;
  ${NOISE}
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
  uniform vec3 uLight;
  varying vec3 vNormalV;
  varying vec3 vObj;
  varying vec3 vView;
  ${NOISE}
  void main() {
    /* Superfície em espaço do objeto: gira junto com a malha. */
    vec3 q = vObj / ${RADIUS.toFixed(2)};
    float e = fbm(q * 2.6);
    float land = smoothstep(0.02, 0.12, e);
    vec3 ocean = mix(vec3(0.05, 0.12, 0.34), vec3(0.11, 0.27, 0.64), smoothstep(-0.3, 0.0, e));
    vec3 ice = mix(vec3(0.62, 0.72, 0.92), vec3(0.86, 0.9, 0.96), smoothstep(0.1, 0.35, e));
    vec3 albedo = mix(ocean, ice, land);
    float polar = smoothstep(0.62, 0.82, abs(q.y));
    albedo = mix(albedo, vec3(0.94, 0.96, 0.99), polar * 0.85);
    float c = fbm(q * 3.4 + vec3(uTime * 0.015, 0.0, uTime * 0.01));
    float clouds = smoothstep(0.16, 0.42, c);
    /* Nuvens contidas: o texto do Manifesto passa por cima do planeta. */
    albedo = mix(albedo, vec3(0.9, 0.93, 0.98), clouds * 0.5);

    vec3 n = normalize(vNormalV);
    vec3 v = normalize(vView);
    float facing = dot(n, uLight);
    /* Terminador macio, noite com um resto de luz. */
    float day = smoothstep(-0.22, 0.38, facing);
    vec3 color = albedo * (0.07 + 0.93 * day);
    float spec = pow(max(dot(reflect(-uLight, n), v), 0.0), 40.0) * (1.0 - land) * 0.35 * day;
    color += spec;
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    color += vec3(0.35, 0.55, 1.0) * fresnel * (0.3 + 0.7 * day);

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
  uniform vec3 uLight;
  varying vec3 vNormalV;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(vView);
    /* Lado de trás da esfera maior: só a borda passa por fora do planeta,
       que tapa o miolo pela profundidade. */
    float rim = pow(1.0 - abs(dot(n, v)), 3.0);
    float day = 0.35 + 0.65 * smoothstep(-0.4, 0.5, dot(n, uLight));
    float heat = sin(clamp(uBreak, 0.0, 1.0) * 3.14159);
    vec3 color = mix(vec3(0.4, 0.62, 1.0), vec3(1.0, 0.75, 0.45), heat);
    float alpha = rim * day * uOpacity * (1.0 - uBreak) + rim * heat * heat * 2.0 * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`

export function createPlanet({ segments }: { segments: number }) {
  const object = new THREE.Group()
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
      uLight: { value: light },
    },
  })
  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
  atmosphere.renderOrder = -1
  object.add(atmosphere)

  return {
    object,
    update(state: PlanetState, time: number) {
      object.visible = state.opacity > 0.015 && state.break < 0.999
      if (!object.visible) return
      object.position.set(state.x, state.y, 0)
      object.scale.setScalar(state.scale)
      surface.rotation.y = time * 0.04
      const heat = Math.sin(Math.min(Math.max(state.break, 0), 1) * Math.PI)
      atmosphere.scale.setScalar(1 + heat * 0.5)
      surfaceMaterial.uniforms.uTime.value = time
      surfaceMaterial.uniforms.uBreak.value = state.break
      surfaceMaterial.uniforms.uOpacity.value = state.opacity
      atmosphereMaterial.uniforms.uBreak.value = state.break
      atmosphereMaterial.uniforms.uOpacity.value = state.opacity
    },
    dispose() {
      surfaceGeometry.dispose()
      surfaceMaterial.dispose()
      atmosphereGeometry.dispose()
      atmosphereMaterial.dispose()
    },
  }
}
