/**
 * A rolagem guiada pelo próprio navegador.
 *
 * Os efeitos presos ao scroll — o texto que acende, a palavra gigante que
 * deriva, o trilho do processo, o recuo do hero, a foto e o vídeo em
 * paralaxe, a barra de progresso e o fio de energia — eram todos medidos
 * por JavaScript: a cada quadro o framer-motion lia a caixa de cada alvo,
 * convertia em progresso, passava por uma mola e escrevia um estilo.
 * Medido na rolagem do desktop, isso somava quase três segundos de
 * `measure` por minuto, e cada leitura no meio do quadro obrigava o
 * navegador a fechar o layout antes da hora.
 *
 * Com `animation-timeline` o navegador faz a mesma conta sozinho, no
 * compositor quando é transform ou opacidade, sem medir nada e sem um
 * ouvinte de scroll. O visual é o mesmo; a mola deixou de ser necessária
 * porque a posição já chega suavizada pelo Lenis.
 *
 * Quem não tem o recurso (Firefox, Safari antes do 26) fica com a versão em
 * JavaScript, que é exatamente a de antes: mesma cena, mesmo efeito, só
 * mais cara. E quem pediu menos movimento também fica com ela, de
 * propósito: a regra global de reduced-motion do index.css encurta toda
 * animação para 0,01ms, e numa animação guiada pela rolagem isso a
 * deixaria presa no estado final, com o hero apagado.
 */
export const rolagemNativa =
  typeof window !== 'undefined' &&
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('animation-timeline: view()') &&
  CSS.supports('animation-range: contain 12% contain 92%') &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches
