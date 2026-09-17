import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

/**
 * A "lente": tudo o que uma câmera de cinema faz com a imagem, num passe só.
 *
 * - Vinheta e grão: os dois truques mais baratos de fotografia, e os que
 *   mais tiram o ar de render limpo demais.
 * - Profundidade de campo radial: nítido no centro, macio para os cantos,
 *   como lente aberta. Oito amostras num anel que cresce com a distância ao
 *   centro; o anel gira por pixel (hash fixo) para não deixar oito fantasmas.
 * - Dolly e aberração cromática presos à velocidade do scroll: rolando
 *   rápido a imagem fecha 3% do centro e o vermelho e o azul se separam
 *   1–2px nas bordas; parado, nada disso existe. É o que faz o scroll
 *   parecer movimento de câmera, não de página.
 *
 * Tudo aqui é leitura de textura no mesmo passe: nenhum passe de tela cheia
 * a mais foi adicionado.
 */
const FILM = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uVignette: { value: 0.3 },
    /* Grão quase invisível: acima disso, sobre fundo escuro, o ruído por
       frame lê como chuvisco de TV, não como filme. */
    uGrain: { value: 0.004 },
    uEdgeBlur: { value: 0.0 },
    uZoom: { value: 1.0 },
    uAberration: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uEdgeBlur;
    uniform float uZoom;
    uniform float uAberration;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float d = length(centered);
      /* Dolly: o quadro é amostrado mais perto do centro, então a imagem
         cresce a partir dele. Zoom para dentro nunca lê fora da textura. */
      vec2 uv = 0.5 + centered / uZoom;

      vec4 base = texture2D(tDiffuse, uv);
      vec4 c = base;

      /* Profundidade de campo: o raio do anel cresce com a distância ao
         centro numa curva côncava, então o miolo da tela fica nítido de
         verdade e só os cantos amolecem. */
      float focus = smoothstep(0.3, 0.82, d);
      float amount = focus * sqrt(focus) * uEdgeBlur;
      /* Abaixo de ~1px de raio o anel não muda nada visível e custa nove
         leituras por pixel: o miolo da tela pula o laço inteiro. */
      if (amount > 0.001) {
        float spin = hash(vUv) * 6.2831853;
        vec4 acc = c * 2.0;
        for (int i = 0; i < 8; i++) {
          float a = spin + float(i) * 0.7853982;
          acc += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * amount);
        }
        c = acc / 10.0;
      }

      /* Aberração cromática: vermelho para fora, azul para dentro, ao longo
         do raio. Zero no centro; nos cantos vale uAberration pixels. Entra
         como diferença sobre a amostra central, então onde há desfoque a
         franja se soma ao macio em vez de trazer um canal nítido de volta. */
      if (uAberration > 0.01) {
        vec2 shift = centered * (smoothstep(0.06, 0.7, d) * uAberration * 1.4) / uResolution;
        c.r += texture2D(tDiffuse, uv + shift).r - base.r;
        c.b += texture2D(tDiffuse, uv - shift).b - base.b;
      }

      c.rgb *= 1.0 - smoothstep(0.42, 0.95, d) * uVignette;
      /* Grão de filme: mora nos meios-tons e quase some no preto, que é
         onde o olho mais nota ruído; por pixel físico, fino de verdade. */
      float g = hash(gl_FragCoord.xy * 0.37 + fract(uTime * 0.37)) - 0.5;
      float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb += g * uGrain * (0.25 + 0.75 * smoothstep(0.0, 0.5, luma));
      gl_FragColor = c;
    }
  `,
}

/**
 * Bloom cinematográfico, só no desktop: o que passa do limiar (motor,
 * disco de acreção, supernova, borda da atmosfera) sangra luz. Meia
 * resolução, três níveis. No celular a cena desenha direto.
 */
export function createPostFx(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
  /* No celular entra só o bloom: é ele que faz o Sol, o motor e o disco de
     acreção brilharem de verdade. O passe de filme (vinheta, grão, desfoque
     de borda, aberração) é uma leitura de textura por pixel e mais oito no
     anel — luxo de desktop. */
  light = false,
) {
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType })
  const composer = new EffectComposer(renderer, target)
  composer.setPixelRatio(renderer.getPixelRatio())
  composer.addPass(new RenderPass(scene, camera))
  /* Limiar alto: só o que é luz de verdade sangra (motor, disco, núcleo da
     supernova, limbo da atmosfera). Abaixo disso o casco branco virava neve.
     Raio mais largo e força contida: o halo se espalha macio em vez de
     engrossar o branco em volta da fonte. */
  /* Um quarto da resolução: o halo é macio por natureza, e a pirâmide de
     cinco níveis a meia resolução era o passe mais caro da lente. */
  /* No celular o bloom trabalha num oitavo da resolução: o halo é macio
     por natureza e ninguém vê a diferença, mas são cinco desfoques numa
     pirâmide, e cada nível custa preenchimento. */
  const divisor = light ? 16 : 4
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width / divisor, height / divisor),
    /* O limiar alto de antes existia para conter o clarão do hero, que
       ocupava proporcionalmente muito mais tela no celular. Esse clarão não
       existe mais lá, e o que sobrou eram astros sem brilho: o Sol, o disco
       de acreção e a supernova não passavam do limiar e saíam chapados.
       Força maior e limiar mais baixo devolvem o halo a quem precisa dele. */
    light ? 0.4 : 0.36,
    light ? 0.58 : 0.62,
    light ? 0.94 : 0.92,
  )
  composer.addPass(bloom)
  const film = light ? null : new ShaderPass(FILM)
  if (film) {
    film.uniforms.uResolution.value.set(width, height)
    composer.addPass(film)
  }
  return {
    /**
     * `edgeBlur` é o raio do anel nos cantos, em fração da tela. `rush`
     * (0..1) é a velocidade do scroll já amortecida: vira dolly de até 3% e
     * até 2px de franja nos cantos.
     */
    render(time: number, edgeBlur = 0, rush = 0) {
      if (film) {
        const k = Math.min(rush * 1.6, 1)
        film.uniforms.uTime.value = time
        film.uniforms.uEdgeBlur.value = edgeBlur
        film.uniforms.uZoom.value = 1 + 0.03 * k
        film.uniforms.uAberration.value = 2.0 * k
      }
      composer.render()
    },
    setSize(w: number, h: number) {
      composer.setSize(w, h)
      bloom.resolution.set(w / divisor, h / divisor)
      film?.uniforms.uResolution.value.set(w, h)
    },
    setStrength(value: number) {
      bloom.strength = value
    },
    dispose() {
      composer.dispose()
      target.dispose()
    },
  }
}
