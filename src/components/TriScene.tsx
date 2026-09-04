import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Núcleo orbital: uma bola densa de triângulos vazados com três anéis
 * inclinados girando em velocidades diferentes. No scroll ele se espalha e
 * depois volta a se juntar. É um canvas fixo atrás do documento inteiro; cada
 * seção é um estado dessa mesma cena.
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

/**
 * Keyframes de scroll: [progresso da página, dispersão, x (fração da meia
 * largura), y, escala, opacidade]. Casados com a ordem das seções em App.tsx:
 * hero à direita, serviços à esquerda, manifesto disperso, missão reagrupada à
 * direita, equipe com campo ralo (os cards precisam de silêncio atrás) e
 * rodapé reagrupado no centro.
 */
const KEYFRAMES: Keyframes = [
  [0.0, 0.04, 0.52, 0.02, 0.88, 1.0, 0],
  [0.035, 0.05, 0.52, 0.0, 0.88, 1.0, 0],
  [0.075, 0.85, 0.0, 0.0, 1.25, 0.35, 0],
  [0.23, 0.85, 0.0, 0.0, 1.25, 0.35, 0],
  [0.26, 1.0, 0.0, 0.0, 1.12, 0.9, 0],
  [0.29, 1.0, 0.0, 0.0, 1.12, 0.9, 0],
  [0.31, 1.0, 0.0, 0.0, 1.12, 0.0, 0],
  /* Invisível atrás do vídeo: troca de forma aqui, ninguém vê a costura. */
  [0.32, 0.3, 0.55, 0.0, 0.9, 0.0, 1],
  /* Buraco negro formado enquanto "Seu negócio em novas órbitas" está na tela
     (a Missão ocupa 0.285 a 0.383 nesta largura). */
  [0.337, 0.05, 0.55, 0.0, 0.9, 1.0, 1],
  [0.375, 0.06, 0.55, 0.0, 0.9, 1.0, 1],
  [0.41, 0.9, 0.0, 0.0, 1.35, 0.22, 1],
  [0.445, 0.9, 0.0, 0.0, 1.35, 0.22, 1],
  [0.47, 0.9, 0.0, 0.0, 1.35, 0.0, 1],
  /* Invisível de novo: vira supernova para o resto da página. */
  [0.5, 0.9, 0.0, 0.0, 1.35, 0.0, 2],
  [0.53, 0.9, 0.0, 0.0, 1.35, 0.22, 2],
  [0.9, 0.9, 0.0, 0.0, 1.35, 0.22, 2],
  /* Supernova pronta quando o fechamento entra (0.933), não depois dele. */
  [0.955, 0.08, 0.0, -0.62, 0.95, 0.8, 2],
  [1.0, 0.08, 0.0, -0.62, 0.95, 0.8, 2],
]

type Keyframes = Array<[number, number, number, number, number, number, number]>

/**
 * Mesmo valor do breakpoint `lg` do Tailwind, que é onde o menu vira hambúrguer.
 * A cena e o CSS precisam trocar de composição na mesma largura: abaixo disso
 * valem a tabela do hero e as placas de contraste marcadas com `lg:hidden`;
 * acima, o layout de duas colunas e a tabela de página inteira.
 */
const MOBILE_BREAKPOINT = 1024

/** Raio do objeto agrupado em unidades de mundo: o anel externo para em 1.64. */
const OBJECT_RADIUS = 1.64

/**
 * Opacidade do objeto no hero e depois dele. Com a clareira do shader abrindo
 * espaço para o texto, o anel pode brilhar de verdade na primeira dobra; do
 * hero para baixo ele recua para grão de fundo atrás dos cards.
 */
const HERO_OPACITY = 0.95
const FIELD_OPACITY = 0.1

/**
 * Faixa que o texto do hero ocupa, em NDC: [centro, raio]. `offsetTop` ignora o
 * transform de parallax do hero, que é o que queremos. Sem o elemento, assume
 * uma dobra típica de celular.
 */
