import * as THREE from 'three'

/**
 * A matéria da cena: triângulos vazados em LineSegments, com uma âncora por
 * astro gravada em atributo para o shader interpolar entre elas.
 */

/** Paleta azul: cobalto na frente, ivory segurando a base fria. */
const PALETTE: Array<[string, number]> = [
  ['#4d84e0', 0.2],
  ['#5a8fe8', 0.14],
  ['#8db4f5', 0.12],
  ['#6d9df0', 0.08],
  ['#a8c8ff', 0.08],
  ['#f5f7fb', 0.18],
  ['#b9c2d4', 0.12],
  ['#ffffff', 0.08],
]

/* Buraco negro: disco de acreção do branco-quente ao laranja profundo. */
const HOLE_HOT = ['#fff6e5', '#ffe3b0']
const HOLE_INNER = ['#fff3e0', '#ffd9a0']
const HOLE_MID = ['#ffb25e', '#ff9a3c']
const HOLE_OUTER = ['#e8590c', '#b64207', '#ffd9a0']

/* Estrela: bola dourada-branca compacta com uma coroa rala. */
const STAR_BODY = ['#ffe9a8', '#ffd166', '#fff3c4']
const STAR_SURFACE = ['#ffffff', '#fffbe8']
const STAR_CORONA = ['#ffd166', '#ff9e57']

/* Supernova: núcleo branco, ouro e laranja nos raios, magenta e violeta nas cascas. */
const NOVA_CORE = ['#ffffff', '#fff3c4']
const NOVA_GOLD = ['#ffd166', '#ffb84d']
const NOVA_FIRE = ['#ff7b4f', '#ff9e57']
const NOVA_EDGE = ['#e14eca', '#8d6bff', '#ff7b4f']

function pickFrom(target: THREE.Color, options: readonly string[]) {
  target.set(options[Math.floor(Math.random() * options.length)])
}

function pickColor(target: THREE.Color, random: () => number) {
  let roll = random()
  for (const [hex, weight] of PALETTE) {
    roll -= weight
    if (roll <= 0) {
      target.set(hex)
      return
    }
  }
  target.set(PALETTE[0][0])
}

