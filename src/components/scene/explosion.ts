import * as THREE from 'three'
import { SIMPLEX_NOISE } from './glsl'
import { RING_NORMAL } from './triangles'
import { SUN_BURST, SUN_RADIUS } from './sun'

/**
 * A supernova do alvo. O Sol em si desestabiliza e se desfaz no sun.ts;
 * aqui entra o que sai dele, em seis camadas, todas tocadas pelo mesmo
 * relógio `break` (0 inteiro, 1 já foi) que a estrela usa:
 *
 *   1. clarão do núcleo, na frente, sobe num instante e apaga devagar, mais
 *      um halo largo por trás que fica como a luz ambiente dos destroços;
 *   2. onda de choque: uma casca esférica vista de frente (anel de borda
 *      ruidosa) e um anel plano inclinado no mesmo plano dos anéis de
 *      triângulos, os dois crescendo até uns 4 raios e sumindo;
 *   3. ejeta: grumos de plasma de poucas faces numa geometria só, cada um
 *      com centro, velocidade, eixo e giro gravados em atributo — o voo
 *      inteiro é no vertex shader, sem CPU por frame. Saem brancos e
 *      esfriam a laranja, vermelho e escória escura;
 *   4. brasas: pontos aditivos com arrasto, esfriando de branco a vermelho;
 *   5. poeira: quadrados sempre de frente para a câmera, com textura macia,
 *      que se expandem devagar, acesos pelo núcleo no começo e escuros no
 *      fim;
 *   6. o remanescente: um disco aditivo de gás ruidoso que se abre com o
 *      tempo e fica, vermelho no meio e azulado na borda, apagando só com
 *      a opacidade do estado (a nebulosa que uma supernova deixa).
 *
 * Tudo é função de `break`, então rolar para trás desfaz a explosão sem
 * costura; o tempo entra só no tremor e na cintilação.
 */
export type ExplosionState = {
  x: number
  y: number
  scale: number
  opacity: number
  break: number
  /** Pixels por unidade de mundo no plano z = 0: dimensiona pontos e poeira. */
  pixelsPerUnit: number
}

const R = SUN_RADIUS

/* Rotação de Rodrigues, a mesma dos triângulos. */
const ROTATE = /* glsl */ `
  vec3 rotateAxis(vec3 p, vec3 axis, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
  }
`

const BILLBOARD_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/* Clarão: núcleo branco apertado, coroa quente e raios finos que giram
   devagar. Aditivo, com o rgb acima de 1 no miolo para o bloom pegar. */
const FLASH_FRAGMENT = /* glsl */ `
  uniform float uStrength;
  uniform float uTime;
  uniform float uRays;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float a = atan(p.y, p.x);
    float fall = max(0.0, 1.0 - d);
    float core = pow(fall, 7.0) * 1.8 + exp(-d * 4.5) * 0.7 + pow(fall, 2.2) * 0.3;
    float rays = pow(0.5 + 0.5 * sin(a * 11.0 + uTime * 0.4), 9.0)
      + pow(0.5 + 0.5 * sin(a * 7.0 - 1.7 - uTime * 0.3), 14.0) * 0.8;
    rays *= pow(fall, 1.3) * uRays;
    vec3 color = mix(vec3(1.0), uColor, smoothstep(0.0, 0.5, d));
    gl_FragColor = vec4(color * (core + rays) * uStrength, 1.0);
  }
`

/* Onda de choque: uma faixa fina no raio uRadius (fração do disco), com a
   borda torcida por ruído e uma cauda fraca para dentro, o gás que a frente
   deixou. */
