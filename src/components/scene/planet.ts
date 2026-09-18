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
const KIND_RIM: Record<PlanetKind, number> = { target: 1.1, earth: 1.5, gas: 0.8, rock: 0.45, ice: 0.7 }
/** Raio da casca da atmosfera em relação ao planeta: fina, como a de verdade. */
const KIND_SHELL: Record<PlanetKind, number> = { target: 1.07, earth: 1.055, gas: 1.05, rock: 1.03, ice: 1.04 }
const KIND_ATMOSPHERE: Record<PlanetKind, string> = {
  target: '#6aa0ff',
  earth: '#5f9dff',
  gas: '#e8c9a0',
  rock: '#e0a070',
  ice: '#a9c8ff',
}
/** Quem tem nuvens. */
const KIND_CLOUDS: Record<PlanetKind, boolean> = { target: true, earth: true, gas: false, rock: false, ice: false }
/** Névoa da atmosfera sobre a superfície, perto da borda. */
const KIND_HAZE: Record<PlanetKind, number> = { target: 0.35, earth: 0.42, gas: 0.22, rock: 0.1, ice: 0.2 }
/**
 * Relevo tirado da própria fotografia: num mundo rochoso o claro e o escuro
 * do mapa são, em boa parte, altura (cume claro, vale escuro, borda de
 * cratera acesa de um lado). Um Sobel na luminância vira gradiente, o
 * gradiente vira normal, e a luz da cena passa a bater nas montanhas em vez
 * de num adesivo. Zero no gigante gasoso (nuvem não tem relevo) e na Terra,
 * que tem mapa normal de verdade.
 */
const KIND_PHOTO_RELIEF: Record<PlanetKind, number> = { target: 0, earth: 0, gas: 0, rock: 1, ice: 0.7 }

/* Raio casado com a casca do corpo dos triângulos (0,6 a 0,66). */
const RADIUS = 0.62
const CLOUDS = 0.632

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
  varying vec3 vTangentV;
  varying vec3 vBitangentV;
  varying vec3 vObj;
  varying vec3 vViewPos;
  varying vec2 vUv;
#ifndef PHOTO_ONLY
  ${SIMPLEX_NOISE}