const VERTEX_SHADER = /* glsl */ `
  attribute vec3 aSphere;
  attribute vec3 aScatter;
  attribute vec3 aHole;
  attribute vec3 aStar;
  attribute vec3 aNova;
  attribute vec3 aColor;
  attribute vec3 aHoleColor;
  attribute vec3 aStarColor;
  attribute vec3 aNovaColor;
  attribute float aRand;
  attribute float aRing;
  uniform float uMix;
  uniform float uForm;
  uniform float uRush;
  uniform float uTime;
  uniform float uScale;
  uniform vec2 uCenter;
  uniform float uClear;
  uniform vec2 uClearBand;
  varying vec3 vColor;
  varying float vFade;
  varying float vClear;

  /* Rotação de Rodrigues em torno de um eixo unitário qualquer. */
  vec3 rotateAxis(vec3 p, vec3 axis, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
  }

  void main() {
    /* O corpo do planeta gira devagar no Y; cada faixa de anel orbita no plano
       inclinado comum, em velocidade e sentido próprios. É a contra-rotação
       que dá vida ao objeto. */
    const vec3 discAxis = vec3(0.2488, 0.7465, 0.6171);
    float speed = 0.5;
    if (aRing > 0.5 && aRing < 1.5) speed = 1.4;
    else if (aRing > 1.5 && aRing < 2.5) speed = -1.0;
    else if (aRing > 2.5) speed = 1.9;
    /* Arrastar rápido acelera a rotação e a deriva: o astro se agita. */
    float angle = uTime * 0.07 * speed * (1.0 + uRush * 0.8);
    vec3 core = aRing > 0.5
      ? rotateAxis(aSphere, discAxis, angle)
      : rotateAxis(aSphere, vec3(0.0, 1.0, 0.0), angle);

    /* Buraco negro: o disco gira no próprio plano, mais depressa perto do
       horizonte, como uma órbita kepleriana de mentira. */
    float rHole = max(length(aHole), 0.4);
    vec3 coreHole = rotateAxis(aHole, discAxis, uTime * 0.1 * (0.4 + 0.9 / rHole));
    /* Sucção: enquanto o campo ainda está disperso, o alvo no disco gira
       com a dispersão, então cada triângulo chega em espiral, não em linha
       reta. Agrupado, o giro extra é quase zero. */
    coreHole = rotateAxis(coreHole, discAxis, uMix * 2.4);

    /* Estrela: cintila, respirando curto e rápido. */
    float twinkle = 1.0 + 0.03 * sin(uTime * 1.6 + aRand * 6.2831);
    vec3 coreStar = rotateAxis(aStar * twinkle, vec3(0.0, 1.0, 0.0), uTime * 0.06);

    /* Supernova: respira para fora e gira bem devagar. */
    float pulse = 1.0 + 0.05 * sin(uTime * 0.8 + aRand * 6.2831);
    vec3 coreNova = rotateAxis(aNova * pulse, vec3(0.0, 1.0, 0.0), uTime * 0.05);

    /* uForm anda de 0 a 3 e escolhe o astro. Quase toda troca acontece com o
       campo disperso ou invisível; a exceção é 2 para 3, feita agrupada e à
       vista de propósito — a estrela explodindo em supernova. */
    float wPlanet = clamp(1.0 - uForm, 0.0, 1.0);
    float wHole = 1.0 - min(abs(uForm - 1.0), 1.0);
    float wStar = 1.0 - min(abs(uForm - 2.0), 1.0);
    float wNova = clamp(uForm - 2.0, 0.0, 1.0);
    core = core * wPlanet + coreHole * wHole + coreStar * wStar + coreNova * wNova;
    vColor = aColor * wPlanet + aHoleColor * wHole + aStarColor * wStar + aNovaColor * wNova;

    vec3 scatter = aScatter;
    float drift = 0.09 * (1.0 + uRush * 0.9);
    scatter.x += sin(uTime * 0.28 + aRand * 6.2831) * drift;
    scatter.y += cos(uTime * 0.22 + aRand * 9.42) * drift;

    vec3 position3 = mix(core, scatter, uMix) * uScale;
    position3.xy += uCenter;

    /* O lado de trás escurece em vez de sumir; os anéis ficam um pouco mais claros. */
    float depth = smoothstep(-1.5, 1.2, core.z);
    float base = aRing > 0.5 ? 0.35 : 0.15;
    /* As formas novas não têm frente e verso tão marcados quanto o planeta. */
    base = mix(base, 0.32, clamp(uForm, 0.0, 1.0));
    vFade = mix(base + (1.0 - base) * depth * depth, 0.85, uMix);

    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position3, 1.0);
    gl_Position = clip;

    /* Clareira: no celular o objeto fica centralizado atrás do texto, e o
       miolo dele cai bem em cima da leitura. Em vez de tapar o objeto com uma
       placa opaca, ele mesmo se apaga onde o texto está e volta ao brilho
       cheio na borda — o anel continua inteiro, só respira no meio. */
    vec2 ndc = clip.xy / max(abs(clip.w), 0.0001);
    float hole = length(vec2(ndc.x / 1.05, (ndc.y - uClearBand.x) / uClearBand.y));
    float dim = mix(0.16, 1.0, smoothstep(0.28, 1.0, hole));
    vClear = mix(1.0, dim, uClear);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vFade;
  varying float vClear;

  void main() {
    gl_FragColor = vec4(vColor, uOpacity * vFade * vClear);
  }
`

/**
 * Monta os triângulos vazados como uma única geometria LineSegments: 3 arestas
 * viram 6 vértices por triângulo, com a posição agrupada e a dispersa gravadas
 * em atributos para o shader interpolar entre as duas.
 */
/**
 * Um plano orbital inclinado comum: três faixas concêntricas com folga entre
 * elas, girando em sentidos opostos.
 */
export const RING_NORMAL = new THREE.Vector3(0.25, 0.75, 0.62).normalize()
const RING_TANGENT = new THREE.Vector3(1, 0, 0).cross(RING_NORMAL).normalize()
const RING_BITANGENT = new THREE.Vector3().crossVectors(RING_NORMAL, RING_TANGENT)
const RING_BANDS: Array<[number, number]> = [
  [1.04, 1.2],
  [1.3, 1.46],
  [1.56, 1.64],
]

