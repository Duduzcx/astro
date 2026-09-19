/**
 * Tabelas de scroll da cena. Só números e funções puras: nada de three.js,
 * nada de DOM. É o que permite testar a amostragem sem navegador.
 */

export type Keyframes = Array<[number, number, number, number, number, number, number]>

/**
 * Keyframes de scroll: [progresso da página, dispersão, x (fração da meia
 * largura), y, escala, opacidade]. Casados com a ordem das seções em App.tsx:
 * hero apagado (foguete), serviços com o planeta na borda direita, manifesto
 * com o planeta no centro, missão reagrupada à direita, equipe com campo ralo (os cards precisam de silêncio atrás) e
 * rodapé reagrupado no centro.
 */
export const KEYFRAMES: Keyframes = [
  /* Hero: campo apagado. Quem está na tela é o foguete e as estrelas. */
  [0.0, 0.05, 1.05, 0.0, 1.4, 0.0, 0],
  [0.045, 0.05, 1.05, 0.0, 1.4, 0.0, 0],
  /* Serviços e Integrações são o desfile de mundos (TriScene), o alvo
     ainda não apareceu. */
  [0.24, 0.05, 1.05, 0.0, 1.4, 0.0, 0],
  /* Manifesto: o alvo chega pela direita e para inteiro à direita do
     centro, onde fica durante a faixa de vídeo... */
  [0.275, 0.05, 0.45, 0.0, 1.12, 1.0, 0],
  /* ...e na Missão ("Seu negócio em novas órbitas", 0.334 a 0.383 nesta
     largura), ao lado do texto, inteiro, por um instante. */
  [0.334, 0.05, 0.45, 0.05, 1.15, 1.0, 0],
  [0.346, 0.05, 0.45, 0.05, 1.15, 1.0, 0],
  /* A supernova ali mesmo, à vista: a estrela agoniza, estoura, a onda
     de choque e a ejeta se abrem e o remanescente fica brilhando até a
     seção acabar. A opacidade é quem apaga o remanescente. */
  [0.378, 1.0, 0.45, 0.12, 1.35, 0.85, 0],
  [0.388, 1.0, 0.45, 0.16, 1.4, 0.0, 0],
  /* Invisível: troca de forma aqui, ninguém vê a costura. */
  [0.39, 0.9, 0.5, 0.0, 0.5, 0.0, 1],
  /* Buraco negro nasce pequeno nos Resultados (0.386 a 0.438), cresce
     engolindo os detritos e fica pelos Projetos inteiros. */
  [0.4, 0.6, 0.5, 0.0, 0.55, 0.55, 1],
  [0.425, 0.05, 0.5, 0.0, 0.85, 0.62, 1],
  [0.46, 0.05, 0.5, 0.0, 1.0, 0.6, 1],
  /* ...e pela chamada e o começo do Processo, crescendo devagar. */
  [0.65, 0.05, 0.5, 0.0, 1.08, 0.6, 1],
  [0.675, 0.06, 0.5, 0.0, 1.08, 0.5, 1],
  [0.7, 0.9, 0.0, 0.0, 1.35, 0.22, 1],
  [0.72, 0.9, 0.0, 0.0, 1.35, 0.0, 1],
  /* Invisível de novo: o campo vira poeira dourada de estrela. */
  [0.73, 0.9, 0.0, 0.0, 1.35, 0.0, 2],
  [0.76, 0.9, 0.0, 0.0, 1.35, 0.22, 2],
  [0.885, 0.9, 0.0, 0.0, 1.35, 0.22, 2],
  /* A poeira condensa: uma estrela nasce durante o contato... */
  /* No vão entre a coluna de texto e o card do formulário — atrás do card ela
     ficaria escondida. */
  [0.905, 0.06, 0.0, 0.1, 0.52, 0.6, 2],
  [0.935, 0.05, 0.0, 0.05, 0.56, 0.75, 2],
  /* ...e explode à vista quando o fechamento entra (0.933): o morph 2 para 3
     agrupado É a detonação — os triângulos voam do corpo para as cascas. */
  [0.946, 0.08, 0.0, -0.2, 0.92, 1.0, 3],
  /* ...e se dissipa antes do rodapé (o Contato acaba em 0.975 nesta
     largura): a supernova é da página final, não do fim do site. Cauda
     plana e apagada: no pé da página o scroll treme, e apagado nada
     muda de tamanho. */
  [0.958, 0.08, 0.0, -0.35, 0.95, 0.9, 3],
  [0.974, 0.08, 0.0, -0.45, 0.95, 0.0, 3],
  [1.0, 0.08, 0.0, -0.45, 0.95, 0.0, 3],
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
export const FIELD_OPACITY = 0.05

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
  /* Cobertura, não tamanho aparente. A 1,12 da meia largura o astro era mais
     largo que a própria tela: boa parte do disco, do halo e da coroa era
     rasterizada fora do quadro, pixel pago e jogado fora. A 0,9 ele continua
     enchendo a tela nas linhas de auge (várias passam de 1,15 de escala) e o
     motor deixa de pintar o que ninguém vê. */
  const radius = Math.min(0.9 * halfWidth, 0.54 * halfHeight)
  const scale = radius / OBJECT_RADIUS
  /* O disco é inclinado, então a caixa dele nasce torta; um empurrão pequeno
     recentraliza. Menor que antes porque o objeto encolheu: a mesma correção
     em fração da meia largura deslocava demais. */
  const x = 0.0

  /* Trechos medidos em telas de rolagem, não em fração da página: 6% de uma
     página de 25.000px são 1.500px, e o objeto ainda estaria brilhando muito
     depois do hero. */
  const screen = stage / maxScroll
  const takeoff = takeoffSpan(screen)

  return [
    /* Hero: campo apagado, foguete na plataforma. */
    [0.0, 0.05, x, 0.1, scale * 1.1, 0.0, 0],
    [takeoff, 0.05, x, 0.1, scale * 1.1, 0.0, 0],
    /* Serviços e Integrações são o desfile de mundos; o alvo chega no
       Manifesto, vindo de baixo... */
    [0.215, 0.05, x, -0.8, scale * 1.1, 0.0, 0],
    /* Teto de escala do celular: medido, o brilho do Sol cobria 94% da
       largura da tela e engolia o título. A 0,62 ele ocupa uns dois
       terços, que é o que deixa o astro grande sem virar fundo. */
    [0.24, 0.05, x, 0.0, scale * 0.8, 0.85, 0],
    /* ...e fica inteiro até a Missão (0.268 a 0.307 nesta largura). */
    [0.268, 0.05, x, 0.0, scale * 0.8, 0.85, 0],
    [0.278, 0.05, x, 0.0, scale * 0.8, 0.85, 0],
    /* A supernova na Missão, à vista; o remanescente apaga com a
       opacidade antes da seção acabar. */
    /* Mais larga que antes: a explosão é a cena mais complexa da página
       e num trecho curto ela passava em dois ou três frames de scroll, o
       que lê como corte, não como explosão. */
    [0.312, 0.95, 0.0, 0.08, scale * 0.8, 0.7, 0],
    /* A opacidade desta linha não é FIELD_OPACITY, e é de propósito. Com
       0,05 aqui, as três linhas seguidas chapadas prendiam a tangente em
       zero e a apagada do Sol caía de 0,70 para 0,05 em 83px de rolagem —
       1,2 quadro renderizado num flique. Era literalmente um corte, e é a
       dureza que o cliente descreve. Com 0,34 a apagada passa a ocupar de
       0,312 a 0,33, três vezes mais. A linha NÃO se move: 0,318 é a troca de
       astro e é regra. E quem esconde a costura da troca é o mix em 0,95,
       não a opacidade — com ele a troca de forma é 5% visível. */
    [0.318, 0.95, 0.0, 0.04, scale * 1.05, 0.34, 1],
    [0.33, 0.95, 0.0, 0.0, scale * 1.25, FIELD_OPACITY, 1],
    /* Troca de astro com o campo quase invisível, ninguém vê a costura. */
    /* Troca de astro antecipada. O morph é amortecido como todo o resto, e
       levava perto de um segundo de rolagem para convergir de 0 para 1: a
       presença do disco depende dele, então o buraco negro entrava fraco e
       só ficava inteiro depois. Trocando aqui, com o campo disperso em 0,95,
       a costura não aparece e ele chega em 0,34 já convergido. */
    [0.334, 0.95, 0.0, 0.0, scale * 1.25, FIELD_OPACITY, 1],
    /* Buraco negro: nasce nos Resultados e cresce, mas o auge fica na
       chamada (0.473 a 0.496) e no começo do Processo, que é onde a tela
       do celular está aberta — em Resultados e Projetos os cards ocupam
       a largura inteira e o disco ficava escondido atrás deles. */
    /* Opacidade bem acima da anterior: a 0,4 o disco ficava translúcido e
       o buraco negro lia como mancha, não como objeto. */
    /* A saída era um degrau: de opacidade cheia em 0,52 para o campo
       disperso em 0,55, com a escala saltando junto. Em três centésimos de
       página isso passa em poucos quadros de rolagem e lê como falha, não
       como dissolução. Agora a dispersão começa antes e a opacidade desce
       em dois tempos. */
    /* A dissolução era 0,6 aqui, e a presença do disco é multiplicada por
       1 - (dissolução - 0,25) / 0,6: o anel nascia a 42% de força e só
       chegava inteiro depois. Lia como demora e tranco. A 0,22 ele já entra
       com presença cheia e cresce só em escala. */
    [0.34, 0.22, 0.0, -0.1, scale * 0.6, 0.55, 1],
    [0.36, 0.1, 0.0, -0.05, scale * 0.95, 0.75, 1],
    [0.46, 0.08, 0.0, 0.04, scale * 1.05, 0.95, 1],
    [0.5, 0.08, 0.0, 0.04, scale * 1.15, 1.0, 1],
    [0.53, 0.35, 0.0, 0.02, scale * 1.28, 0.8, 1],
    [0.57, 0.7, 0.0, 0.0, scale * 1.4, 0.45, 1],
    [0.6, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 1],
    /* Disperso e quase invisível, o campo vira poeira dourada de estrela. */
    [0.65, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 2],
    [0.875, 0.95, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 2],
    /* A poeira condensa: uma estrela nasce durante o contato... */
    /* A estrela que precede a explosão nasce maior e mais acesa: antes ela
       mal aparecia, e sem ela a detonação chega sem preparo. */
    [0.9, 0.07, 0.0, 0.15, scale * 0.9, 0.95, 2],
    [0.925, 0.05, 0.0, 0.05, scale * 1.2, 1.0, 2],
    /* ...e explode à vista quando "A sua operação tem a resposta" entra
       (0.935): o morph 2 para 3 agrupado É a detonação. */
    [0.935, 0.08, 0.0, -0.1, scale * 1.55, 1.0, 3],
    /* Daqui até o fim tudo é idêntico. No pé da página o scroll treme, e com
       a cauda plana a tremida não vira mudança de tamanho. */
    /* Apaga antes do rodapé (o Contato acaba em 0.958 nesta largura). */
    /* Segura a cheia até quase o fim do Contato. A janela é curta por
       obrigação (a supernova não pode passar do rodapé), então o jeito de
       ela ser percebida é ficar grande e opaca dentro dela, não durar mais. */
    [0.946, 0.08, 0.0, -0.3, scale * 1.7, 1.0, 3],
    [0.958, 0.08, 0.0, -0.4, scale * 1.5, 0.0, 3],
    [1.0, 0.08, 0.0, -0.4, scale, 0.0, 3],
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

/**
 * Inclinação de Fritsch e Carlson num nó interno.
 *
 * Ela escolhe a tangente que faz a curva passar pelas âncoras sem nunca
 * ultrapassá-las: onde os dois trechos vizinhos sobem, a inclinação é uma
 * média harmônica ponderada dos dois; onde eles mudam de sentido, ou onde um
 * deles é plano, a inclinação é zero e o nó vira um extremo. É essa segunda
 * regra que protege a tabela, que tem máximos locais de propósito — a escala
 * da supernova chega a 1,70 em 0,946 e volta — e trechos deliberadamente
 * chapados, onde um spline comum inventaria uma barriga.
 */
function inclinacao(pA: number, pB: number, pC: number, hA: number, hB: number) {
  const dA = (pB - pA) / hA
  const dB = (pC - pB) / hB
  if (dA * dB <= 0) return 0
  const wA = 2 * hB + hA
  const wB = hB + 2 * hA
  return (wA + wB) / (wA / dA + wB / dB)
}

/** Um canal interpolado entre duas linhas, com as vizinhas ditando as tangentes. */
function canal(
  table: Keyframes,
  i: number,
  campo: number,
  h: number,
  h00: number,
  h10: number,
  h01: number,
  h11: number,
) {
  const pB = table[i][campo]
  const pC = table[i + 1][campo]
  /* Nas pontas a tangente é a do próprio trecho: a curva entra e sai reta, em
     vez de inventar uma inclinação a partir de um vizinho que não existe. */
  const hA = i > 0 ? table[i][0] - table[i - 1][0] || 1 : h
  const hC = i + 2 < table.length ? table[i + 2][0] - table[i + 1][0] || 1 : h
  const mB = i > 0 ? inclinacao(table[i - 1][campo], pB, pC, hA, h) : (pC - pB) / h
  const mC =
    i + 2 < table.length ? inclinacao(pB, pC, table[i + 2][campo], h, hC) : (pC - pB) / h
  return h00 * pB + h10 * h * mB + h01 * pC + h11 * h * mC
}

/**
 * Amostra a tabela no progresso dado.
 *
 * A versão anterior aplicava smoothstep DENTRO de cada trecho, com o tempo
 * local reiniciando em zero a cada linha. O efeito é pior que um canto: a
 * derivada fica exatamente zero dos DOIS lados de toda âncora, então o
 * movimento freia até parar em cada linha da tabela e arranca de novo. Numa
 * sequência de linhas próximas, como a explosão do Sol, isso lê como uma
 * série de trancos — era essa a dureza.
 *
 * Aqui a curva é um Hermite cúbico com tangentes limitadas pelo critério de
 * monotonicidade. A velocidade passa contínua de um trecho para o outro, as
 * âncoras continuam sendo respeitadas ao pixel, e nenhum valor ultrapassa o
 * intervalo entre duas linhas vizinhas — o que importa porque a opacidade e a
 * escala têm mínimos e máximos que um spline solto estouraria.
 */
export function sampleKeyframes(table: Keyframes, progress: number): Sample {
  const clamped = Math.min(Math.max(progress, 0), 1)
  let index = 0
  while (index < table.length - 2 && table[index + 1][0] < clamped) index += 1
  const from = table[index]
  const to = table[index + 1]
  const h = to[0] - from[0] || 1
  const s = Math.min(Math.max((clamped - from[0]) / h, 0), 1)
  const s2 = s * s
  const s3 = s2 * s
  const h00 = 2 * s3 - 3 * s2 + 1
  const h10 = s3 - 2 * s2 + s
  const h01 = -2 * s3 + 3 * s2
  const h11 = s3 - s2
  const em = (campo: number) => canal(table, index, campo, h, h00, h10, h01, h11)
  return {
    mix: em(1),
    x: em(2),
    y: em(3),
    scale: em(4),
    opacity: em(5),
    form: em(6),
  }
}

/**
 * Quanto da página a decolagem ocupa: 90% de uma tela de rolagem, com teto
 * para página curta. `screen` é a altura do palco dividida pelo scroll
 * máximo, o mesmo número que a tabela do celular usa.
 */
export function takeoffSpan(screen: number) {
  /* Dois terços de tela em vez de nove décimos: a subida acontece em menos
     rolagem, então lê como foguete que sai, e não como foguete que sobe
     devagar enquanto o visitante trabalha para empurrá-lo. */
  return Math.min(screen * 0.62, 0.12)
}

export type RocketWindow = { visible: boolean; lift: number; thrust: number }

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

/**
 * Foguete em função do progresso. `lift` vai de 0 (na plataforma) a 1 (fora
 * da tela) com ease-in: começa devagar e acelera, como uma decolagem. O
 * empuxo sobe rápido no início e cai a zero quando o foguete some.
 */
export function rocketWindow(progress: number, takeoff: number): RocketWindow {
  const t = Math.min(Math.max(progress / takeoff, 0), 1)
  /* A curva era t ao quadrado puro: o foguete saía do repouso com derivada
     zero e o primeiro terço da rolagem quase não o movia — lia como preso.
     Agora um pouco de impulso inicial somado à mesma aceleração, e um
     amaciamento no fim para ele não bater no topo. */
  const lift = t * t * (0.82 + 0.18 * (2.0 - t)) * smooth(0, 0.06, t) + t * 0.12 * (1 - t)
  const thrust = smooth(0, 0.08, t) * (1 - smooth(0.88, 1, t))
  return { visible: t < 1, lift, thrust: t >= 1 ? 0 : thrust }
}

/**
 * Quanto o planeta já se despedaçou, lido do estado do campo: inteiro
 * enquanto os triângulos estão agrupados, em pedaços conforme dispersam.
 * Vale só enquanto a forma é o planeta; virou outro astro, sumiu.
 */
export function planetBreak(mix: number, form: number) {
  /* Faixa larga: a explosão inteira (agonia, estouro, remanescente) cabe
     na dispersão do campo, em vez de acabar com o campo pela metade. */
  const scatter = smooth(0.08, 0.92, mix)
  const gone = Math.min(Math.max(form, 0), 1)
  return Math.min(1, scatter + gone)
}

/** Peso da forma 1 (buraco negro) para o `form` interpolado. */
export function holePresence(form: number) {
  return 1 - Math.min(Math.abs(form - 1), 1)
}

/** Peso da forma 3 (supernova) para o `form` interpolado. */
export function novaPresence(form: number) {
  return Math.min(Math.max(form - 2, 0), 1)
}
