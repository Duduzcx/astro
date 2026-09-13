/**
 * Tabelas de scroll da cena. Só números e funções puras: nada de three.js,
 * nada de DOM. É o que permite testar a amostragem sem navegador.
 */

export type Keyframes = Array<[number, number, number, number, number, number, number]>

/**
 * Keyframes de scroll: [progresso da página, dispersão, x (fração da meia
 * largura), y, escala, opacidade]. Casados com a ordem das seções em App.tsx:
 * hero à direita, serviços à esquerda, manifesto disperso, missão reagrupada à
 * direita, equipe com campo ralo (os cards precisam de silêncio atrás) e
 * rodapé reagrupado no centro.
 */
export const KEYFRAMES: Keyframes = [
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
  [0.328, 0.05, 0.55, 0.0, 0.9, 1.0, 1],
  [0.372, 0.06, 0.55, 0.0, 0.9, 1.0, 1],
  [0.41, 0.9, 0.0, 0.0, 1.35, 0.22, 1],
  [0.445, 0.9, 0.0, 0.0, 1.35, 0.22, 1],
  [0.47, 0.9, 0.0, 0.0, 1.35, 0.0, 1],
  /* Invisível de novo: o campo vira poeira dourada de estrela. */
  [0.5, 0.9, 0.0, 0.0, 1.35, 0.0, 2],
  [0.53, 0.9, 0.0, 0.0, 1.35, 0.22, 2],
  [0.885, 0.9, 0.0, 0.0, 1.35, 0.22, 2],
  /* A poeira condensa: uma estrela nasce durante o contato... */
  /* No vão entre a coluna de texto e o card do formulário — atrás do card ela
     ficaria escondida. */
  [0.91, 0.06, 0.0, 0.1, 0.52, 0.6, 2],
  [0.942, 0.05, 0.0, 0.0, 0.56, 0.75, 2],
  /* ...e explode à vista quando o fechamento entra (0.933): o morph 2 para 3
     agrupado É a detonação — os triângulos voam do corpo para as cascas. */
  [0.952, 0.08, 0.0, -0.35, 0.92, 1.0, 3],
  /* Cauda plana: ver a nota da tabela do celular. */
  [0.968, 0.08, 0.0, -0.62, 0.95, 0.8, 3],
  [1.0, 0.08, 0.0, -0.62, 0.95, 0.8, 3],
]

/**
 * Mesmo valor do breakpoint `lg` do Tailwind, que é onde o menu vira hambúrguer.
 * A cena e o CSS precisam trocar de composição na mesma largura: abaixo disso
 * valem a tabela do hero e as placas de contraste marcadas com `lg:hidden`;
 * acima, o layout de duas colunas e a tabela de página inteira.
 */
export const MOBILE_BREAKPOINT = 1024

/** Raio do objeto agrupado em unidades de mundo: o anel externo para em 1.64. */
export const OBJECT_RADIUS = 1.64

/**
 * Opacidade do objeto no hero e depois dele. Com a clareira do shader abrindo
 * espaço para o texto, o anel pode brilhar de verdade na primeira dobra; do
 * hero para baixo ele recua para grão de fundo atrás dos cards.
 */
export const HERO_OPACITY = 0.95
export const FIELD_OPACITY = 0.1

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
export function mobileKeyframes(
  halfWidth: number,
  halfHeight: number,
  maxScroll: number,
  stage: number,
): Keyframes {
  /* Encosta nas laterais sem sangrar muito, com teto de altura para não virar
     uma faixa gorda demais em tela comprida. */
  const radius = Math.min(1.12 * halfWidth, 0.62 * halfHeight)
  const scale = radius / OBJECT_RADIUS
  /* O disco é inclinado, então a caixa dele nasce torta; um empurrão pequeno
     recentraliza. Menor que antes porque o objeto encolheu: a mesma correção
     em fração da meia largura deslocava demais. */
  const x = 0.0

  /* Trechos medidos em telas de rolagem, não em fração da página: 6% de uma
     página de 25.000px são 1.500px, e o objeto ainda estaria brilhando muito
     depois do hero. */
  const screen = stage / maxScroll
  /* O planeta fica inteiro por meia tela de rolagem e leva mais uma tela
     para se desfazer — antes ele começava a dispersar quase no primeiro
     toque. */
  const hold = Math.min(screen * 0.5, 0.12)
  const settle = Math.min(screen * 1.5, 0.2)

  return [
    /* Hero: planeta atrás do texto, um pouco acima do centro para o arco de
       cima aparecer no vão entre o menu e o título. */
    [0.0, 0.03, x, 0.32, scale, HERO_OPACITY, 0],
    [hold, 0.05, x, 0.32, scale, HERO_OPACITY, 0],
    /* Ao sair da dobra ele se espalha e recua para textura de fundo. */
    [settle, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 0],
    [0.16, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 0],
    /* Troca de astro com o campo quase invisível, ninguém vê a costura. */
    [0.185, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 1],
    /* Buraco negro formado enquanto "Seu negócio em novas órbitas" está na
       tela (a Missão ocupa 0.222 a 0.294 nesta largura). */
    [0.232, 0.12, 0.0, -0.15, scale * 0.95, 0.38, 1],
    [0.292, 0.12, 0.0, -0.15, scale * 0.95, 0.38, 1],
    [0.335, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 1],
    [0.55, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 1],
    /* Disperso e quase invisível, o campo vira poeira dourada de estrela. */
    [0.62, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 2],
    [0.875, 0.95, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 2],
    /* A poeira condensa: uma estrela nasce durante o contato... */
    [0.905, 0.07, 0.0, 0.15, scale * 0.58, 0.55, 2],
    [0.938, 0.05, 0.0, 0.05, scale * 0.62, 0.72, 2],
    /* ...e explode à vista quando "A sua operação tem a resposta" entra
       (0.935): o morph 2 para 3 agrupado É a detonação. */
    [0.948, 0.08, 0.0, -0.3, scale * 0.95, 1.0, 3],
    /* Daqui até o fim tudo é idêntico. No pé da página o scroll treme, e com
       a cauda plana a tremida não vira mudança de tamanho. */
    [0.962, 0.08, 0.0, -0.5, scale, 0.85, 3],
    [1.0, 0.08, 0.0, -0.5, scale, 0.85, 3],
  ]
}

export type Sample = {
  mix: number
  x: number
  y: number
  scale: number
  opacity: number
  form: number
}

export function sampleKeyframes(table: Keyframes, progress: number): Sample {
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