/**
 * Buraco negro: horizonte vazio no meio, anel de fótons apertado em volta e um
 * disco de acreção inclinado, mais denso e mais quente perto do centro. Com
 * blending aditivo não existe partícula escura, então o preto do buraco é
 * literalmente a ausência de triângulos.
 */
function holeAnchor(anchor: THREE.Vector3, color: THREE.Color) {
  const roll = Math.random()
  let radius: number
  let lift: number
  if (roll < 0.12) {
    radius = 0.4 + Math.random() * 0.06
    lift = (Math.random() - 0.5) * 0.03
    pickFrom(color, HOLE_HOT)
  } else {
    radius = 0.55 + 1.1 * Math.pow(Math.random(), 0.65)
    lift = (Math.random() - 0.5) * 0.06
    if (radius < 0.8) pickFrom(color, HOLE_INNER)
    else if (radius < 1.2) pickFrom(color, HOLE_MID)
    else pickFrom(color, HOLE_OUTER)
  }
  const theta = Math.random() * Math.PI * 2
  anchor
    .set(0, 0, 0)
    .addScaledVector(RING_TANGENT, Math.cos(theta) * radius)
    .addScaledVector(RING_BITANGENT, Math.sin(theta) * radius)
    .addScaledVector(RING_NORMAL, lift)
}

/**
 * Estrela: uma bola compacta e densa, casca brilhante na superfície e uma
 * coroa rala em volta. É a forma que explode: interpolar daqui direto para a
 * supernova (uForm 2 para 3) faz os triângulos voarem do corpo para as cascas
 * de detonação — a única troca de astro feita à vista de propósito.
 */
function starAnchor(anchor: THREE.Vector3, color: THREE.Color) {
  const roll = Math.random()
  if (roll < 0.55) {
    randomDirection(anchor).multiplyScalar(0.45 * Math.cbrt(Math.random()))
    pickFrom(color, STAR_BODY)
    return
  }
  if (roll < 0.82) {
    randomDirection(anchor).multiplyScalar(0.44 + Math.random() * 0.06)
    pickFrom(color, STAR_SURFACE)
    return
  }
  randomDirection(anchor).multiplyScalar(0.55 + 0.5 * Math.pow(Math.random(), 2))
  pickFrom(color, STAR_CORONA)
}

/**
 * Supernova: núcleo branco denso, raios radiais de ejeção e duas cascas de
 * detonação. As cores esfriam do centro para fora.
 */
function novaAnchor(anchor: THREE.Vector3, color: THREE.Color) {
  const roll = Math.random()
  if (roll < 0.1) {
    /* Miolo propositalmente ralo: com blending aditivo, concentrar aqui vira um
       ponto branco estourado que apaga qualquer texto por trás. */
    const radius = 0.42 * Math.cbrt(Math.random())
    randomDirection(anchor).multiplyScalar(radius)
    pickFrom(color, NOVA_CORE)
    return
  }
  if (roll < 0.7) {
    const radius = 0.4 + 1.2 * Math.pow(Math.random(), 0.75)
    randomDirection(anchor).multiplyScalar(radius)
    if (radius < 0.8) pickFrom(color, NOVA_GOLD)
    else if (radius < 1.2) pickFrom(color, NOVA_FIRE)
    else pickFrom(color, NOVA_EDGE)
    return
  }
  const shell = Math.random() < 0.55 ? 0.95 : 1.45
  const radius = shell + (Math.random() - 0.5) * 0.14
  randomDirection(anchor).multiplyScalar(radius)
  pickFrom(color, shell < 1.2 ? NOVA_FIRE : NOVA_EDGE)
}

/** Direção uniforme na esfera unitária. */
function randomDirection(target: THREE.Vector3) {
  const inclination = Math.acos(1 - 2 * Math.random())
  const azimuth = Math.random() * Math.PI * 2
  return target.set(
    Math.sin(inclination) * Math.cos(azimuth),
    Math.cos(inclination),
    Math.sin(inclination) * Math.sin(azimuth),
  )
}