const SHOCK_FRAGMENT = /* glsl */ `
  uniform float uRadius;
  uniform float uWidth;
  uniform float uAlpha;
  uniform float uNoise;
  uniform float uPhase;
  uniform vec3 uColor;
  varying vec2 vUv;
  ${SIMPLEX_NOISE}
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float nz = snoise(vec3(cos(a) * 2.5, sin(a) * 2.5, uPhase * 3.0)) * uNoise;
    float rr = uRadius + nz;
    float x = (r - rr) / uWidth;
    float band = exp(-x * x * 2.0);
    float tail = exp(-max(rr - r, 0.0) * 7.0) * step(r, rr) * 0.3;
    gl_FragColor = vec4(uColor * (band + tail) * uAlpha, 1.0);
  }
`

const SHARD_VERTEX = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aVel;
  attribute vec3 aAxis;
  attribute vec3 aRadial;
  attribute float aSpin;
  attribute float aSeed;
  uniform float uU;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vHot;
  varying float vSeed;
  ${ROTATE}
  void main() {
    /* Arrasto: sai rápido e vai parando. Encolhe um pouco no fim, como se
       queimasse. */
    float travel = (1.0 - exp(-2.8 * uU)) / 2.8;
    float angle = aSpin * uU * 7.0 + aSeed * 6.2831;
    vec3 local = rotateAxis(position * (1.0 - 0.3 * uU * uU), aAxis, angle);
    vec3 n = rotateAxis(normal, aAxis, angle);
    vec3 p = aCenter + aVel * travel + local;
    /* Plasma: quase tudo incandescente; as faces que olhavam para fora
       esfriam um pouco antes e viram escória. */
    vHot = 0.6 + 0.4 * smoothstep(0.4, -0.3, dot(normal, aRadial));
    vSeed = aSeed;
    vNormalV = normalize(normalMatrix * n);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const SHARD_FRAGMENT = /* glsl */ `
  uniform float uU;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uLight;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vHot;
  varying float vSeed;
  void main() {
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(-vViewPos);
    /* Um pouco de forma: a face virada para a luz brilha mais, sem
       nunca ter lado escuro — plasma não tem sombra. */
    float diffuse = 0.7 + 0.3 * max(dot(n, uLight), 0.0);
    /* Esfria: branco na saída, amarelo, laranja, vermelho escuro, escória. */
    float heat = pow(max(1.0 - uU, 0.0), 1.3) * (0.85 + 0.15 * sin(uTime * 9.0 + vSeed * 40.0));
    vec3 lava = mix(vec3(0.55, 0.06, 0.01), vec3(1.0, 0.72, 0.35), heat);
    lava = mix(lava, vec3(1.0, 0.97, 0.9), smoothstep(0.7, 1.0, heat));
    vec3 color = lava * (0.15 + 1.4 * heat) * diffuse * (0.6 + 0.4 * vHot);
    /* Borda mais macia: aditivo, a aresta vira brilho, não faceta. */
    float rim = pow(1.0 - max(dot(n, v), 0.0), 2.0);
    color += lava * heat * rim * 0.4;
    float alpha = uOpacity * (1.0 - smoothstep(0.55, 0.9, uU));
    gl_FragColor = vec4(color * alpha, 1.0);
  }
`

const EMBER_VERTEX = /* glsl */ `
  attribute vec3 aDir;
  attribute float aSpeed;
  attribute float aSeed;
  attribute float aSize;
  uniform float uU;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uPixels;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float travel = (1.0 - exp(-3.6 * uU)) / 3.6;
    /* Cada brasa desvia um pouco do rumo com o tempo: fumaça no vento. */
    vec3 curl = aDir.yzx * sin(uU * 5.0 + aSeed * 6.2831) * 0.08 * uU;
    vec3 p = aDir * aSpeed * travel + curl;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float scale = length(modelViewMatrix[0].xyz);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (1.0 - 0.55 * uU) * uPixelRatio * uPixels * scale * (3.3 / max(-mv.z, 0.2));
    float twinkle = 0.65 + 0.35 * sin(uTime * 13.0 + aSeed * 31.0);
    vAlpha = smoothstep(0.0, 0.04, uU) * pow(max(1.0 - uU, 0.0), 1.7) * twinkle;
    float fresh = pow(max(1.0 - uU, 0.0), 2.0);
    vColor = mix(vec3(1.0, 0.42, 0.1), vec3(1.0, 0.92, 0.72), fresh);
    vColor = mix(vec3(0.55, 0.07, 0.0), vColor, pow(max(1.0 - uU, 0.0), 0.5));
  }
`

const EMBER_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float soft = smoothstep(1.0, 0.15, d);
    float core = smoothstep(0.45, 0.0, d);
    gl_FragColor = vec4(vColor * (soft + core * 1.3) * vAlpha * uOpacity, 1.0);
  }
