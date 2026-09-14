import * as THREE from 'three'

/**
 * O halo da supernova: um billboard aditivo por trás das cascas de
 * triângulos, com núcleo branco, coroa do ouro ao violeta e raios que
 * respiram. É o bloom sem passe de bloom — um disco, um shader barato:
 * sem ruído por pixel, porque o halo cobre a tela inteira no fim da página
 * e cada instrução ali custa fill rate no celular.
 *
 * `presence` é o peso da forma 3; `mix` a dispersão do campo. O halo só
 * existe com a supernova formada e agrupada.
 */
export type NovaState = {
  x: number
  y: number
  scale: number
  opacity: number
  presence: number
  mix: number
}

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float a = atan(p.y, p.x);
    float breath = 1.0 + 0.05 * sin(uTime * 0.8);
    float rn = clamp(d / breath, 0.0, 1.0);
    /* Do centro para fora: branco, ouro, laranja, magenta, violeta. */
    vec3 gold = vec3(1.0, 0.82, 0.4);
    vec3 fire = vec3(1.0, 0.48, 0.31);
    vec3 magenta = vec3(0.88, 0.31, 0.79);
    vec3 violet = vec3(0.55, 0.42, 1.0);
    vec3 color = mix(gold, fire, smoothstep(0.1, 0.4, rn));
    color = mix(color, magenta, smoothstep(0.4, 0.75, rn));
    color = mix(color, violet, smoothstep(0.75, 1.0, rn));
    /* Raios: faixas por ângulo, torcidas por uma onda lenta. */
    float twist = sin(a * 5.0 + uTime * 0.3) * 2.0 + sin(a * 3.0 - uTime * 0.2) * 1.2;
    float rays = pow(0.5 + 0.5 * sin(a * 18.0 + twist), 5.0);
    float corona = pow(max(0.0, 1.0 - rn), 2.6) * (0.55 + 0.45 * rays);
    /* Núcleo pequeno e contido: o fechamento em branco passa por cima. */
    float core = smoothstep(0.09, 0.0, d);
    color = mix(color, vec3(1.0), core);
    float alpha = core * 0.7 + corona * 0.75;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

export function createNova() {
  /* Círculo, não plano: fora do raio 1 o alfa já é zero, e os cantos do
     plano eram 21% de pixels pintados à toa. */
  const geometry = new THREE.CircleGeometry(1, 48)
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
  })
  const object = new THREE.Mesh(geometry, material)
  /* Atrás dos triângulos: as cascas ficam por cima do brilho. */
  object.renderOrder = -1

  return {
    object,
    update(state: NovaState, time: number) {
      const grouped = 1 - Math.min(Math.max((state.mix - 0.25) / 0.6, 0), 1)
      const strength = state.opacity * state.presence * grouped
      object.visible = strength > 0.01
      if (!object.visible) return
      object.position.set(state.x, state.y, 0)
      object.scale.setScalar(state.scale * 2.7)
      material.uniforms.uTime.value = time
      material.uniforms.uOpacity.value = strength * 0.9
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