export function buildTriangles(count: number, spread: THREE.Vector3, onSphere: boolean) {
  const spherePositions = new Float32Array(count * 6 * 3)
  const scatterPositions = new Float32Array(count * 6 * 3)
  const holePositions = new Float32Array(count * 6 * 3)
  const starPositions = new Float32Array(count * 6 * 3)
  const novaPositions = new Float32Array(count * 6 * 3)
  const colors = new Float32Array(count * 6 * 3)
  const holeColors = new Float32Array(count * 6 * 3)
  const starColors = new Float32Array(count * 6 * 3)
  const novaColors = new Float32Array(count * 6 * 3)
  const randoms = new Float32Array(count * 6)
  const rings = new Float32Array(count * 6)
  const color = new THREE.Color()
  const holeColor = new THREE.Color()
  const starColor = new THREE.Color()
  const novaColor = new THREE.Color()
  const holeAnchorV = new THREE.Vector3()
  const starAnchorV = new THREE.Vector3()
  const novaAnchorV = new THREE.Vector3()

  for (let i = 0; i < count; i += 1) {
    /* Estado agrupado: a maior parte num núcleo denso e o resto dividido
       entre os três anéis inclinados. */
    let anchor: THREE.Vector3
    let ring = 0
    if (onSphere) {
      const roll = Math.random()
      if (roll < 0.6) {
        /* Corpo: casca densa na superfície da esfera mais um preenchimento interno. */
        const t = Math.random()
        const inclination = Math.acos(1 - 2 * t)
        const azimuth = Math.random() * Math.PI * 2
        const shell = Math.random() < 0.7 ? 0.6 + Math.random() * 0.06 : 0.62 * Math.sqrt(Math.random())
        anchor = new THREE.Vector3(
          Math.sin(inclination) * Math.cos(azimuth),
          Math.cos(inclination),
          Math.sin(inclination) * Math.sin(azimuth),
        ).multiplyScalar(shell)
      } else {
        ring = 1 + Math.floor(Math.random() * 3)
        const [inner, outer] = RING_BANDS[ring - 1]
        const radius = inner + Math.random() * (outer - inner)
        const tangent = new THREE.Vector3(1, 0, 0)
        tangent.cross(RING_NORMAL).normalize()
        const bitangent = new THREE.Vector3().crossVectors(RING_NORMAL, tangent)
        const theta = Math.random() * Math.PI * 2
        anchor = new THREE.Vector3()
          .addScaledVector(tangent, Math.cos(theta) * radius)
          .addScaledVector(bitangent, Math.sin(theta) * radius)
        /* Ruído vertical mínimo: as faixas precisam ler como um disco plano. */
        anchor.addScaledVector(RING_NORMAL, (Math.random() - 0.5) * 0.035)
      }
    } else {
      anchor = new THREE.Vector3(
        (Math.random() * 2 - 1) * spread.x,
        (Math.random() * 2 - 1) * spread.y,
        (Math.random() * 2 - 1) * spread.z,
      )
    }

    const scatterAnchor = new THREE.Vector3(
      (Math.random() * 2 - 1) * spread.x,
      (Math.random() * 2 - 1) * spread.y,
      (Math.random() * 2 - 1) * spread.z,
    )

    /* Cantos do triângulo num plano aleatório em volta da âncora. Quase todos
       minúsculos, um ou outro maior: grão fino no núcleo, mais grosso nos anéis. */
    const size =
      (onSphere ? (ring > 0 ? 0.008 : 0.005) : 0.012) +
      Math.random() * Math.random() * (onSphere ? (ring > 0 ? 0.03 : 0.02) : 0.055)
    const normal = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
    const tangent = new THREE.Vector3(1, 0, 0)
    if (Math.abs(normal.x) > 0.9) tangent.set(0, 1, 0)
    tangent.cross(normal).normalize()
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent)
    const phase = Math.random() * Math.PI * 2
    const corners: THREE.Vector3[] = []
    for (let k = 0; k < 3; k += 1) {
      const angle = phase + (k / 3) * Math.PI * 2
      corners.push(
        new THREE.Vector3()
          .addScaledVector(tangent, Math.cos(angle) * size)
          .addScaledVector(bitangent, Math.sin(angle) * size),
      )
    }

    pickColor(color, Math.random)
    /* A camada ambiente nunca se agrupa, então as formas extras dela apontam
       para a mesma âncora e cor do estado base. */
    if (onSphere) {
      holeAnchor(holeAnchorV, holeColor)
      starAnchor(starAnchorV, starColor)
      novaAnchor(novaAnchorV, novaColor)
    } else {
      holeAnchorV.copy(anchor)
      starAnchorV.copy(anchor)
      novaAnchorV.copy(anchor)
      holeColor.copy(color)
      starColor.copy(color)
      novaColor.copy(color)
    }
    const random = Math.random()

    /* Arestas: 0-1, 1-2, 2-0. */
    const edgeOrder = [0, 1, 1, 2, 2, 0]
    for (let v = 0; v < 6; v += 1) {
      const corner = corners[edgeOrder[v]]
      const base = (i * 6 + v) * 3
      spherePositions[base] = anchor.x + corner.x
      spherePositions[base + 1] = anchor.y + corner.y
      spherePositions[base + 2] = anchor.z + corner.z
      scatterPositions[base] = scatterAnchor.x + corner.x
      scatterPositions[base + 1] = scatterAnchor.y + corner.y
      scatterPositions[base + 2] = scatterAnchor.z + corner.z
      holePositions[base] = holeAnchorV.x + corner.x
      holePositions[base + 1] = holeAnchorV.y + corner.y
      holePositions[base + 2] = holeAnchorV.z + corner.z
      starPositions[base] = starAnchorV.x + corner.x
      starPositions[base + 1] = starAnchorV.y + corner.y
      starPositions[base + 2] = starAnchorV.z + corner.z
      novaPositions[base] = novaAnchorV.x + corner.x
      novaPositions[base + 1] = novaAnchorV.y + corner.y
      novaPositions[base + 2] = novaAnchorV.z + corner.z
      colors[base] = color.r
      colors[base + 1] = color.g
      colors[base + 2] = color.b
      holeColors[base] = holeColor.r
      holeColors[base + 1] = holeColor.g
      holeColors[base + 2] = holeColor.b
      starColors[base] = starColor.r
      starColors[base + 1] = starColor.g
      starColors[base + 2] = starColor.b
      novaColors[base] = novaColor.r
      novaColors[base + 1] = novaColor.g
      novaColors[base + 2] = novaColor.b
      randoms[i * 6 + v] = random
      rings[i * 6 + v] = ring
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('aSphere', new THREE.BufferAttribute(spherePositions, 3))
  geometry.setAttribute('aScatter', new THREE.BufferAttribute(scatterPositions, 3))
  geometry.setAttribute('aHole', new THREE.BufferAttribute(holePositions, 3))
  geometry.setAttribute('aStar', new THREE.BufferAttribute(starPositions, 3))
  geometry.setAttribute('aNova', new THREE.BufferAttribute(novaPositions, 3))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('aHoleColor', new THREE.BufferAttribute(holeColors, 3))
  geometry.setAttribute('aStarColor', new THREE.BufferAttribute(starColors, 3))
  geometry.setAttribute('aNovaColor', new THREE.BufferAttribute(novaColors, 3))
  geometry.setAttribute('aRand', new THREE.BufferAttribute(randoms, 1))
  geometry.setAttribute('aRing', new THREE.BufferAttribute(rings, 1))
  /* LineSegments exige o atributo `position` mesmo com o shader ignorando ele. */
  geometry.setAttribute('position', new THREE.BufferAttribute(spherePositions, 3))
  return geometry
}

export function makeMaterial(opacity: number) {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMix: { value: 0 },
      uForm: { value: 0 },
      uRush: { value: 0 },
      uTime: { value: 0 },
      uScale: { value: 1 },
      uCenter: { value: new THREE.Vector2(0, 0) },
      uClear: { value: 0 },
      uClearBand: { value: new THREE.Vector2(0, 0.5) },
      uOpacity: { value: opacity },
    },
  })
}