`

/* Poeira: quadrados de frente para a câmera, cada um girando devagar no
   próprio plano, crescendo e se afastando com o relógio. */
const SMOKE_VERTEX = /* glsl */ `
  attribute vec3 aCenter;
  attribute float aSeed;
  attribute float aSize;
  uniform float uU;
  uniform float uTime;
  varying vec2 vUv;
  varying float vLit;
  varying float vSeed;
  void main() {
    vUv = uv;
    vSeed = aSeed;
    float ease = 1.0 - pow(1.0 - uU, 2.0);
    vec3 c = aCenter * (0.35 + 1.25 * ease);
    c.xy += vec2(sin(uTime * 0.3 + aSeed * 6.2831), cos(uTime * 0.26 + aSeed * 9.4)) * 0.03;
    float size = aSize * (0.55 + 1.5 * ease);
    float angle = aSeed * 6.2831 + uTime * 0.06 * (aSeed - 0.5);
    float cs = cos(angle);
    float sn = sin(angle);
    vec2 corner = vec2(position.x * cs - position.y * sn, position.x * sn + position.y * cs) * size;
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    float scale = length(modelViewMatrix[0].xyz);
    mv.xy += corner * scale;
    /* Quem está perto do centro recebe a luz do núcleo. */
    vLit = 1.0 - smoothstep(0.3, 1.4, length(aCenter) * (0.35 + 1.25 * ease));
    gl_Position = projectionMatrix * mv;
  }
`

const SMOKE_FRAGMENT = /* glsl */ `
  uniform float uU;
  uniform float uOpacity;
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying float vLit;
  varying float vSeed;
  void main() {
    float shape = texture2D(uMap, vUv).a;
    float glow = pow(max(1.0 - uU, 0.0), 1.6) * vLit;
    /* Esfria do laranja aceso ao vermelho fundo do gás de supernova, com
       um azul fraco na periferia: não vira fumaça cinza de bomba. */
    vec3 dark = mix(vec3(0.22, 0.06, 0.08), vec3(0.1, 0.09, 0.2), 1.0 - vLit);
    vec3 lit = vec3(0.9, 0.42, 0.16);
    vec3 color = mix(dark, lit, glow);
    float alpha = shape * 0.3 * smoothstep(0.0, 0.14, uU) * (0.45 + 0.55 * pow(max(1.0 - uU, 0.0), 0.6)) * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`

/* Remanescente: gás ruidoso num disco, aberto pelo relógio e deixado para
   trás. Dois fbm em coordenadas polares distorcidas: filamentos radiais
   (o que uma supernova deixa) por cima de nuvens largas. */
const NEBULA_FRAGMENT = /* glsl */ `
  uniform float uU;
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  ${SIMPLEX_NOISE}
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float a = atan(p.y, p.x);
    float open = 0.25 + 0.75 * (1.0 - pow(1.0 - uU, 2.2));
    float r = d / open;
    vec2 ring = vec2(cos(a), sin(a));
    float clouds = fbm3(vec3(p * 2.4 / open, uTime * 0.03 + uU * 2.0));
    /* Filamentos torcidos pelas nuvens, não raios retos de flare. */
    float filaments = snoise(vec3(p * 4.5 / open + clouds * 1.5, r * 2.0 - uTime * 0.02));
    filaments = pow(1.0 - abs(filaments), 3.0);
    /* Casca: mais denso na borda que no miolo, como um remanescente. */
    float shell = smoothstep(1.0, 0.6, r) * (0.45 + 0.55 * smoothstep(0.1, 0.55, r));
    float soft = fbm3(vec3(p * 1.1 / open + 5.0, uTime * 0.02));
    float body = shell * (0.35 + 0.5 * (clouds * 0.5 + 0.5) + 0.45 * (soft * 0.5 + 0.5) + 0.3 * filaments);
    float hot = pow(max(1.0 - uU, 0.0), 1.5);
    vec3 fresh = vec3(1.0, 0.55, 0.22);
    vec3 cool = mix(vec3(0.85, 0.16, 0.12), vec3(0.3, 0.32, 0.75), smoothstep(0.35, 0.95, r));
    vec3 color = mix(cool, fresh, hot) * (0.75 + 0.5 * hot);
    /* O que sobrou no meio: um caroço azulado, pequeno e frio. */
    float core = exp(-r * r * 40.0) * (0.25 + 0.5 * hot);
    color += vec3(0.75, 0.85, 1.0) * core;
    float alpha = body * smoothstep(0.05, 0.45, uU) * uOpacity;
    gl_FragColor = vec4(color * alpha, 1.0);
  }
