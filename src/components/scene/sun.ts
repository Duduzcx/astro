import * as THREE from 'three'
import { SIMPLEX_NOISE } from './glsl'

/**
 * O Sol: a estrela que o campo de triângulos abraça e que explode na
 * Missão. Tudo procedural, em quatro camadas presas ao mesmo grupo:
 *
 *   1. fotosfera: esfera com granulação animada (células claras e veias
 *      escuras, o domínio advectado devagar por outro ruído, como
 *      convecção), manchas escuras com penumbra fibrosa em duas faixas de
 *      latitude, fáculas em volta delas, escurecimento de limbo real
 *      (I(μ) ≈ 1 − 0,6·(1 − μ)) e uma rampa de cor do branco-amarelo no
 *      centro ao laranja-vermelho na borda;
 *   2. cromosfera: uma casca fina (BackSide) colada ao limbo, vermelha e
 *      brilhante, com espículas ruidosas — é o que o bloom pega primeiro;
 *   3. coroa: um disco aditivo atrás, com serpentinas radiais animadas por
 *      ruído e queda rápida, para o Sol não flutuar num fundo preto seco;
 *   4. proeminências: fitas em arco, ancoradas no limbo, subindo e caindo
 *      no tempo, aditivas e ruidosas nas bordas.
 *
 * `break` é o relógio da explosão, o mesmo do planeta que ele substitui:
 * até SUN_BURST a estrela desestabiliza (granulação acelera, o brilho
 * pulsa, rachaduras brancas abrem, a coroa infla); em SUN_BURST a
 * superfície clareia e voa em pedaços, e o explosion.ts assume os
 * destroços. Rolar para trás desfaz tudo, porque nada guarda estado.
 */
export type SunState = {
  x: number
  y: number
  z?: number
  scale: number
  opacity: number
  break: number
}

/* Raio casado com a casca do corpo dos triângulos (0,6 a 0,66). */
export const SUN_RADIUS = 0.62
/** Ponto do relógio `break` em que a superfície estoura. */
export const SUN_BURST = 0.3

const R = SUN_RADIUS
const BURST = SUN_BURST.toFixed(2)

