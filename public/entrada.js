/* A tela de entrada.
 *
 * Este arquivo NÃO pode voltar a ser um script inline no index.html. O CSP de
 * produção só libera inline por hash sha256, e cada edição muda o hash: o
 * navegador passa a recusar o script em silêncio, a lógica de saída nunca
 * roda e a tela fica carregando para sempre. Aconteceu, e só no ar, porque o
 * servidor local não manda CSP nenhum. Por arquivo, ele entra pelo 'self'.
 *
 * A saída tem dois marcos. O PISO existe para a abertura ler como sistema
 * subindo, e não como piscada. O outro é o primeiro quadro que a cena
 * realmente desenhou, que chega pelo evento astro:cena-pronta disparado em
 * TriScene — marco honesto: não "o script carregou", e sim "há imagem".
 *
 * Quem fecha a tela é o visitante, num botão. E o botão APARECE DE QUALQUER
 * JEITO: se a cena nunca sinalizar, o teto o traz. Não existe caminho em que
 * alguém fique presto aqui olhando uma barra.
 *
 * Nada aqui toca no #root, no React ou na cena.
 */
;(function () {
  var tela = document.getElementById('entrada')
  if (!tela) return
  var miolo = document.getElementById('entrada-miolo')
  var barra = document.getElementById('entrada-barra')
  var botao = document.getElementById('entrada-botao')
  var onda = document.getElementById('entrada-onda')

  var PISO = 2000
  /* Teto: WebGL recusado, aparelho sem contexto, erro no bundle. Passado este
     tempo o botão aparece mesmo sem a cena ter dito nada. */
  var TETO = 6500
  /* Se ninguém clicar, entra sozinho. O botão é uma porta, não um pedágio:
     quem se distraiu ou não entendeu não pode ficar preso. */
  var AUTO = 9000
  var SAIDA = 900
  /* Duas curvas, e a diferença importa. O miolo sai em ease-IN: começa
     devagar e acelera, que é como uma coisa se afasta. O fundo sai em
     ease-out, atrás dele. */
  var CURVA = 'cubic-bezier(0.55, 0, 0.85, 0.3)'
  var CURVA_FUNDO = 'cubic-bezier(0.3, 0, 0.2, 1)'

  var nasceu = Date.now()
  var ofereceu = false
  var saiu = false
  var raizEstilo = document.documentElement.style.overflow
  /* A cena lê scrollY a cada quadro. Sem travar, quem rolasse às cegas por
     baixo veria o astro saltar no instante em que a tela sai. */
  document.documentElement.style.overflow = 'hidden'

  /* Marca a oferta para daqui a `espera` milissegundos. O tempo é contado pelo
     compositor, via animação com atraso, e não por setTimeout: depois do
     primeiro quadro a fila de aquecimento dos shaders prende a thread
     principal por mais de dois segundos, e ali temporizador nenhum roda. Foi
     medido — o setTimeout do fim do piso disparava 2,1s atrasado. */
  function oferecer(espera) {
    if (ofereceu || saiu) return
    ofereceu = true
    espera = Math.max(0, espera || 0)

    if (barra) {
      barra.style.animation =
        'entradaBarra 1.9s cubic-bezier(0.22,0.85,0.3,1) forwards,' +
        ' entradaBarraFim 260ms ease-out ' + Math.max(0, espera - 260) + 'ms forwards'
    }
    if (botao) {
      botao.style.animation =
        'entradaBotao 420ms ' + CURVA_FUNDO + ' ' + espera + 'ms forwards,' +
        ' entradaBotaoPulso 2.2s ease-out ' + (espera + 420) + 'ms infinite'
    }
    setTimeout(function () {
      entrar(false)
    }, espera + AUTO)
  }

  /* A saída é lenta de propósito, e o miolo se afasta um fio enquanto some: o
     olho lê isso como a camada saindo de cena, não como um elemento sendo
     apagado. Por baixo, a cena já está desenhada e nítida. */
  function entrar(daOnda) {
    if (saiu) return
    saiu = true
    tela.style.pointerEvents = 'none'

    /* A onda do clique parte do botão ANTES de a tela começar a sair. São
       120ms de confirmação: sem eles o toque some junto com a camada e o
       botão parece não ter respondido. Só no clique — na saída automática
       não houve toque nenhum para confirmar. */
    var atraso = 0
    if (daOnda) {
      atraso = 120
      if (onda) onda.style.animation = 'entradaOnda 520ms ease-out forwards'
      if (botao) botao.style.transform = 'scale(0.96)'
    }

    /* O miolo acelera para fora e o fundo sai atrás dele, com um atraso
       curto: o conteúdo vai embora primeiro e a cena aparece por baixo. */
    /* O site entra ao mesmo tempo em que a camada sai. Sobrepor as duas é o
       que faz a emenda desaparecer: se a página só aparecesse depois, a
       saída teria movimento e a chegada não teria nenhum. */
    var raiz = document.documentElement
    raiz.classList.add('site-entrando')

    if (miolo) {
      miolo.style.animation = 'entradaSaiMiolo ' + SAIDA + 'ms ' + CURVA + ' ' + atraso + 'ms forwards'
    }
    tela.style.animation =
      'entradaSai ' + (SAIDA + 140) + 'ms ' + CURVA_FUNDO + ' ' + (atraso + 110) + 'ms forwards'

    /* A limpeza pode chegar atrasada sem custo: a esta altura a tela já está
       invisível pelo compositor. O que falta é devolver a rolagem e tirar o
       elemento do caminho. */
    setTimeout(function () {
      document.documentElement.style.overflow = raizEstilo
      /* O Lenis mede a página uma vez; com a rolagem travada ele pode ter
         medido zero. Um resize o faz recontar. */
      window.dispatchEvent(new Event('resize'))
      if (tela.parentNode) tela.parentNode.removeChild(tela)
    }, atraso + SAIDA + 260)

    /* A classe sai depois que a animação termina. Deixá-la pendurada manteria
       um transform em main e footer para sempre, e um transform prende
       qualquer `position: fixed` que venha a existir ali dentro. */
    setTimeout(function () {
      raiz.classList.remove('site-entrando')
    }, atraso + 1400)
  }

  if (botao) {
    botao.addEventListener('click', function () {
      /* Só vale depois de oferecido. Um teclado pode alcançar o botão antes
         disso, e entrar aí mostraria a cena crua. */
      if (ofereceu) entrar(true)
    })
  }

  window.addEventListener(
    'astro:cena-pronta',
    function () {
      oferecer(PISO - (Date.now() - nasceu))
    },
    { once: true },
  )
  setTimeout(function () {
    oferecer(0)
  }, TETO)
})()