`

const ICO_T = (1 + Math.sqrt(5)) / 2
const ICO_VERTICES = [
  [-1, ICO_T, 0], [1, ICO_T, 0], [-1, -ICO_T, 0], [1, -ICO_T, 0],
  [0, -1, ICO_T], [0, 1, ICO_T], [0, -1, -ICO_T], [0, 1, -ICO_T],
  [ICO_T, 0, -1], [ICO_T, 0, 1], [-ICO_T, 0, -1], [-ICO_T, 0, 1],
]
const ICO_FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
]

/** Direção uniforme na esfera. */
function randomDirection(target: THREE.Vector3) {
  const inclination = Math.acos(1 - 2 * Math.random())
  const azimuth = Math.random() * Math.PI * 2
  return target.set(
    Math.sin(inclination) * Math.cos(azimuth),
    Math.cos(inclination),
    Math.sin(inclination) * Math.sin(azimuth),
  )
}

/**
 * Os cacos numa geometria só: cada um é um icosaedro amassado (vértices
 * puxados ao acaso e escala diferente por eixo), com normais planas, e os
 * dados do voo repetidos em cada vértice.
 */
function buildShards(count: number) {
  const perShard = ICO_FACES.length * 3
  const total = count * perShard
  const positions = new Float32Array(total * 3)
  const normals = new Float32Array(total * 3)
  const centers = new Float32Array(total * 3)
  const velocities = new Float32Array(total * 3)
  const axes = new Float32Array(total * 3)
  const radials = new Float32Array(total * 3)
  const spins = new Float32Array(total)
  const seeds = new Float32Array(total)

  const radial = new THREE.Vector3()
  const vel = new THREE.Vector3()
  const axis = new THREE.Vector3()
  const jitter = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const n = new THREE.Vector3()
  const base: THREE.Vector3[] = []

  for (let i = 0; i < count; i += 1) {
    randomDirection(radial)
    /* Quase todos pequenos, alguns médios, raros grandes. */
    const roll = Math.random()
    /* Menores que a primeira versão: pedaço grande e chapado lia como
       pedra de isopor; muitos pequenos leem como plasma espirrando. */
    const size = R * (roll < 0.7 ? 0.014 + Math.random() * 0.02 : roll < 0.95 ? 0.034 + Math.random() * 0.028 : 0.062 + Math.random() * 0.03)
    const sx = 0.55 + Math.random() * 0.75
    const sy = 0.55 + Math.random() * 0.75
    const sz = 0.55 + Math.random() * 0.75
    quaternion.setFromAxisAngle(randomDirection(axis), Math.random() * Math.PI * 2)
    base.length = 0
    for (const [x, y, z] of ICO_VERTICES) {
      const v = new THREE.Vector3(x, y, z).normalize()
      v.multiplyScalar(1 + (Math.random() - 0.5) * 0.5)
      v.x *= sx
      v.y *= sy
      v.z *= sz
      v.applyQuaternion(quaternion).multiplyScalar(size)
      base.push(v)
    }
    /* Sai da casca para fora, com desvio, e os grandes mais devagar. */
    randomDirection(jitter)
    vel.copy(radial).addScaledVector(jitter, 0.4).normalize()
    vel.multiplyScalar(R * (4.5 + Math.random() * 5.5) * (1.25 - size / (R * 0.15)))
    randomDirection(axis)
    const spin = (Math.random() - 0.5) * 2 * (0.6 + Math.random())
    const seed = Math.random()

    for (let f = 0; f < ICO_FACES.length; f += 1) {
      const [ia, ib, ic] = ICO_FACES[f]
      a.copy(base[ia])
      b.copy(base[ib])
      c.copy(base[ic])
      n.subVectors(b, a).cross(c.clone().sub(a)).normalize()
      const corners = [a, b, c]
      for (let k = 0; k < 3; k += 1) {
        const v = corners[k]
        const index = i * perShard + f * 3 + k
        const o = index * 3
        positions[o] = v.x
        positions[o + 1] = v.y
        positions[o + 2] = v.z
        normals[o] = n.x
        normals[o + 1] = n.y
        normals[o + 2] = n.z
        centers[o] = radial.x * R * 0.82
        centers[o + 1] = radial.y * R * 0.82
        centers[o + 2] = radial.z * R * 0.82
        velocities[o] = vel.x
        velocities[o + 1] = vel.y
        velocities[o + 2] = vel.z
        axes[o] = axis.x
        axes[o + 1] = axis.y
        axes[o + 2] = axis.z
        radials[o] = radial.x
        radials[o + 1] = radial.y
        radials[o + 2] = radial.z
        spins[index] = spin
        seeds[index] = seed
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('aCenter', new THREE.BufferAttribute(centers, 3))
  geometry.setAttribute('aVel', new THREE.BufferAttribute(velocities, 3))
  geometry.setAttribute('aAxis', new THREE.BufferAttribute(axes, 3))
  geometry.setAttribute('aRadial', new THREE.BufferAttribute(radials, 3))
  geometry.setAttribute('aSpin', new THREE.BufferAttribute(spins, 1))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  return geometry
}

function buildEmbers(count: number) {
  const dirs = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  const seeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  const dir = new THREE.Vector3()
  for (let i = 0; i < count; i += 1) {
    randomDirection(dir)
    dirs[i * 3] = dir.x
    dirs[i * 3 + 1] = dir.y
    dirs[i * 3 + 2] = dir.z
    /* Distribuição longa: um punhado voa bem mais longe que a maioria. */
    speeds[i] = R * (2.5 + 7.0 * Math.pow(Math.random(), 1.6))
    seeds[i] = Math.random()
    sizes[i] = 0.008 + Math.random() * Math.random() * 0.028
  }
  const geometry = new THREE.BufferGeometry()
  /* Points exige `position`; o shader calcula a de verdade. */
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3))
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 12)
  return geometry
}

function buildSmoke(count: number) {
  const positions = new Float32Array(count * 4 * 3)
  const uvs = new Float32Array(count * 4 * 2)
  const centers = new Float32Array(count * 4 * 3)
  const seeds = new Float32Array(count * 4)
  const sizes = new Float32Array(count * 4)
  const indices: number[] = []
  const dir = new THREE.Vector3()
  const corners = [
    [-1, -1, 0, 0],
    [1, -1, 1, 0],
    [1, 1, 1, 1],
    [-1, 1, 0, 1],
  ]
  for (let i = 0; i < count; i += 1) {
    randomDirection(dir)
    /* Mais no plano da tela: nuvem lida de frente. */
    dir.z *= 0.45
    dir.multiplyScalar(R * (0.5 + Math.random() * 0.8))
    const seed = Math.random()
    const size = R * (0.45 + Math.random() * 0.5)
    for (let k = 0; k < 4; k += 1) {
      const index = i * 4 + k
      positions[index * 3] = corners[k][0]
      positions[index * 3 + 1] = corners[k][1]
      positions[index * 3 + 2] = 0
      uvs[index * 2] = corners[k][2]
      uvs[index * 2 + 1] = corners[k][3]
      centers[index * 3] = dir.x
      centers[index * 3 + 1] = dir.y
      centers[index * 3 + 2] = dir.z
      seeds[index] = seed
      sizes[index] = size
    }
    const o = i * 4
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setAttribute('aCenter', new THREE.BufferAttribute(centers, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 8)
  return geometry
}

/** Textura de poeira: um borrão macio com manchas, feito uma vez no canvas. */
function makeSmokeTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, size, size)
    for (let i = 0; i < 26; i += 1) {
      const r = 10 + Math.random() * 26
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * 34
      const x = size / 2 + Math.cos(angle) * dist
      const y = size / 2 + Math.sin(angle) * dist
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(255,255,255,0.16)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
    }
    /* Máscara radial: as bordas do quadrado somem. */
    ctx.globalCompositeOperation = 'destination-in'
    const mask = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    mask.addColorStop(0, 'rgba(255,255,255,1)')
    mask.addColorStop(0.55, 'rgba(255,255,255,0.7)')
    mask.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = mask
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  return texture
}

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

export function createExplosion({
  lightweight,
  weakDevice,
  pixelRatio,
}: {
  lightweight: boolean
  weakDevice: boolean
  pixelRatio: number
}) {
  const light = lightweight || weakDevice
  const object = new THREE.Group()
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const textures: THREE.Texture[] = []
  /* Mesma direção de luz dos planetas, em espaço de câmera. */
  const lightDir = new THREE.Vector3(-0.72, 0.38, 0.58).normalize()

  const disc = new THREE.CircleGeometry(1, 56)
  geometries.push(disc)

  /* 1. Clarão na frente e halo atrás. */
  const flashMaterial = new THREE.ShaderMaterial({
    vertexShader: BILLBOARD_VERTEX,
    fragmentShader: FLASH_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uStrength: { value: 0 },
      uTime: { value: 0 },
      uRays: { value: 1 },
      uColor: { value: new THREE.Color(1.0, 0.62, 0.3) },
    },
  })
  const flash = new THREE.Mesh(disc, flashMaterial)
  flash.position.z = R * 1.2
  flash.renderOrder = 6
  object.add(flash)
  materials.push(flashMaterial)

  const haloMaterial = flashMaterial.clone()
  haloMaterial.uniforms.uRays.value = 0.1
  haloMaterial.uniforms.uColor.value = new THREE.Color(1.0, 0.45, 0.16)
  const halo = new THREE.Mesh(disc, haloMaterial)
  halo.position.z = -R * 0.5
  halo.renderOrder = 3
  object.add(halo)
  materials.push(haloMaterial)

  /* 2. Onda de choque: casca de frente e anel plano inclinado. */
  const makeShock = (color: THREE.Color, noise: number) =>
    new THREE.ShaderMaterial({
      vertexShader: BILLBOARD_VERTEX,
      fragmentShader: SHOCK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uRadius: { value: 0 },
        uWidth: { value: 0.03 },
        uAlpha: { value: 0 },
        uNoise: { value: noise },
        uPhase: { value: 0 },
        uColor: { value: color },
      },
    })
  const SHELL_EXTENT = 4.6
  const shellMaterial = makeShock(new THREE.Color(1.0, 0.78, 0.55), 0.035)
  const shell = new THREE.Mesh(disc, shellMaterial)
  shell.scale.setScalar(R * SHELL_EXTENT)
  shell.position.z = R * 1.1
  shell.renderOrder = 4
  object.add(shell)
  materials.push(shellMaterial)

  const PLANE_EXTENT = 5.6
  const planeMaterial = makeShock(new THREE.Color(0.62, 0.78, 1.0), 0.012)
  const plane = new THREE.Mesh(disc, planeMaterial)
  plane.scale.setScalar(R * PLANE_EXTENT)
  plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), RING_NORMAL)
  plane.renderOrder = 4
  object.add(plane)
  materials.push(planeMaterial)

  /* 3. Cacos. */
  const shardGeometry = buildShards(light ? 48 : 170)
  const shardMaterial = new THREE.ShaderMaterial({
    vertexShader: SHARD_VERTEX,
    fragmentShader: SHARD_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uU: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uLight: { value: lightDir },
    },
  })
  const shards = new THREE.Mesh(shardGeometry, shardMaterial)
  shards.frustumCulled = false
  shards.renderOrder = 1
  object.add(shards)
  geometries.push(shardGeometry)
  materials.push(shardMaterial)

  /* 4. Brasas. */
  const emberGeometry = buildEmbers(light ? 220 : 700)
  const emberMaterial = new THREE.ShaderMaterial({
    vertexShader: EMBER_VERTEX,
    fragmentShader: EMBER_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uU: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uPixelRatio: { value: pixelRatio },
      uPixels: { value: 300 },
    },
  })
  const embers = new THREE.Points(emberGeometry, emberMaterial)
  embers.frustumCulled = false
  embers.renderOrder = 5
  object.add(embers)
  geometries.push(emberGeometry)
  materials.push(emberMaterial)

  /* 5. Poeira. */
  const smokeTexture = makeSmokeTexture()
  textures.push(smokeTexture)
  const smokeGeometry = buildSmoke(light ? 14 : 34)
  const smokeMaterial = new THREE.ShaderMaterial({
    vertexShader: SMOKE_VERTEX,
    fragmentShader: SMOKE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uU: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uMap: { value: smokeTexture },
    },
  })
  const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial)
  smoke.frustumCulled = false
  smoke.renderOrder = 2
  object.add(smoke)
  geometries.push(smokeGeometry)
  materials.push(smokeMaterial)

  /* 6. Remanescente. */
  const NEBULA_EXTENT = 2.0
  const nebulaMaterial = new THREE.ShaderMaterial({
    vertexShader: BILLBOARD_VERTEX,
    fragmentShader: NEBULA_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uU: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    },
  })
  const nebula = new THREE.Mesh(disc, nebulaMaterial)
  nebula.scale.setScalar(R * NEBULA_EXTENT)
  nebula.position.z = -R * 0.8
  nebula.renderOrder = 0
  object.add(nebula)
  materials.push(nebulaMaterial)

  return {
    object,
    update(state: ExplosionState, time: number) {
      const k = Math.min(Math.max(state.break, 0), 1)
      /* Em `break` 1 o remanescente ainda está lá: quem o apaga é a
         opacidade do estado, na tabela de scroll. */
      object.visible = state.opacity > 0.01 && k > 0.03
      if (!object.visible) return
      object.position.set(state.x, state.y, 0)
      object.scale.setScalar(state.scale)
      /* Relógio do voo: 0 na hora do estouro, 1 quando os destroços já
         esfriaram e sumiram. */
      const u = Math.min(Math.max((k - SUN_BURST) / (1 - SUN_BURST), 0), 1)
      const flicker = 0.94 + 0.06 * Math.sin(time * 41)
      const opacity = state.opacity

      /* Halo: aquece o planeta antes, ilumina a poeira depois. */
      const pre = smooth(0.06, SUN_BURST, k) * (1 - smooth(SUN_BURST, SUN_BURST + 0.1, k))
      const haloBurst = smooth(SUN_BURST - 0.02, SUN_BURST + 0.06, k) * (1 - smooth(SUN_BURST + 0.1, 1.0, k))
      haloMaterial.uniforms.uStrength.value = (pre * 0.14 + haloBurst * 0.14) * opacity
      haloMaterial.uniforms.uTime.value = time
      halo.scale.setScalar(R * (1.4 + 1.4 * smooth(SUN_BURST, 0.75, k)))

      /* Clarão: sobe em três centésimos, cai devagar, some antes do fim. */
      const rise = smooth(SUN_BURST - 0.03, SUN_BURST + 0.02, k)
      const decay = 1 - smooth(SUN_BURST + 0.03, SUN_BURST + 0.2, k)
      const gone = 1 - smooth(SUN_BURST + 0.2, SUN_BURST + 0.38, k)
      /* Forte mas curto: em meio segundo de scroll já é só o miolo. */
      flashMaterial.uniforms.uStrength.value = rise * (0.12 + 0.88 * decay) * gone * flicker * opacity * 0.4
      flashMaterial.uniforms.uTime.value = time
      flash.scale.setScalar(R * (1.0 + 1.3 * smooth(SUN_BURST - 0.02, SUN_BURST + 0.25, k)))

      /* Onda de choque: a casca cresce rápido e some; o anel plano vai mais
         longe e dura mais. */
      /* Expoentes mais macios, mesmos raios finais. A 2,4 a onda de choque
         gastava 58% da expansão nos primeiros 30% do relógio: ela disparava
         e parava. A 1,6 isso cai para 44% e a expansão se espalha pelos 765px
         inteiros em que o cliente está olhando. É curva, não alcance. */
      const shellEase = 1 - Math.pow(1 - u, 1.6)
      shellMaterial.uniforms.uRadius.value = (1.0 + 3.1 * shellEase) / SHELL_EXTENT
      shellMaterial.uniforms.uWidth.value = (0.05 + 0.16 * u) / SHELL_EXTENT
      shellMaterial.uniforms.uAlpha.value = smooth(0, 0.03, u) * Math.pow(1 - u, 1.5) * 0.7 * opacity
      shellMaterial.uniforms.uPhase.value = u
      const planeEase = 1 - Math.pow(1 - u, 1.4)
      planeMaterial.uniforms.uRadius.value = (1.0 + 4.3 * planeEase) / PLANE_EXTENT
      planeMaterial.uniforms.uWidth.value = (0.035 + 0.07 * u) / PLANE_EXTENT
      planeMaterial.uniforms.uAlpha.value = smooth(0, 0.04, u) * Math.pow(1 - u, 1.2) * 0.6 * opacity
      planeMaterial.uniforms.uPhase.value = u

      const flying = u > 0
      shards.visible = flying
      embers.visible = flying
      smoke.visible = flying
      shardMaterial.uniforms.uU.value = u
      shardMaterial.uniforms.uTime.value = time
      shardMaterial.uniforms.uOpacity.value = opacity
      emberMaterial.uniforms.uU.value = u
      emberMaterial.uniforms.uTime.value = time
      emberMaterial.uniforms.uOpacity.value = opacity
      emberMaterial.uniforms.uPixels.value = state.pixelsPerUnit
      smokeMaterial.uniforms.uU.value = u
      smokeMaterial.uniforms.uTime.value = time
      smokeMaterial.uniforms.uOpacity.value = opacity
      nebula.visible = flying
      nebulaMaterial.uniforms.uU.value = u
      nebulaMaterial.uniforms.uTime.value = time
      nebulaMaterial.uniforms.uOpacity.value = opacity
    },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
      for (const t of textures) t.dispose()
    },
  }
}