const SURFACE_VERTEX = /* glsl */ `
  uniform float uBreak;
  uniform float uTime;
  varying vec3 vNormalV;
  varying vec3 vObj;
  varying vec3 vViewPos;
  ${SIMPLEX_NOISE}
  void main() {
    vObj = position;
    float unstable = smoothstep(0.0, ${BURST}, uBreak);
    float burst = smoothstep(${BURST}, ${BURST} + 0.35, uBreak);
    /* Antes do estouro a superfície arfa; no estouro voa em pedaços
       (ruído grosso por vértice, ao longo da normal). */
    float heave = snoise(position * 5.0 + uTime * 1.5) * 0.035 * unstable * unstable;
    float chunk = snoise(position * 2.2 + 7.0) * 0.5 + 0.5;
    vec3 p = position + normal * (heave + (0.2 + 0.8 * chunk) * burst * burst * 0.8);
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
  varying vec3 vNormalV;
  varying vec3 vObj;
  varying vec3 vViewPos;
  ${SIMPLEX_NOISE}
  #ifdef LIGHT
  #define GRAIN(p) fbm3(p)
  #else
  #define GRAIN(p) fbm(p)
  #endif

  /* Rampa térmica: umbra, brasa, laranja, ouro, branco-amarelo. */
  vec3 ramp(float h) {
    vec3 umbra = vec3(0.2, 0.035, 0.0);
    vec3 ember = vec3(0.85, 0.2, 0.03);
    vec3 orange = vec3(1.0, 0.5, 0.1);
    vec3 gold = vec3(1.0, 0.8, 0.32);
    vec3 white = vec3(1.0, 0.97, 0.86);
    vec3 c = mix(umbra, ember, smoothstep(0.0, 0.28, h));
    c = mix(c, orange, smoothstep(0.28, 0.52, h));
    c = mix(c, gold, smoothstep(0.52, 0.82, h));
    c = mix(c, white, smoothstep(0.82, 1.12, h));
    return c;
  }

  void main() {
    vec3 q = vObj / ${R.toFixed(2)};
    float unstable = smoothstep(0.0, ${BURST}, uBreak);
    /* O relógio da convecção: lento em paz, frenético na agonia. */
    float t = uTime * (0.07 + unstable * 0.7);

    /* Advecção: o domínio da granulação é arrastado por um campo lento,
       então as células nascem, escorrem e morrem em vez de piscar. */
    vec3 warp = vec3(
      fbm3(q * 2.5 + t * 0.4),
      fbm3(q * 2.5 + vec3(7.1, 3.3, 1.7) - t * 0.35),
      fbm3(q * 2.5 + 13.0 + t * 0.3)
    ) * 0.4;
    vec3 s = q + warp;
    /* Granulação: células claras separadas por veias escuras finas (o
       zero do ruído), mais um detalhe fino por cima. */
    float lanes = abs(snoise(s * 18.0 + t));
    float cells = smoothstep(0.0, 0.55, lanes);
    float lanes2 = abs(snoise(s * 34.0 - t * 0.7));
    float cells2 = smoothstep(0.0, 0.5, lanes2);
    float fine = GRAIN(s * 7.0 + vec3(0.0, 0.0, t * 0.5));
    float g = 0.66 + 0.16 * fine + 0.2 * cells + 0.08 * cells2;

    /* Manchas: um campo lento, em duas faixas de latitude; umbra escura,
       penumbra fibrosa em volta, fáculas claras mais longe. */
    float spotField = fbm3(q * 3.4 + vec3(3.0, 1.0, 5.0) + t * 0.03);
    float belt = smoothstep(0.08, 0.22, abs(q.y)) * smoothstep(0.62, 0.42, abs(q.y));
    float umbra = smoothstep(0.46, 0.56, spotField + 0.06 * fine) * belt;
    float penumbra = smoothstep(0.34, 0.48, spotField) * belt * (1.0 - umbra);
    penumbra *= 0.6 + 0.4 * snoise(s * 40.0);
    float plage = smoothstep(0.18, 0.34, spotField) * (1.0 - smoothstep(0.34, 0.46, spotField)) * belt * 0.25;
    float heat = g + plage - penumbra * 0.5 - umbra * 1.05;

    /* Escurecimento de limbo da fotosfera. */
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(-vViewPos);
    float mu = max(dot(n, v), 0.0);
    float limb = 0.3 + 0.7 * pow(mu, 0.55);
    heat = heat * limb + 0.05;

    /* Agonia: o brilho pulsa e rachaduras brancas abrem na crosta. */
    float pulse = 1.0 + unstable * (0.35 + 0.3 * sin(uTime * 7.0) + 0.2 * sin(uTime * 11.3 + 1.0));
    heat *= pulse;
    float crack = smoothstep(0.12, 0.0, abs(snoise(q * 4.0 + uTime * 0.6))) * unstable * unstable;
    vec3 color = ramp(heat) * (0.96 + 0.3 * unstable);
    color += vec3(1.0, 0.95, 0.8) * crack * 2.0;

    /* Estouro: clareia de vez e some enquanto os vértices voam. */
    float flash = smoothstep(${BURST} - 0.04, ${BURST} + 0.02, uBreak) * (1.0 - smoothstep(${BURST} + 0.03, ${BURST} + 0.18, uBreak));
    color = mix(color, vec3(1.0, 0.98, 0.9) * 1.25, flash);
    float alpha = uOpacity * (1.0 - smoothstep(${BURST} + 0.02, ${BURST} + 0.16, uBreak));
    gl_FragColor = vec4(color, alpha);
  }
`