#endif
  void main() {
    vUv = uv;
    vec3 p = position;
#ifndef PHOTO_ONLY
    float chunk = snoise(position * 2.2 + 7.0) * 0.5 + 0.5;
    float burst = uBreak * uBreak;
    p += normal * (0.15 + 0.85 * chunk) * burst * 0.7;
#endif
    vObj = position;
    vNormalV = normalize(normalMatrix * normal);
    /* Quadro tangente analítico da esfera: T ao longo da longitude (u
       crescente), B = N × T ao longo da latitude (v crescente, norte). */
    vec3 tObj = normalize(vec3(position.z, 0.0, -position.x) + vec3(1e-5, 0.0, 0.0));
    vTangentV = normalize(normalMatrix * tObj);
    vBitangentV = normalize(normalMatrix * cross(normalize(position), tObj));
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
  uniform sampler2D uMap;
  uniform sampler2D uNight;
  uniform float uHasMap;
  uniform float uHasNight;
  uniform sampler2D uNormal;
  uniform float uHasNormal;
  uniform vec2 uMapTexel;
  uniform float uPhotoRelief;
  uniform sampler2D uSpecular;
  uniform float uHasSpecular;
  uniform sampler2D uClouds;
  uniform float uHasClouds;
  uniform vec3 uLightLocal;
  uniform vec3 uRingNormal;
  uniform float uRingShadow;
  uniform float uCloudShift;
  uniform vec3 uHaze;
  uniform float uHazeStrength;
  uniform vec3 uTint;
  uniform vec3 uToonA;
  uniform vec3 uToonB;
  uniform vec3 uToonC;
  uniform float uToonBands;
  varying vec3 vNormalV;
  varying vec3 vTangentV;
  varying vec3 vBitangentV;
  varying vec3 vObj;
  varying vec3 vViewPos;
  varying vec2 vUv;
#ifndef PHOTO_ONLY
  ${SIMPLEX_NOISE}
#endif
  ${PERTURB}

  void main() {
#ifndef PHOTO_ONLY
    vec3 q = vObj / ${RADIUS.toFixed(2)};
#endif
    vec3 albedo;
    float centerLum = 0.0;
    float height = 0.0;
    float relief = 1.0;
    float water = 0.0;
    float land = 1.0;

#ifdef TOON
    /* Rampa chapada, sem textura nenhuma.
       As faixas vêm da latitude em degraus duros; as manchas, de dois senos
       de baixa frequência. É o oposto de posterizar uma fotografia: aqui não
       há detalhe fotográfico para brigar com o traço, então o chapado lê como
       decisão de arte e não como imagem estragada. */
    float lat = vUv.y;
    float t;
    if (uToonBands > 0.5) {
      /* Faixas com duas frequências: uma larga que dá a estrutura e uma fina
         que quebra a regularidade, senão o planeta vira papel listrado. Seis
         degraus em vez de quatro, e a borda de cada degrau acompanha um
         pixel de tela, então o corte fica limpo em qualquer tamanho. */
      /* Três frequências e uma ondulação em longitude. A terceira quebra a
         repetição que duas ainda deixavam ver, e a ondulação faz a faixa
         serpentear como jato atmosférico em vez de correr reta como listra
         de papel. Dez degraus em vez de seis: a borda continua limpa porque
         cada uma acompanha um pixel de tela. */
      float wave = sin(vUv.x * 6.2831853 * 2.0 + lat * 9.0) * 0.045;
      /* Turbulência de fronteira. As faixas de um gigante de verdade não
         correm retas: elas se enrolam onde uma encosta na outra, e o meio de
         cada faixa fica liso. Aqui a longitude empurra a latitude com força
         proporcional à proximidade da borda do degrau, então a costura
         ondula e o miolo não. É o que separa listra de papel de atmosfera. */
      float pre = sin((lat + wave) * uToonBands * 3.14159265) * 0.5 + 0.5;
      float nearEdge = 1.0 - abs(fract(pre * 10.0) - 0.5) * 2.0;
      float curl = sin(vUv.x * 6.2831853 * 5.0 - lat * 21.0 + uTime * 0.04) * 0.021
                 + sin(vUv.x * 6.2831853 * 9.0 + lat * 33.0 - uTime * 0.02) * 0.009;
      float lw = lat + wave + curl * nearEdge;
      float wide = sin(lw * uToonBands * 3.14159265);
      float fine = sin(lw * uToonBands * 2.7 + 1.3) * 0.28;
      float micro = sin(lw * uToonBands * 6.3 + 2.1) * 0.07;
      float stripes = (wide + fine + micro) * 0.5 + 0.5;
      float scaled = stripes * 10.0;
      float soft = max(fwidth(scaled) * 0.8, 0.015);
      t = (floor(scaled) + smoothstep(0.5 - soft, 0.5 + soft, fract(scaled))) / 10.0;
    } else {
      /* Mundo rochoso em degraus.
         Antes eram dois tons separados por uma fronteira macia, e o
         resultado era uma bola de uma cor só: sem escalas diferentes de
         mancha, não há superfície, só silhueta. Agora são duas escalas de
         planície somadas, quantizadas em cinco tons — os mesmos degraus
         limpos dos gigantes, com a borda acompanhando um pixel de tela. */
      float m1 = sin(vUv.x * 6.2831853 * 3.0 + lat * 5.0) * 0.5
               + sin(lat * 7.0 - vUv.x * 6.2831853 * 1.5) * 0.5;
      float m2 = sin(vUv.x * 6.2831853 * 7.0 - lat * 13.0) * 0.3
               + sin(lat * 17.0 + vUv.x * 6.2831853 * 4.0) * 0.22;
      float rock = (m1 + m2) * 0.42 + 0.5;
      float scaledR = clamp(rock, 0.0, 1.0) * 5.0;
      float softR = max(fwidth(scaledR) * 0.8, 0.02);
      t = (floor(scaledR) + smoothstep(0.5 - softR, 0.5 + softR, fract(scaledR))) / 5.0;
      /* Crateras: o produto de dois senos de alta frequência dá uma grade de
         manchas, e um anel em vez de um disco é o que lê como cratera e não
         como pinta. O aro claro fica do lado da luz, o vale escuro do outro. */
      float cr = sin(vUv.x * 6.2831853 * 9.0 + 1.7) * sin(lat * 27.0 + 0.4);
      float ring = smoothstep(0.72, 0.84, cr) - smoothstep(0.9, 0.99, cr);
      t = clamp(t - ring * 0.3, 0.0, 1.0);
    }
    albedo = mix(uToonA, uToonB, clamp(t, 0.0, 1.0));
    /* Um leve gradiente dentro da faixa: chapado total lê como adesivo. */
    albedo *= 0.92 + 0.16 * (1.0 - abs(lat * 2.0 - 1.0));
    /* A mancha. Todo gigante gasoso de ilustração tem uma: é ela que dá
       identidade ao planeta e prova que ele gira, porque entra e sai de
       vista. Elipse achatada, borda macia, fora do equador. */
    /* Só o gigante de faixas estreitas leva a mancha. Ela é assinatura de um
       planeta, não de uma categoria: em Saturno virava um borrão vermelho no
       alto, que é o oposto do pálido que ele deveria ser. */
    if (uToonBands > 9.5) {
      vec2 spot = vec2((fract(vUv.x + 0.22) - 0.5) * 2.4, (lat - 0.63) * 7.0);
      float mark = smoothstep(1.0, 0.25, length(spot));
      albedo = mix(albedo, uToonB * 0.82 + vec3(0.12, 0.03, 0.0), mark * 0.75);
    }
    /* Calota clara nos polos: num disco chapado é ela que devolve a leitura
       de esfera, no lugar do sombreado que a foto trazia. */
    float cap = smoothstep(0.84, 0.98, abs(lat * 2.0 - 1.0));
    albedo = mix(albedo, uToonC, cap);
    relief = 0.0;
#else
    if (uHasMap > 0.5) {
      /* Fotografia: a cor vem do mapa, um pouco mais clara para compensar
         o escurecimento de borda. Sem relevo: a foto já traz o sombreado, e
         derivada de uma amostra bilinear é constante por texel — vira
         mosaico na tela. */
      vec3 photo = texture2D(uMap, vUv).rgb * uTint;
      /* A luminância do centro fica guardada: o Sobel abaixo precisa dela e
         esta amostra já foi paga. */
      centerLum = dot(photo, vec3(0.299, 0.587, 0.114));
      if (uKind > 1.5 && uKind < 2.5) {
        /* Gigante fotografado: as faixas tremem de leve, como nuvens que
           correm em latitudes diferentes; a foto deixa de ser um adesivo. */
        /* Sem ruído simplex aqui: com PHOTO_ONLY o gerador procedural não é
           compilado, e três senos de frequências primas dão a mesma
           sensação de faixa que corre por um custo muito menor. */
        float shimmer =
          sin(vUv.y * 46.0 + uTime * 0.31) * 0.5 +
          sin(vUv.y * 113.0 - vUv.x * 4.0 + uTime * 0.17) * 0.3 +
          sin(vUv.y * 7.0 + vUv.x * 2.0 - uTime * 0.09) * 0.2;
        photo *= 1.0 + 0.05 * shimmer;
      }
      /* Curva de contraste suave: a fotografia crua da NASA é plana de
         propósito (é dado, não imagem), e sobre um fundo escuro isso lê
         como lavado. Um S leve nos meios-tons devolve o oceano fundo e as
         nuvens brancas sem estourar nem escurecer os polos. */
      photo = clamp(photo * 1.06, 0.0, 1.0);
      photo = photo * photo * (3.0 - 2.0 * photo) * 0.55 + photo * 0.45;
      albedo = photo;
      relief = 0.0;
      if (uHasSpecular > 0.5) {
        /* Máscara de água fotografada: branco onde o mar reflete. */
        water = smoothstep(0.25, 0.75, texture2D(uSpecular, vUv).r);
        land = 1.0 - water;
      } else if (uKind > 0.5 && uKind < 1.5) {
        /* Terra: água é onde o azul manda. */
        water = smoothstep(0.02, 0.14, photo.b - max(photo.r, photo.g));
        land = 1.0 - water;
      } else if (uKind > 3.5) {
        water = 0.35;
      }
    }
#endif
#ifndef PHOTO_ONLY
    else if (uKind < 0.5) {
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
#endif

    vec3 geomN = normalize(vNormalV);
#ifdef STYLIZED
    /* Ilustração: a normal é a da esfera, e ponto. O relevo tirado da
       fotografia por Sobel custa quatro amostras e, numa textura de 1k
       vista num celular, o que ele entrega é papa — é parte do que fazia a
       cena ler como maquete, não como desenho. */
    vec3 n = geomN;
#else
    vec3 n = perturb(vViewPos, geomN, height, relief * uDetail);
    if (uPhotoRelief > 0.0 && uHasMap > 0.5) {
      /* Sobel na luminância do mapa, em passos de dois texels: menor que
         isso pega o ruído da compressão, maior borra a cratera. O eixo x
         corre com a longitude, o y com a latitude — o mesmo quadro
         tangente do mapa normal. */
      /* Diferença adiantada em vez de central: duas amostras no lugar de
         quatro, aproveitando a luminância do centro, que já foi paga para
         pintar a cor. O gradiente sai deslocado meio texel — invisível num
         relevo que já é uma aproximação — e o dobro compensa a metade do
         intervalo, para a força do relevo continuar a mesma. */
      vec2 e = uMapTexel * 2.0;
      float lx = dot(texture2D(uMap, vUv + vec2(e.x, 0.0)).rgb * uTint, vec3(0.299, 0.587, 0.114));
      float ly = dot(texture2D(uMap, vUv + vec2(0.0, e.y)).rgb * uTint, vec3(0.299, 0.587, 0.114));
      vec2 grad = vec2(lx - centerLum, ly - centerLum) * 2.0;
      /* Perto dos polos o mapa equirretangular espreme a longitude: sem
         isso o relevo vira um redemoinho nas calotas. */
      float squeeze = max(sqrt(max(1.0 - vObj.y * vObj.y / ${(RADIUS * RADIUS).toFixed(4)}, 0.0)), 0.25);
      grad.x *= squeeze;
      vec3 t = normalize(vTangentV);
      vec3 b = normalize(vBitangentV);
      n = normalize(geomN - (t * grad.x + b * grad.y) * uPhotoRelief * 26.0);
      /* Oclusão de vale: onde o gradiente é forte, a luz indireta não
         chega tanto. É o que dá fundo às crateras. */
      albedo *= 1.0 - min(length(grad) * uPhotoRelief * 2.2, 0.45);
    }
    if (uHasNormal > 0.5) {
      /* Relevo fotografado: o mapa normal, em espaço tangente, com o verde
         apontando para o sul (convenção DirectX), daí o sinal em y. */
      vec3 nm = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
      nm.xy *= vec2(2.4, -2.4);
      n = normalize(normalize(vTangentV) * nm.x + normalize(vBitangentV) * nm.y + geomN * max(nm.z, 0.2));
    }
#endif
    vec3 v = normalize(-vViewPos);
    float facing = dot(n, uLight);
    float dayGeom = smoothstep(-0.18, 0.4, dot(geomN, uLight));
#ifdef STYLIZED
    /* Luz em degraus. Um desenho não usa mil tons entre o dia e a noite:
       escolhe uns poucos e mantém limpa a borda entre eles. O fwidth dá a
       largura de um pixel na tela, então o degrau sai macio o bastante para
       não serrilhar e duro o bastante para ler como traço. */
    float ramp = clamp(facing * 0.5 + 0.5, 0.0, 1.0);
    float scaled = ramp * 4.0;
    float soft = max(fwidth(scaled) * 1.1, 0.02);
    float band = floor(scaled) + smoothstep(0.5 - soft, 0.5 + soft, fract(scaled));
    float day = smoothstep(0.06, 0.94, clamp(band / 4.0, 0.0, 1.0));

    /* A fotografia da NASA é plana de propósito, porque é dado. Ilustração
       pede cor decidida: satura, e depois reduz a paleta a poucos tons.

       A posterização é o que separa desenho de foto com filtro. Sem ela a
       faixa de luz não lê, porque a variação da própria textura é maior que
       o degrau da luz. A borda de cada tom acompanha um pixel de tela
       (fwidth), então o resultado é chapado sem serrilhar. */
    float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
    albedo = clamp(mix(vec3(lum), albedo, 1.55), 0.0, 1.0);
    vec3 tone = albedo * 6.0;
    vec3 toneSoft = max(fwidth(tone), vec3(0.03));
    vec3 posterized =
      floor(tone) + smoothstep(vec3(0.5) - toneSoft, vec3(0.5) + toneSoft, fract(tone));
    albedo = mix(albedo, posterized / 6.0, 0.72);

    vec3 color = albedo * (0.14 + 0.86 * day);
    /* A sombra vai para o azul, não para o cinza. É o que separa desenho
       de foto subexposta. */
    color = mix(color, color * vec3(0.40, 0.52, 0.88), (1.0 - day) * 0.85);
    /* Um só clarão na água, e mesmo assim em degrau: três potências e um
       ponto minúsculo não sobrevivem a uma tela de mão. */
    float glint = smoothstep(0.86, 0.94, max(dot(reflect(-uLight, n), v), 0.0));
    color += vec3(1.0, 0.97, 0.9) * glint * water * dayGeom * 0.5;
#else
    float day = smoothstep(-0.18, 0.4, facing);
    vec3 color = albedo * (0.05 + 0.95 * day);
    /* O lado da noite não é breu: a luz das estrelas e do céu enche de um
       azul frio e fraco, e a esfera continua lendo como esfera. */
    color += albedo * vec3(0.3, 0.45, 0.8) * 0.09 * (1.0 - day);

    /* Especular só na água e no gelo: um clarão apertado do sol e um
       lustro largo e fraco em volta. */
    float rv = max(dot(reflect(-uLight, n), v), 0.0);
    /* Brilho do sol na água: um ponto apertado e muito claro, como o glint
       que aparece em foto de órbita, mais um lustro largo em volta. */
    /* Três chamadas de pow eram três pares de log e exp na unidade de funções
       especiais da GPU. Elevando ao quadrado em cadeia, os mesmos três
       lóbulos saem de oito multiplicações e nenhuma função transcendente.
       Os expoentes andam de 190, 42 e 7 para 192, 48 e 8: dentro do lóbulo
       especular essa diferença não tem como ser vista. */
    float r2 = rv * rv;
    float r4 = r2 * r2;
    float r8 = r4 * r4;
    float r64 = r8 * r8;
    r64 = r64 * r64;
    r64 = r64 * r64;
    float r192 = r64 * r64 * r64;
    float r48 = r8 * r8 * r8 * r8 * r8 * r8;
    float spec = (r192 * 1.5 + r48 * 0.35 + r8 * 0.06) * water * dayGeom;
    color += spec;
#endif

    /* Escurecimento nas bordas: uma esfera de verdade não é chapada. */
    /* Escurecimento nas bordas por tipo: forte no rochoso (poeira seca
       some no ângulo rasante), fraco no gigante, onde a atmosfera espessa
       espalha luz de volta e a borda continua legível. */
    float limbFloor = (uKind > 1.5 && uKind < 2.5) ? 0.68 : 0.45;
    float limb = mix(limbFloor, 1.0, pow(max(dot(geomN, v), 0.0), 0.55));
    color *= limb;

#ifndef NO_CLOUD_SHADOW
    if (uHasClouds > 0.5) {
      /* Sombra das nuvens no chão: de cada ponto da superfície, sobe na
         direção da luz até a casca das nuvens e pergunta se há nuvem lá.
         A casca é mais alta que a real, para a sombra deslocar o bastante
         para ler. As nuvens giram mais rápido que o chão, então o ponto
         vai para o quadro delas antes da amostra. LOD fixo: sombra é
         macia e a costura de longitude não risca. */
      vec3 L = uLightLocal;
      float b = dot(vObj, L);
      float s = -b + sqrt(max(b * b + ${((RADIUS * 1.045) ** 2).toFixed(5)} - ${(RADIUS * RADIUS).toFixed(5)}, 0.0));
      vec3 c = vObj + L * s;
      float ca = cos(uCloudShift);
      float sa = sin(uCloudShift);
      vec3 cc = vec3(c.x * ca - c.z * sa, c.y, c.x * sa + c.z * ca);
      vec2 cuv = vec2(
        fract(atan(cc.z, -cc.x) / 6.2831853),
        1.0 - acos(clamp(cc.y / length(cc), -1.0, 1.0)) / 3.14159265
      );
      float shadow = smoothstep(0.1, 0.7, textureLod(uClouds, cuv, 2.0).r);
      color *= 1.0 - shadow * 0.45 * dayGeom;
    }
#endif

    /* Névoa: perto da borda, o ar entre nós e o chão espalha luz do dia. */
    float haze = pow(1.0 - max(dot(geomN, v), 0.0), 2.4) * uHazeStrength * (0.1 + 0.9 * dayGeom);
    color += uHaze * haze;
    /* Espalhamento de borda: no limbo iluminado o ar acende numa linha
       fina e clara, a assinatura de esfera com atmosfera vista do espaço. */
    float rimScatter = pow(1.0 - max(dot(geomN, v), 0.0), 7.0) * smoothstep(-0.1, 0.5, dot(geomN, uLight));
    color += mix(uHaze, vec3(1.0), 0.5) * rimScatter * uHazeStrength * 1.6;

#ifdef STYLIZED
    /* Contorno de luz no lado iluminado: a linha fina e clara que todo
       desenho bom usa para separar o objeto do fundo. Estreita e forte,
       porque é ela que dá a silhueta. */
    float ink = pow(1.0 - max(dot(geomN, v), 0.0), 4.0) * smoothstep(-0.25, 0.45, dot(geomN, uLight));
    color += mix(uHaze, vec3(1.0), 0.65) * ink * 0.9;
#endif
    /* Sombra do anel sobre o planeta.
       É o detalhe que falta num Saturno desenhado: sem ela o anel parece
       flutuar recortado, e com ela o conjunto vira um objeto só. Do ponto da
       superfície sobe um raio na direção da luz até o plano do anel; se ele
       cruzar dentro da coroa, aquele ponto está na sombra.
       O plano não é o equador — o anel tem inclinação própria — então a
       normal dele chega já convertida para o referencial que gira com a
       superfície, do mesmo jeito que a luz. Vem por uniform e não por
       define, para não partir o programa em duas variantes: Marte e Júpiter
       passam por aqui com uRingShadow em zero e o desvio é coerente. */
    if (uRingShadow > 0.5) {
      float denom = dot(uLightLocal, uRingNormal);
      if (abs(denom) > 0.001) {
        float tr = -dot(vObj, uRingNormal) / denom;
        if (tr > 0.0) {
          float rr = length(vObj + uLightLocal * tr);
          float inner = ${(RADIUS * 1.45).toFixed(3)};
          float outer = ${(RADIUS * 2.35).toFixed(3)};
          float band = smoothstep(inner, inner + 0.03, rr) * smoothstep(outer, outer - 0.03, rr);
          /* A grande falha deixa passar luz: a mesma que o anel desenha. */
          float u = (rr - inner) / (outer - inner);
          float gap = smoothstep(0.585, 0.605, u) * smoothstep(0.685, 0.665, u);
          color *= 1.0 - band * (1.0 - gap) * 0.5;
        }
      }
    }

#ifdef TOON
    /* Fresnel de borda, o acabamento que separa ilustração caprichada de
       desenho chapado. São duas camadas: um fio muito apertado, quase
       branco, exatamente na quina iluminada, e uma faixa larga e fria que
       desce pelo lado escuro e desenha a curvatura contra o preto do espaço.
       Sem a segunda, o planeta some no fundo do lado da sombra e o disco
       perde volume. */
    float fres = 1.0 - max(dot(geomN, v), 0.0);
    float lit = smoothstep(-0.35, 0.35, dot(geomN, uLight));
    float edge = pow(fres, 9.0) * lit;
    /* A faixa fria tem que morar na borda, não no disco inteiro. A 2,6 de
       expoente ela cobria metade do planeta e lavava as faixas de cor. */
    float sweep = pow(fres, 5.0) * (0.25 + 0.75 * lit);
    color += vec3(1.0, 0.96, 0.9) * edge * 1.35;
    color += vec3(0.42, 0.62, 1.0) * sweep * 0.3;
    /* Segundo tom de sombra. Entre o dia e a noite entrava um degrau só, e o
       lado escuro virava um bloco chapado sem volume. Esta faixa fria e um
       pouco mais escura mora no meio do terminador e devolve a curvatura sem
       acender nada. */
    float shade = smoothstep(0.58, 0.14, day);
    color = mix(color, color * vec3(0.74, 0.8, 0.97), shade * 0.28);
#endif

    /* Terminador quente: a luz rasante esquenta a linha entre dia e noite. */
    float twilight = smoothstep(0.25, 0.0, abs(dot(geomN, uLight))) * dayGeom;
    color += vec3(0.9, 0.45, 0.2) * twilight * 0.12;

    if (uHasNight > 0.5) {
      /* Luzes de cidade fotografadas, só do lado da noite. */
      vec3 night = texture2D(uNight, vUv).rgb;
      color += night * vec3(1.0, 0.85, 0.6) * (1.0 - dayGeom) * 1.4;
    }
#ifndef PHOTO_ONLY
    else if (uKind > 0.5 && uKind < 1.5) {
      float cities = smoothstep(0.5, 0.8, snoise(q * 26.0)) * smoothstep(0.55, 0.75, snoise(q * 4.0 + 2.0)) * land;
      color += vec3(1.0, 0.78, 0.45) * cities * (1.0 - dayGeom) * 1.1;
    }
#endif

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
  varying vec2 vUv;
  void main() {
    vUv = uv;
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
  uniform sampler2D uMap;
  uniform float uHasMap;
  varying vec3 vNormalV;
  varying vec3 vObj;
  varying vec3 vView;
  varying vec2 vUv;
#ifndef PHOTO_ONLY
  ${SIMPLEX_NOISE}
#endif
  void main() {
    float cover;
    /* Deriva própria da massa de nuvem. A casca já gira mais rápido que o
       chão, mas girar é transladar: o desenho continua o mesmo e o olho
       percebe um adesivo passando. Aqui a amostra anda devagar nos dois
       eixos, com períodos diferentes, então a formação se desfaz e se refaz
       enquanto passa. */
    vec2 drift = vec2(uTime * 0.0032, sin(uTime * 0.043) * 0.0045);
    /* Além de transladar, a massa gira em torno de si. O deslocamento em
       longitude cresce com a latitude, como acontece num planeta em rotação
       diferencial: o equador anda mais que os polos, e o resultado é a
       formação se torcendo enquanto atravessa em vez de deslizar rígida. */
    float shear = (0.5 - abs(vUv.y - 0.5)) * 2.0;
    vec2 swirl = vec2(sin(uTime * 0.021 + vUv.y * 9.0) * 0.006 * shear, 0.0);
    vec2 cuv = vUv + drift + swirl;
#ifdef PHOTO_ONLY
    cover = smoothstep(0.08, 0.7, texture2D(uMap, cuv).r);
#else
    vec3 q = vObj / ${CLOUDS.toFixed(3)};
    if (uHasMap > 0.5) {
      cover = smoothstep(0.08, 0.7, texture2D(uMap, cuv).r);
    } else {
      float c = fbm(q * 2.8 + vec3(uTime * 0.01, 0.0, 0.0)) + 0.15 * fbm3(q * 5.5);
      cover = smoothstep(0.08, 0.5, c);
    }
#endif
    vec3 n = normalize(vNormalV);
    float day = smoothstep(-0.2, 0.35, dot(n, uLight));
    float limb = mix(0.6, 1.0, pow(max(dot(n, normalize(vView)), 0.0), 0.5));
#ifdef PHOTO_ONLY
    /* Volume nas nuvens. Uma casca de opacidade só lê como decalque; o que
       faz nuvem parecer nuvem é o topo receber sol e a base ficar cinza.
       O gradiente da própria cobertura (diferença entre dois texels no
       sentido da luz) diz qual lado da massa está virado para o sol: onde
       ela cresce na direção da luz, é encosta iluminada. */
    vec2 e = vec2(0.0018, 0.0009);
    float up = smoothstep(0.08, 0.7, texture2D(uMap, cuv + e * uLight.xy * 2.0).r);
    float slope = clamp((up - cover) * 6.0, -1.0, 1.0);
    vec3 lit = vec3(1.0, 0.99, 0.97);
    vec3 shade = vec3(0.52, 0.58, 0.72);
    vec3 body = mix(shade, lit, clamp(0.55 + slope * 0.45, 0.0, 1.0));
    /* Massa densa fica mais branca; véu fino deixa passar o azul do mar. */
    body = mix(body, lit, smoothstep(0.35, 0.95, cover) * 0.6);
    /* Terminador quente: no pôr do sol visto de cima a nuvem fica dourada. */
    float dusk = smoothstep(0.42, 0.0, abs(dot(n, uLight))) * day;
    body = mix(body, vec3(1.0, 0.76, 0.5), dusk * 0.5);
    vec3 color = body * (0.1 + 0.9 * day) * limb;
    /* Véu fino some, massa fecha: mais contraste entre nuvem e céu limpo. */
    float alpha = smoothstep(0.02, 0.55, cover) * 0.95 * uOpacity * (1.0 - uBreak);
#else
    vec3 color = vec3(1.0, 0.99, 0.98) * (0.12 + 0.88 * day) * limb;
    float alpha = cover * 0.9 * uOpacity * (1.0 - uBreak);
#endif
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
  uniform float uShell;
  uniform vec3 uColor;
  uniform vec3 uLight;
  varying vec3 vNormalV;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(vView);
    /* Na casca (BackSide) o cosseno entre normal e visada vai de 0 na
       borda externa até cosLimb na borda do planeta; entre os dois é a
       faixa de atmosfera que se vê: clara colada ao limbo, sumindo para
       fora em poucos por cento do raio, como a de verdade. Atrás do
       planeta a casca é ocluída pela profundidade da superfície. */
    float cosLimb = sqrt(max(1.0 - uShell * uShell, 0.0));
    float t = clamp(1.0 - abs(dot(n, v)) / cosLimb, 0.0, 1.0);
    float rim = (pow(1.0 - t, 2.4) * 0.9 + smoothstep(0.14, 0.0, t) * 0.5) * uRim;
    float day = 0.15 + 0.85 * smoothstep(-0.4, 0.45, dot(n, uLight));
    /* Espalhamento para a frente: onde a visada quase encontra o sol, o ar
       acende muito mais. É o que faz o arco azul do lado iluminado ser bem
       mais vivo que o do lado da sombra. */
    day *= 1.0 + 1.1 * pow(max(dot(normalize(vView), uLight), 0.0), 3.0);
    float heat = sin(clamp(uBreak, 0.0, 1.0) * 3.14159);
    vec3 color = mix(uColor, vec3(1.0, 0.75, 0.45), heat);
    float alpha = rim * day * uOpacity * (1.0 - uBreak) + pow(1.0 - t, 1.5) * heat * heat * 2.0 * uOpacity * uRim;
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
  uniform sampler2D uMap;
  uniform float uHasMap;
  varying vec2 vPos;
  varying vec3 vNormalV;
  ${SIMPLEX_NOISE}
  void main() {
    float r = length(vPos);
    float t = (r - ${(RADIUS * 1.45).toFixed(3)}) / ${(RADIUS * 0.9).toFixed(3)};
    float bands;
    float alpha;
    if (uHasMap > 0.5) {
      /* Fotografia de anel: cor e alfa ao longo do raio. */
      vec4 ringTex = texture2D(uMap, vec2(clamp(t, 0.0, 1.0), 0.5));
      bands = dot(ringTex.rgb, vec3(0.333));
      alpha = ringTex.a * 0.95;
    } else {
      /* Anel vetorial: aros concêntricos em degrau, não faixas com ruído.
         O ruído dava textura de fotografia; aqui cada aro é um valor chapado
         e a borda entre eles acompanha um pixel de tela, então a divisão sai
         afiada em qualquer tamanho e nunca serrilha. A grande falha fica
         aberta de verdade, como vazio, não como faixa mais fraca — é ela que
         faz o anel parecer desenhado e não pintado. */
      float rings = t * 15.0;
      float soft = max(fwidth(rings) * 0.75, 0.02);
      float step9 = floor(rings) + smoothstep(0.5 - soft, 0.5 + soft, fract(rings));
      /* Três larguras de aro em vez de duas alternadas: o anel deixa de ter
         ritmo de código de barras e passa a ter aros largos, finos e vazios,
         que é como ele se parece de verdade. */
      float slot = fract(step9 / 3.0);
      bands = slot < 0.34 ? 1.0 : (slot < 0.67 ? 0.62 : 0.34);
      float gapA = smoothstep(0.585, 0.605, t) * smoothstep(0.685, 0.665, t);
      float gapB = smoothstep(0.335, 0.35, t) * smoothstep(0.392, 0.377, t);
      /* Bordas mais macias e um aro tênue para fora do limite: um anel de
         verdade não termina numa linha, ele rareia. Sem isso o disco tem
         recorte de adesivo justo onde encontra o preto. */
      float edgeIn = smoothstep(0.0, 0.075, t);
      float edgeOut = smoothstep(1.06, 0.9, t);
      float veil = smoothstep(0.86, 1.0, t) * smoothstep(1.12, 1.0, t) * 0.22;
      alpha = edgeIn * edgeOut * bands * 0.92 + veil;
      alpha *= 1.0 - gapA - gapB * 0.75;
    }
    /* Sombra do planeta: pontos atrás dele em relação à luz, dentro do
       cilindro de sombra, escurecem. */
    vec3 p = vec3(vPos, 0.0);
    float along = dot(p, uLightLocal);
    float off = length(p - uLightLocal * along);
    float shadow = smoothstep(${(RADIUS * 1.02).toFixed(3)}, ${(RADIUS * 0.94).toFixed(3)}, off) * step(along, 0.0);
    float lit = 0.4 + 0.6 * abs(dot(normalize(vNormalV), uLight));
    /* Cor variando ao longo do raio: os aros de dentro são mais quentes e
       densos, os de fora esfriam e ficam acinzentados. Com uma cor só, o
       anel inteiro lia como uma peça de plástico; é o degradê radial que faz
       o olho ler gelo e poeira em distâncias diferentes. */
    vec3 warm = mix(vec3(0.84, 0.73, 0.55), vec3(0.99, 0.95, 0.86), bands);
    /* O extremo frio era quase chumbo, e o anel lia como peça de outro
       material colada num planeta dourado. Esfriar aqui é perder saturação,
       não virar cinza azulado: os aros de fora ficam creme claro. */
    vec3 cool = mix(vec3(0.72, 0.68, 0.6), vec3(0.95, 0.93, 0.88), bands);
    vec3 color = mix(warm, cool, smoothstep(0.25, 0.95, t)) * lit * (1.0 - shadow * 0.85);
    if (uHasMap > 0.5) color = texture2D(uMap, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb * lit * (1.0 - shadow * 0.85);
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

/**
 * Uma textura em degraus: a leve chega primeiro e a pesada substitui quando
 * carrega. Uma string só é um degrau só.
 */
export type MapTiers = string | { low: string; high: string }

export type PlanetMaps = {
  /** Mapa de cor equirretangular. */
  map?: MapTiers
  /** Luzes noturnas (Terra). */
  night?: MapTiers
  /** Nuvens em cinza (branco = nuvem). */
  clouds?: MapTiers
  /** Anel: uma faixa RGBA ao longo do raio. */
  ring?: MapTiers
  /** Relevo em espaço tangente, verde para o sul (Terra). */
  normal?: MapTiers
  /** Máscara de água: branco onde o mar reflete (Terra). */
  specular?: MapTiers
}

const textureLoader = new THREE.TextureLoader()
const ANISOTROPY = 16

function prepare(texture: THREE.Texture) {
  /* Sem gestão de cor: o shader trabalha em sRGB de ponta a ponta. */
  texture.colorSpace = THREE.NoColorSpace
  texture.anisotropy = ANISOTROPY
  return texture
}

/** Carrega o degrau leve, aplica, e depois o pesado por cima. */
function loadMap(tiers: MapTiers, onLoad: (texture: THREE.Texture) => void): THREE.Texture[] {
  const loaded: THREE.Texture[] = []
  if (typeof tiers === 'string') {
    loaded.push(textureLoader.load(tiers, (texture) => onLoad(prepare(texture))))
    return loaded
  }
  loaded.push(
    textureLoader.load(tiers.low, (low) => {
      onLoad(prepare(low))
      loaded.push(
        textureLoader.load(tiers.high, (high) => {
          onLoad(prepare(high))
          low.dispose()
        }),
      )
    }),
  )
  return loaded
}

export function createPlanet({
  segments,
  kind = 'target',
  spin = 0.04,
  ring = false,
  detail = 1,
  relief = 1,
  maps,
  tint = '#ffffff',
  stylized = false,
  toon,
  lightClouds = false,
  warm,
}: {
  segments: number
  kind?: PlanetKind
  /** Rotação em rad/s. A Terra, enorme, gira bem mais devagar. */
  spin?: number
  /** Anel inclinado, para o gigante gasoso. */
  ring?: boolean
  /** Força do relevo por derivadas de tela (procedural); 0 desliga. */
  detail?: number
  /** Força do relevo tirado da fotografia; 0 desliga. */
  relief?: number
  /** Texturas fotográficas; enquanto carregam, vale o procedural. */
  maps?: PlanetMaps
  /** Multiplica a cor do mapa (a lua vira gelo com um azul leve). */
  tint?: string
  /** Acabamento de ilustração em vez de fotografia: luz em degraus, cor
      saturada, contorno de luz, e fora o relevo por Sobel, o mapa normal, a
      sombra volumétrica de nuvem e o especular de três potências. Vale no
      celular, onde a textura é de 1k e o detalhe fotográfico vira papa. */
  stylized?: boolean
  /** Acabamento de ilustração sem fotografia: rampa de duas cores, faixas em
      degrau e calota clara. `bands` acima de zero dá o listrado de gigante
      gasoso; zero dá manchas largas de mundo rochoso. */
  toon?: { a: string; b: string; c: string; bands: number }
  /** Tira a sombra volumétrica de nuvem do código-fonte do shader. */
  lightClouds?: boolean
  /** Chamado com cada textura assim que chega: sobe para a GPU na hora,
      em vez de travar o primeiro frame em que o planeta aparece. */
  warm?: (texture: THREE.Texture) => void
}) {
  const load = (tiers: MapTiers, apply: (texture: THREE.Texture) => void) =>
    loadMap(tiers, (texture) => {
      warm?.(texture)
      apply(texture)
    })
  const object = new THREE.Group()
  const kindIndex = KIND_INDEX[kind]
  const textures: THREE.Texture[] = []
  /* Luz fixa em espaço de câmera: o terminador fica parado enquanto a
     superfície gira. */
  /* Mais de lado que de frente: o terminador aparece e a esfera ganha
     volume, em vez de um disco chapado iluminado pela câmera. */
  const light = new THREE.Vector3(-0.72, 0.38, 0.58).normalize()

  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  /* A luz no quadro local da superfície, para a sombra das nuvens. */
  const surfaceLightLocal = new THREE.Vector3()
  const surfaceQuaternion = new THREE.Quaternion()

  const surfaceGeometry = new THREE.SphereGeometry(RADIUS, segments, Math.round(segments * 0.62))
  /* Com fotografia, todo o gerador procedural (cinco oitavas de ruído por
     tipo de mundo) é código morto — mas o driver compila do mesmo jeito, e
     em ANGLE/D3D isso custa segundos na primeira pintura. O define tira o
     bloco do código-fonte. */
  const photoOnly = Boolean(maps?.map)
  const defines: Record<string, string> = {}
  if (photoOnly || toon) defines.PHOTO_ONLY = ''
  /* TOON reaproveita os caminhos de luz do STYLIZED (degrau no terminador e
     contorno na silhueta) e troca só a origem da cor. */
  if (stylized || toon) defines.STYLIZED = ''
  /* A sombra volumétrica de nuvem é meia dúzia de linhas de trigonometria
     mais uma amostra com LOD, e só a Terra a usa. Como ela já tem programa
     próprio — os mundos de passagem são toon — tirar o bloco no celular
     encolhe o shader mais pesado da página sem criar variante nova, que foi
     o erro da tentativa anterior de separar por defines. */
  if (lightClouds) defines.NO_CLOUD_SHADOW = ''
  if (toon) defines.TOON = ''
  const surfaceMaterial = new THREE.ShaderMaterial({
    defines: { ...defines },
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
      uMap: { value: null },
      uNight: { value: null },
      uHasMap: { value: 0 },
      uHasNight: { value: 0 },
      uNormal: { value: null },
      uHasNormal: { value: 0 },
      uMapTexel: { value: new THREE.Vector2(1 / 2048, 1 / 1024) },
      uPhotoRelief: { value: KIND_PHOTO_RELIEF[kind] * relief },
      uSpecular: { value: null },
      uHasSpecular: { value: 0 },
      uClouds: { value: null },
      uHasClouds: { value: 0 },
      uLightLocal: { value: surfaceLightLocal },
      uCloudShift: { value: 0 },
      uRingNormal: { value: new THREE.Vector3(0, 1, 0) },
      uRingShadow: { value: ring ? 1 : 0 },
      uHaze: { value: new THREE.Color(KIND_ATMOSPHERE[kind]) },
      uHazeStrength: { value: KIND_HAZE[kind] },
      uTint: { value: new THREE.Color(tint) },
      uToonA: { value: new THREE.Color(toon?.a ?? '#ffffff') },
      uToonB: { value: new THREE.Color(toon?.b ?? '#888888') },
      uToonC: { value: new THREE.Color(toon?.c ?? '#ffffff') },
      uToonBands: { value: toon?.bands ?? 0 },
    },
  })
  if (maps?.normal) {
    textures.push(
      ...load(maps.normal, (texture) => {
        surfaceMaterial.uniforms.uNormal.value = texture
        surfaceMaterial.uniforms.uHasNormal.value = 1
      }),
    )
  }
  if (maps?.specular) {
    textures.push(
      ...load(maps.specular, (texture) => {
        surfaceMaterial.uniforms.uSpecular.value = texture
        surfaceMaterial.uniforms.uHasSpecular.value = 1
      }),
    )
  }
  if (maps?.map) {
    textures.push(
      ...load(maps.map, (texture) => {
        surfaceMaterial.uniforms.uMap.value = texture
        surfaceMaterial.uniforms.uHasMap.value = 1
        /* O passo do Sobel é em texels, e o degrau que chega muda o
           tamanho deles: 1k, 2k, 4k ou 8k. */
        const image = texture.image as { width?: number; height?: number } | undefined
        if (image?.width && image?.height) {
          surfaceMaterial.uniforms.uMapTexel.value.set(1 / image.width, 1 / image.height)
        }
      }),
    )
  }
  if (maps?.night) {
    textures.push(
      ...load(maps.night, (texture) => {
        surfaceMaterial.uniforms.uNight.value = texture
        surfaceMaterial.uniforms.uHasNight.value = 1
      }),
    )
  }
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
      defines: maps?.clouds ? { PHOTO_ONLY: '' } : {},
      vertexShader: CLOUDS_VERTEX,
      fragmentShader: CLOUDS_FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uBreak: { value: 0 },
        uLight: { value: light },
        uMap: { value: null },
        uHasMap: { value: 0 },
      },
    })
    if (maps?.clouds) {
      const material = cloudsMaterial
      textures.push(
        ...load(maps.clouds, (texture) => {
          material.uniforms.uMap.value = texture
          material.uniforms.uHasMap.value = 1
          /* A mesma foto serve de sombra no chão. */
          surfaceMaterial.uniforms.uClouds.value = texture
          surfaceMaterial.uniforms.uHasClouds.value = 1
        }),
      )
    }
    clouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial)
    clouds.renderOrder = -2
    object.add(clouds)
    geometries.push(cloudsGeometry)
    materials.push(cloudsMaterial)
  }

  const atmosphereGeometry = new THREE.SphereGeometry(RADIUS * KIND_SHELL[kind], segments, Math.round(segments * 0.62))
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
      uShell: { value: 1 / KIND_SHELL[kind] },
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
  const ringNormal = new THREE.Vector3()
  const ringWorld = new THREE.Quaternion()
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
        uMap: { value: null },
        uHasMap: { value: 0 },
      },
    })
    if (maps?.ring) {
      const material = ringMaterial
      textures.push(
        ...load(maps.ring, (texture) => {
          material.uniforms.uMap.value = texture
          material.uniforms.uHasMap.value = 1
        }),
      )
    }
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
      /* As nuvens correm bem mais que o chão e ainda ondulam de leve num
         período próprio: a diferença entre as duas velocidades é o que faz
         o planeta parecer vivo em vez de um globo girando. */
      if (clouds) clouds.rotation.y = time * spin * 2.1 + Math.sin(time * 0.07) * 0.06
      surfaceMaterial.uniforms.uCloudShift.value = clouds ? clouds.rotation.y - surface.rotation.y : 0
      surface.getWorldQuaternion(surfaceQuaternion).invert()
      surfaceLightLocal.copy(light).applyQuaternion(surfaceQuaternion)
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
        /* E a normal do anel no espaço da superfície, para a sombra do anel
           cair certo no planeta. O anel não gira com a superfície, então
           esta conversão muda a cada quadro. */
        ringNormal.set(0, 0, 1).applyQuaternion(ringMesh.getWorldQuaternion(ringWorld))
        ringNormal.applyQuaternion(surfaceQuaternion).normalize()
        surfaceMaterial.uniforms.uRingNormal.value.copy(ringNormal)
      }
    },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
      for (const t of textures) t.dispose()
    },
  }
}
