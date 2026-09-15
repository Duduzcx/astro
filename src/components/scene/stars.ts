import * as THREE from 'three'

/**
 * Estrelas ao fundo: pontos pequenos, longe da câmera, descendo devagar
 * conforme a página rola. É o que dá sensação de viagem entre as seções
 * depois que o foguete some. Um draw call, sempre visível.
 */
export type StarsState = { progress: number; opacity: number }

/* Meia largura e meia altura do campo em mundo. Os pontos ficam entre z -1,5
   e -4, e a essa distância a tela mostra bem mais mundo do que em z 0: ±5,5
   em x cobre um monitor largo; o wrap vertical em 7 unidades fecha o ciclo
   sem borda visível. */
const SPREAD_X = 5.5
const SPREAD_Y = 3.5
const WRAP = SPREAD_Y * 2

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aTint;
  attribute float aSeed;
  uniform float uOffset;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vTint;
  varying float vTwinkle;
  varying float vSpike;

  void main() {
    vec3 p = position;
    vSpike = step(5.4, aSize);
    /* Desce com o scroll e dá a volta: y sempre em [-3,5, 3,5]. */
    p.y = mod(p.y - uOffset + ${SPREAD_Y.toFixed(1)}, ${WRAP.toFixed(1)}) - ${SPREAD_Y.toFixed(1)};
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    /* Cintila devagar, cada uma no seu tempo. Só o brilho respira: o
       tamanho do sprite fica fixo, porque uma estrela de 1–2px mudando de
       tamanho a cada frame vira um pisca-pisca de subpixel. */
    vTwinkle = 0.78 + 0.22 * sin(uTime * (0.35 + aSeed * 0.55) + aSeed * 40.0);
    /* As grandes ganham espículas e por isso o sprite é maior. */
    gl_PointSize = aSize * uPixelRatio * (3.0 / -view.z) * (1.0 + vSpike * 4.0);
    vTint = aTint;
  }
`

const FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying float vTint;
  varying float vTwinkle;
  varying float vSpike;

  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float d = length(q);
    float alpha = smoothstep(0.5, 0.12, d);
    if (vSpike > 0.5) {
      /* Cruz de difração: dois traços finos que somem para as pontas. */
      float cross = max(smoothstep(0.02, 0.0, abs(q.x)), smoothstep(0.02, 0.0, abs(q.y))) * smoothstep(0.5, 0.05, d);
      alpha = max(smoothstep(0.5, 0.36, d) * 0.9, cross * 0.8);
    }
    /* Entre ivory e azul claro, com umas poucas quentes (as de tipo K,
       que numa foto saem douradas); sem branco puro: estrela não pode
       competir com o texto. */
    vec3 cool = mix(vec3(0.96, 0.97, 0.98), vec3(0.55, 0.71, 0.96), clamp(vTint / 0.7, 0.0, 1.0));
    vec3 color = mix(cool, vec3(1.0, 0.86, 0.66), smoothstep(0.7, 1.0, vTint));
    gl_FragColor = vec4(color, alpha * uOpacity * vTwinkle);
  }
`

export function createStars(count: number, pixelRatio: number) {
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const tints = new Float32Array(count)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() * 2 - 1) * SPREAD_X
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * SPREAD_Y
    positions[i * 3 + 2] = -1.5 - Math.random() * 2.5
    /* Quase todas minúsculas, poucas maiores; as brilhantes de verdade
       são sprites à parte (brightstars.ts). */
    sizes[i] = 1.35 + Math.random() * Math.random() * 4.5
    tints[i] = Math.random()
    seeds[i] = Math.random()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 1))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOffset: { value: 0 },
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: 0.7 },
    },
  })
  const object = new THREE.Points(geometry, material)
  object.frustumCulled = false

  return {
    object,
    update(state: StarsState, time: number) {
      /* 3 unidades de mundo ao longo da página inteira: lento o bastante
         para não virar chuva. */
      material.uniforms.uOffset.value = state.progress * 3.0
      material.uniforms.uTime.value = time
      material.uniforms.uOpacity.value = state.opacity
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