const SHELL_VERTEX = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vView;
  varying vec3 vObj;
  void main() {
    vObj = position;
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

/* Cromosfera: faixa fina colada ao limbo, vermelha, com espículas. Vista de
   dentro (BackSide): o cosseno entre normal e visada vai de 0 na borda
   externa a cosLimb na borda do Sol. */
const CHROMO_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uTime;
  uniform float uUnstable;
  uniform float uShell;
  varying vec3 vNormalV;
  varying vec3 vView;
  varying vec3 vObj;
  ${SIMPLEX_NOISE}
  void main() {
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(vView);
    float cosLimb = sqrt(max(1.0 - uShell * uShell, 0.0));
    float t = clamp(1.0 - abs(dot(n, v)) / cosLimb, 0.0, 1.0);
    float spicules = 0.7 + 0.3 * snoise(vObj * 24.0 + uTime * 0.8);
    float rim = (pow(1.0 - t, 2.2) * 1.0 + smoothstep(0.12, 0.0, t) * 0.8) * spicules;
    vec3 color = mix(vec3(1.0, 0.36, 0.1), vec3(1.0, 0.7, 0.35), rim) * 1.6;
    gl_FragColor = vec4(color * rim * (1.0 + uUnstable * 0.8) * uOpacity, 1.0);
  }
`

const BILLBOARD_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/* Coroa: queda rápida a partir do limbo, com serpentinas radiais (ruído
   de baixa frequência no ângulo e coerente no raio) que respiram. */
const CORONA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uUnstable;
  uniform float uLimb;
  varying vec2 vUv;
  ${SIMPLEX_NOISE}
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float a = atan(p.y, p.x);
    float x = max(d - uLimb, 0.0) / (1.0 - uLimb);
    vec2 ring = vec2(cos(a), sin(a));
    float st = fbm3(vec3(ring * 3.5, x * 2.0 - uTime * 0.05));
    #ifndef LIGHT
    st += 0.35 * snoise(vec3(ring * 9.0, x * 3.0 + uTime * 0.08));
    #endif
    float streamers = pow(0.5 + 0.5 * st, 2.2);
    /* Raios. Antes a coroa era só um halo macio, e o que se via era o bordo
       do disco que a desenha: um círculo nítido em volta do Sol, anunciando
       que ali havia um brilho colado. Um sol de verdade manda feixes para
       fora, de comprimentos diferentes, e é isso que apaga a borda — cada
       raio termina no seu próprio ponto, então não sobra circunferência
       nenhuma para o olho seguir.
       Três frequências primas em torno do ângulo, girando devagar e em
       sentidos diferentes, para o padrão nunca fechar um ciclo visível. */
    float rays =
      0.5 + 0.5 * sin(a * 19.0 + uTime * 0.07) * 0.55
          + 0.5 * sin(a * 31.0 - uTime * 0.045) * 0.3
          + 0.5 * sin(a * 47.0 + uTime * 0.11) * 0.15;
    rays = pow(clamp(rays, 0.0, 1.0), 2.6);
    /* Os feixes nascem no limbo, não no centro, e vão mais longe que o halo. */
    float beam = exp(-x * 3.2) * rays * smoothstep(0.0, 0.08, x);
    float glow = exp(-x * 14.0) * 0.9 + exp(-x * 6.0) * 1.1 + exp(-x * 2.0) * 0.9 * (0.3 + 1.6 * streamers);
    glow += beam * 1.35;
    /* Some por completo antes da borda da malha: sem isto o disco se corta
       num anel duro, que é exatamente o que o cliente estava vendo. */
    glow *= smoothstep(1.0, 0.62, d);
    /* Dentro do disco a coroa não aparece: o Sol cobre. Só no fim, com a
       superfície indo embora, um miolo claro segura o buraco. */
    float inside = 1.0 - smoothstep(uLimb - 0.06, uLimb, d);
    glow = mix(glow, 0.55, inside);
    vec3 color = mix(vec3(1.0, 0.86, 0.6), vec3(1.0, 0.55, 0.25), smoothstep(0.0, 0.5, x));
    gl_FragColor = vec4(color * glow * (0.5 + uUnstable * 0.45) * uOpacity, 1.0);
  }
`

/* Proeminência: fita em arco no plano XY local, base no limbo em +Y, com a
   altura animada por uniform. A largura é radial, então o arco lê de
   perfil como uma alça de plasma. */
const PROMINENCE_VERTEX = /* glsl */ `
  uniform float uHeight;
  uniform float uSpan;
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float s = uv.x;
    float w = uv.y - 0.5;
    float th = (s - 0.5) * uSpan;
    float lift = sin(s * 3.14159);
    float h = uHeight * lift * (1.0 + 0.12 * sin(s * 9.0 + uTime * 1.3 + uSeed));
    float r = ${R.toFixed(2)} - 0.015 + h + w * (0.018 + 0.03 * lift);
    vec3 p = vec3(sin(th) * r, cos(th) * r, 0.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const PROMINENCE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  ${SIMPLEX_NOISE}
  void main() {
    float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
    float wisps = fbm3(vec3(vUv.x * 8.0 + uSeed, vUv.y * 3.0, uTime * 0.4));
    float body = smoothstep(0.1, 0.9, edge * 0.8 + wisps * 0.5) * smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
    vec3 color = mix(vec3(1.0, 0.22, 0.06), vec3(1.0, 0.7, 0.35), body) * 1.2;
    gl_FragColor = vec4(color * body * (0.6 + 0.4 * wisps) * uOpacity, 1.0);
  }
`

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

export function createSun({
  segments,
  lightweight = false,
}: {
  segments: number
  /** Celular e máquina fraca: menos oitavas, menos proeminências. */
  lightweight?: boolean
}) {
  const object = new THREE.Group()
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const defines = lightweight ? { LIGHT: '' } : {}

  /* 1. Fotosfera. */
  const surfaceGeometry = new THREE.SphereGeometry(R, segments, Math.round(segments * 0.62))
  const surfaceMaterial = new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    defines,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uBreak: { value: 0 },
      uOpacity: { value: 1 },
    },
  })
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial)
  /* Antes dos triângulos: com a profundidade gravada, a metade de trás da
     casca some atrás do Sol e só a crosta da frente fica. */
  surface.renderOrder = -3
  object.add(surface)
  geometries.push(surfaceGeometry)
  materials.push(surfaceMaterial)

  /* 2. Cromosfera. */
  const SHELL = 1.035
  const chromoGeometry = new THREE.SphereGeometry(R * SHELL, segments, Math.round(segments * 0.62))
  const chromoMaterial = new THREE.ShaderMaterial({
    vertexShader: SHELL_VERTEX,
    fragmentShader: CHROMO_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uOpacity: { value: 1 },
      uTime: { value: 0 },
      uUnstable: { value: 0 },
      uShell: { value: 1 / SHELL },
    },
  })
  const chromo = new THREE.Mesh(chromoGeometry, chromoMaterial)
  chromo.renderOrder = -2
  object.add(chromo)
  geometries.push(chromoGeometry)
  materials.push(chromoMaterial)

  /* 3. Coroa. */
  const CORONA_EXTENT = 2.8
  const coronaGeometry = new THREE.CircleGeometry(R * CORONA_EXTENT, 64)
  const coronaMaterial = new THREE.ShaderMaterial({
    vertexShader: BILLBOARD_VERTEX,
    fragmentShader: CORONA_FRAGMENT,
    defines,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uUnstable: { value: 0 },
      uLimb: { value: 1 / CORONA_EXTENT },
    },
  })
  const corona = new THREE.Mesh(coronaGeometry, coronaMaterial)
  corona.position.z = -R * 0.4
  corona.renderOrder = -4
  object.add(corona)
  geometries.push(coronaGeometry)
  materials.push(coronaMaterial)

  /* 4. Proeminências: ângulo no limbo, abertura, altura, ritmo, fase. */
  type Prominence = { mesh: THREE.Mesh; material: THREE.ShaderMaterial; height: number; speed: number; phase: number }
  const specs: Array<[number, number, number, number, number]> = [
    [0.7, 0.7, 0.16, 0.5, 0.0],
    [2.5, 0.55, 0.11, 0.7, 2.1],
    [4.0, 0.85, 0.2, 0.4, 4.0],
    [5.5, 0.5, 0.1, 0.9, 1.2],
  ]
  const prominences: Prominence[] = []
  const ribbon = new THREE.PlaneGeometry(1, 1, 48, 1)
  geometries.push(ribbon)
  for (const [angle, span, height, speed, phase] of specs.slice(0, lightweight ? 2 : 4)) {
    const material = new THREE.ShaderMaterial({
      vertexShader: PROMINENCE_VERTEX,
      fragmentShader: PROMINENCE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uHeight: { value: height },
        uSpan: { value: span },
        uTime: { value: 0 },
        uSeed: { value: phase * 3.7 },
        uOpacity: { value: 1 },
      },
    })
    const mesh = new THREE.Mesh(ribbon, material)
    mesh.rotation.z = angle
    mesh.frustumCulled = false
    mesh.renderOrder = -1
    object.add(mesh)
    materials.push(material)
    prominences.push({ mesh, material, height, speed, phase })
  }

  return {
    object,
    update(state: SunState, time: number) {
      object.visible = state.opacity > 0.015 && state.break < 0.999
      if (!object.visible) return
      object.position.set(state.x, state.y, state.z ?? 0)
      object.scale.setScalar(state.scale)
      const k = Math.min(Math.max(state.break, 0), 1)
      const unstable = smooth(0, SUN_BURST, k)
      /* Depois do estouro as camadas de fora somem junto com a superfície;
         a coroa fica um pouco mais, inflada, e vira a luz dos destroços. */
      const outer = 1 - smooth(SUN_BURST, SUN_BURST + 0.08, k)
      const coronaLife = 1 - smooth(SUN_BURST, SUN_BURST + 0.25, k)

      surface.rotation.y = time * 0.02
      surfaceMaterial.uniforms.uTime.value = time
      surfaceMaterial.uniforms.uBreak.value = k
      surfaceMaterial.uniforms.uOpacity.value = state.opacity

      chromo.rotation.y = surface.rotation.y
      chromoMaterial.uniforms.uTime.value = time
      chromoMaterial.uniforms.uUnstable.value = unstable
      chromoMaterial.uniforms.uOpacity.value = state.opacity * outer

      /* A coroa respira devagar e incha na agonia. */
      corona.scale.setScalar(1 + 0.03 * Math.sin(time * 0.5) + unstable * 0.5)
      coronaMaterial.uniforms.uTime.value = time
      coronaMaterial.uniforms.uUnstable.value = unstable
      coronaMaterial.uniforms.uOpacity.value = state.opacity * coronaLife

      for (const p of prominences) {
        const life = 0.5 + 0.5 * Math.sin(time * p.speed + p.phase)
        p.material.uniforms.uHeight.value = p.height * (0.35 + 0.65 * life) * (1 + unstable * 1.8)
        p.material.uniforms.uTime.value = time
        p.material.uniforms.uOpacity.value = smooth(0.08, 0.5, life) * state.opacity * outer * (1 + unstable)
        p.mesh.visible = life > 0.08
      }
    },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
    },
  }
}