function heroCopyBand(): [number, number] {
  const copy = document.getElementById('hero-copy')
  if (!copy) return [-0.35, 0.55]
  let node: HTMLElement | null = copy
  let top = 0
  while (node) {
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  const viewport = window.innerHeight
  const start = top / viewport
  const end = (top + copy.offsetHeight) / viewport
  /* Fração da tela (0 no topo) para NDC (1 no topo), com folga de 18%. */
  return [1 - (start + end), (end - start) * 1.18]
}

/**
 * Tela estreita usa outra tabela. O objeto continua sendo fundo, centralizado na
 * tela, e o texto passa por cima dele — quem abre espaço para a leitura é a
 * clareira do shader, não uma placa opaca por cima do objeto.
 *
 * Da primeira dobra para baixo ele se espalha e cai para FIELD_OPACITY, virando
 * grão de fundo: continua lá a página inteira sem competir com os cards, que era
 * o problema de deixá-lo em brilho cheio atrás de tudo.
 *
 * Tamanho não é número fixo: a constante que fica boa num iPhone Pro Max vira
 * uma mancha num aparelho de 640px. O raio sai da largura da tela, com teto de
 * altura para não virar faixa em tela comprida.
 */
function mobileKeyframes(halfWidth: number, halfHeight: number, maxScroll: number): Keyframes {
  /* Larga o bastante para sangrar pelas laterais, com teto de altura para não
     virar uma faixa gorda demais em tela comprida. */
  const radius = Math.min(1.45 * halfWidth, 0.78 * halfHeight)
  const scale = radius / OBJECT_RADIUS
  /* O disco é inclinado, então a caixa dele nasce torta: 0.09 recentraliza. */
  const x = 0.09

  /* Trechos medidos em telas de rolagem, não em fração da página: 6% de uma
     página de 25.000px são 1.500px, e o objeto ainda estaria brilhando muito
     depois do hero. */
  const screen = window.innerHeight / maxScroll
  const hold = Math.min(screen * 0.25, 0.12)
  const settle = Math.min(screen * 0.9, 0.2)

  return [
    /* Hero: planeta atrás do texto, um pouco acima do centro para o arco de
       cima aparecer no vão entre o menu e o título. */
    [0.0, 0.03, x, 0.35, scale, HERO_OPACITY, 0],
    [hold, 0.05, x, 0.35, scale, HERO_OPACITY, 0],
    /* Ao sair da dobra ele se espalha e recua para textura de fundo. */
    [settle, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 0],
    [0.16, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 0],
    /* Troca de astro com o campo quase invisível, ninguém vê a costura. */
    [0.185, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 1],
    /* Buraco negro formado enquanto "Seu negócio em novas órbitas" está na
       tela (a Missão ocupa 0.222 a 0.294 nesta largura). */
    [0.25, 0.12, 0.0, -0.15, scale * 0.95, 0.38, 1],
    [0.29, 0.12, 0.0, -0.15, scale * 0.95, 0.38, 1],
    [0.335, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 1],
    [0.55, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 1],
    /* Disperso e quase invisível, muda de cor para a última transformação. */
    [0.62, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 2],
    [0.88, 0.95, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 2],
    /* Supernova pronta quando "A sua operação tem a resposta" entra (0.935),
       e não lá embaixo no rodapé utilitário. */
    [0.95, 0.08, 0.0, -0.5, scale, 0.85, 2],
    [1.0, 0.08, 0.0, -0.5, scale, 0.85, 2],
  ]
}

function sampleKeyframes(table: Keyframes, progress: number) {
  const clamped = Math.min(Math.max(progress, 0), 1)
  let index = 0
  while (index < table.length - 2 && table[index + 1][0] < clamped) index += 1
  const from = table[index]
  const to = table[index + 1]
  const span = to[0] - from[0] || 1
  const local = Math.min(Math.max((clamped - from[0]) / span, 0), 1)
  const eased = local * local * (3 - 2 * local)
  return {
    mix: from[1] + (to[1] - from[1]) * eased,
    x: from[2] + (to[2] - from[2]) * eased,
    y: from[3] + (to[3] - from[3]) * eased,
    scale: from[4] + (to[4] - from[4]) * eased,
    opacity: from[5] + (to[5] - from[5]) * eased,
    form: from[6] + (to[6] - from[6]) * eased,
  }
}

const VERTEX_SHADER = /* glsl */ `
  attribute vec3 aSphere;
  attribute vec3 aScatter;
  attribute vec3 aHole;
  attribute vec3 aNova;
  attribute vec3 aColor;
  attribute vec3 aHoleColor;
  attribute vec3 aNovaColor;
  attribute float aRand;
  attribute float aRing;
  uniform float uMix;
  uniform float uForm;
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
    float angle = uTime * 0.07 * speed;
    vec3 core = aRing > 0.5
      ? rotateAxis(aSphere, discAxis, angle)
      : rotateAxis(aSphere, vec3(0.0, 1.0, 0.0), angle);

    /* Buraco negro: o disco gira no próprio plano, mais depressa perto do
       horizonte, como uma órbita kepleriana de mentira. */
    float rHole = max(length(aHole), 0.4);
    vec3 coreHole = rotateAxis(aHole, discAxis, uTime * 0.1 * (0.4 + 0.9 / rHole));

    /* Supernova: respira para fora e gira bem devagar. */
    float pulse = 1.0 + 0.05 * sin(uTime * 0.8 + aRand * 6.2831);
    vec3 coreNova = rotateAxis(aNova * pulse, vec3(0.0, 1.0, 0.0), uTime * 0.05);

    /* uForm anda de 0 a 2 e escolhe o astro; a troca acontece com o objeto
       disperso ou invisível, então a interpolação nunca aparece pela metade. */
    float wPlanet = clamp(1.0 - uForm, 0.0, 1.0);
    float wNova = clamp(uForm - 1.0, 0.0, 1.0);
    float wHole = 1.0 - wPlanet - wNova;
    core = core * wPlanet + coreHole * wHole + coreNova * wNova;
    vColor = aColor * wPlanet + aHoleColor * wHole + aNovaColor * wNova;

    vec3 scatter = aScatter;
    scatter.x += sin(uTime * 0.28 + aRand * 6.2831) * 0.09;
    scatter.y += cos(uTime * 0.22 + aRand * 9.42) * 0.09;

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
const RING_NORMAL = new THREE.Vector3(0.25, 0.75, 0.62).normalize()
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

function buildTriangles(count: number, spread: THREE.Vector3, onSphere: boolean) {
  const spherePositions = new Float32Array(count * 6 * 3)
  const scatterPositions = new Float32Array(count * 6 * 3)
  const holePositions = new Float32Array(count * 6 * 3)
  const novaPositions = new Float32Array(count * 6 * 3)
  const colors = new Float32Array(count * 6 * 3)
  const holeColors = new Float32Array(count * 6 * 3)
  const novaColors = new Float32Array(count * 6 * 3)
  const randoms = new Float32Array(count * 6)
  const rings = new Float32Array(count * 6)
  const color = new THREE.Color()
  const holeColor = new THREE.Color()
  const novaColor = new THREE.Color()
  const holeAnchorV = new THREE.Vector3()
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
      novaAnchor(novaAnchorV, novaColor)
    } else {
      holeAnchorV.copy(anchor)
      novaAnchorV.copy(anchor)
      holeColor.copy(color)
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
      novaPositions[base] = novaAnchorV.x + corner.x
      novaPositions[base + 1] = novaAnchorV.y + corner.y
      novaPositions[base + 2] = novaAnchorV.z + corner.z
      colors[base] = color.r
      colors[base + 1] = color.g
      colors[base + 2] = color.b
      holeColors[base] = holeColor.r
      holeColors[base + 1] = holeColor.g
      holeColors[base + 2] = holeColor.b
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
  geometry.setAttribute('aNova', new THREE.BufferAttribute(novaPositions, 3))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('aHoleColor', new THREE.BufferAttribute(holeColors, 3))
  geometry.setAttribute('aNovaColor', new THREE.BufferAttribute(novaColors, 3))
  geometry.setAttribute('aRand', new THREE.BufferAttribute(randoms, 1))
  geometry.setAttribute('aRing', new THREE.BufferAttribute(rings, 1))
  /* LineSegments exige o atributo `position` mesmo com o shader ignorando ele. */
  geometry.setAttribute('position', new THREE.BufferAttribute(spherePositions, 3))
  return geometry
}

function makeMaterial(opacity: number) {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMix: { value: 0 },
      uForm: { value: 0 },
      uTime: { value: 0 },
      uScale: { value: 1 },
      uCenter: { value: new THREE.Vector2(0, 0) },
      uClear: { value: 0 },
      uClearBand: { value: new THREE.Vector2(0, 0.5) },
      uOpacity: { value: opacity },
    },
  })
}

export function TriScene() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    /* Mesma cena em todo lugar, dimensionada pelo hardware: celular e máquina
       fraca recebem menos triângulos e menos pixels para preencher. */
    const cores = navigator.hardwareConcurrency ?? 8
    const weakDevice = cores <= 4
    const lightweight = window.innerWidth < 1024

    const renderer = new THREE.WebGLRenderer({
      antialias: !weakDevice,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, weakDevice ? 1 : lightweight ? 1.25 : 1.5),
    )
    renderer.setSize(window.innerWidth, window.innerHeight)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 20)
    camera.position.z = 3.3

    const spread = new THREE.Vector3(2.6, 1.7, 1.2)
    const sphereGeometry = buildTriangles(
      weakDevice ? 3000 : lightweight ? 5200 : 8000,
      spread,
      true,
    )
    const sphereMaterial = makeMaterial(0.95)
    const sphereField = new THREE.LineSegments(sphereGeometry, sphereMaterial)
    scene.add(sphereField)

    /* Camada ambiente, sempre dispersa: os triângulos fracos flutuando em volta. */
    const ambientGeometry = buildTriangles(
      lightweight ? 260 : 600,
      new THREE.Vector3(3.2, 2.1, 1.6),
      false,
    )
    const ambientMaterial = makeMaterial(0.32)
    ambientMaterial.uniforms.uMix.value = 1
    const ambientField = new THREE.LineSegments(ambientGeometry, ambientMaterial)
    scene.add(ambientField)

    /* A altura da página fica em cache: ler scrollHeight dentro do loop força
       um layout a cada frame, que era o que travava o scroll em máquina lenta.
       Só recalcula quando o documento muda de verdade. */
    let maxScroll = 1
    const measureScroll = () => {
      maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
    }
    measureScroll()

    const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z
    let halfWidth = halfHeight * camera.aspect
    let mobileTable = mobileKeyframes(halfWidth, halfHeight, maxScroll)
    let narrow = window.innerWidth < MOBILE_BREAKPOINT
    /* A intensidade da clareira é por frame (ela apaga depois do hero, para o
       buraco negro e a supernova aparecerem inteiros); aqui só a faixa. */
    const applyClear = () => {
      const band = heroCopyBand()
      for (const material of [sphereMaterial, ambientMaterial]) {
        material.uniforms.uClearBand.value.set(band[0], band[1])
      }
    }
    const current = { mix: 0.04, x: 0.58, y: 0.02, scale: 1, opacity: 1, form: 0 }
    const pointer = { x: 0, y: 0 }

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    /* Browser de celular dispara resize quando a barra de URL recolhe no meio
       do scroll; reprojetar nisso faz o planeta pular na tela. Só mudança real
       de largura (girar o aparelho, redimensionar a janela) refaz a projeção. */
    let lastWidth = window.innerWidth
    let lastHeight = window.innerHeight
    const onResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      if (width === lastWidth && Math.abs(height - lastHeight) < 180) return
      lastWidth = width
      lastHeight = height
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      halfWidth = halfHeight * camera.aspect
      mobileTable = mobileKeyframes(halfWidth, halfHeight, maxScroll)
      narrow = width < MOBILE_BREAKPOINT
      applyClear()
      measureScroll()
    }
    window.addEventListener('resize', onResize)

    /* O primeiro frame renderizado levanta a opacidade do container, para o canvas não aparecer de supetão. */
    let revealed = false

    /* A tabela do hero depende da altura do texto e da altura da página, que
       mudam quando as fontes carregam e quando o documento cresce. */
    const remeasure = () => {
      measureScroll()
      mobileTable = mobileKeyframes(halfWidth, halfHeight, maxScroll)
      applyClear()
    }
    const pageObserver = new ResizeObserver(remeasure)
    pageObserver.observe(document.body)
    document.fonts?.ready.then(remeasure)

    applyClear()

    let frame = 0
    let previous = performance.now()

    /* Qualidade adaptativa: mede os primeiros segundos de frames reais e, se a
       máquina não segura a taxa, derruba resolução e camada ambiente uma vez
       só. Seguro barato para notebook velho, que não dá para detectar. */
    let sampled = 0
    let slowFrames = 0
    let downgraded = false
    const considerDowngrade = (delta: number) => {
      if (downgraded || sampled > 150) return
      sampled += 1
      if (delta > 0.028) slowFrames += 1
      if (sampled >= 90 && slowFrames > 30) {
        downgraded = true
        renderer.setPixelRatio(1)
        renderer.setSize(window.innerWidth, window.innerHeight)
        ambientField.visible = false
      }
    }

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const delta = Math.min((now - previous) / 1000, 0.05)
      previous = now
      considerDowngrade(delta)

      const progress = window.scrollY / maxScroll
      /* Abaixo do breakpoint roda a tabela presa ao hero, não a de página inteira. */
      const target = sampleKeyframes(narrow ? mobileTable : KEYFRAMES, progress)

      const damping = reducedMotion ? 1 : 1 - Math.exp(-delta * 4.5)
      current.mix += (target.mix - current.mix) * damping
      current.x += (target.x - current.x) * damping
      current.y += (target.y - current.y) * damping
      current.scale += (target.scale - current.scale) * damping
      current.opacity += (target.opacity - current.opacity) * damping
      current.form += (target.form - current.form) * damping

      /* A clareira só existe enquanto o hero está na tela: dali para baixo os
         outros astros aparecem inteiros, sem o miolo apagado. */
      const heroClear = narrow
        ? Math.min(Math.max(1 - window.scrollY / (window.innerHeight * 0.9), 0), 1)
        : 0
      sphereMaterial.uniforms.uClear.value = heroClear
      ambientMaterial.uniforms.uClear.value = heroClear

      const time = reducedMotion ? 0 : now / 1000
      sphereMaterial.uniforms.uTime.value = time
      sphereMaterial.uniforms.uForm.value = current.form
      ambientMaterial.uniforms.uForm.value = current.form
      sphereMaterial.uniforms.uMix.value = current.mix
      sphereMaterial.uniforms.uScale.value = current.scale
      sphereMaterial.uniforms.uOpacity.value = 0.95 * current.opacity
      sphereMaterial.uniforms.uCenter.value.set(
        current.x * halfWidth + pointer.x * 0.05,
        current.y + pointer.y * -0.04,
      )
      ambientMaterial.uniforms.uTime.value = time * 0.6
      ambientMaterial.uniforms.uOpacity.value = narrow ? 0.12 : 0.32

      renderer.render(scene, camera)

      if (!revealed) {
        revealed = true
        mount.style.opacity = '1'
      }
    }
    frame = requestAnimationFrame(tick)

    /* Sem sentido queimar GPU com a aba escondida. */
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame)
      } else {
        previous = performance.now()
        frame = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(frame)
      pageObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
      sphereGeometry.dispose()
      ambientGeometry.dispose()
      sphereMaterial.dispose()
      ambientMaterial.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 opacity-0 transition-opacity duration-700"
    />
  )
}
