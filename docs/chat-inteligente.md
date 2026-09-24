# O atendimento do site: widget, ponte e inteligência

## O widget

Um botão flutuante com a marca, no canto inferior direito. Sem texto: ele
ocupa um canto em vez de uma faixa. O nome do que ele faz vive no
`aria-label`, que é onde o leitor de tela procura.

Ele não acompanha a página inteira, e não decide isso por lista de seções.

**Ele mede o que está embaixo dele.** Quando a rolagem para, o widget faz um
teste de posição em cinco pontos da área que ocupa e pergunta ao navegador o
que há ali. Havendo informação — texto, imagem, botão, link, campo — ele some.
Um teste de verdade, porque qualquer lista de "seções onde ele atrapalha"
fica desatualizada no dia em que alguém mexe no layout. Foi assim que ele
acabou cobrindo um cartão.

Duas coisas que a medição ensinou, e que estão no código:

- **Camadas do tamanho da tela não contam.** O banho de cor e o véu de
  leitura cobrem a viewport inteira e pintam algo em todo ponto. Contá-los
  escondia o botão na página inteira.
- **Fundo de cartão não é informação.** Contava, e no celular — onde o
  conteúdo ocupa a largura toda — o canto quase sempre cai sobre o fundo de
  algum cartão: o botão não aparecia em lugar nenhum. O que a pessoa precisa
  ler é texto, imagem e coisa clicável.

Medido varrendo a página inteira depois da mudança: **nenhuma sobreposição**,
no desktop e no celular, com o botão ainda visível em boa parte do percurso.

O teste roda quando a rolagem PARA, nunca durante — durante custaria um
cálculo de layout por quadro, disputando thread com a cena. Enquanto a página
se move o botão fica escondido, o que de quebra o tira da frente justamente
quando ninguém vai clicar nele.

Além disso ele some no hero, no contato e no rodapé, e não existe enquanto a
tela de carregamento está no ar.

Clicando, abre uma **gaveta lateral** com vidro (`backdrop-filter`), véu
escuro atrás e fechamento por toque fora, botão ou tecla Esc.

### Por que isso não incomoda a cena 3D

- A gaveta é `position: fixed` e entra por `transform`. Não há reflow, não há
  layout empurrado, e nenhum pixel do canvas é invalidado.
- `backdrop-filter` é composição na GPU sobre uma camada fixa, não repintura
  da página.
- O anel que pulsa no botão é um pseudo-elemento animando `transform` e
  `opacity` — mora no compositor.
- Nada aqui roda por quadro. É estado de React e CSS; o laço da cena não fica
  sabendo que o widget existe.

Medido no desktop e no celular depois da mudança: nenhum erro de console, a
gaveta em `position: fixed`, `z-index` 71 e desfoque ativo.

## A ponte: `/api/bot`

Recebe `{ mensagem, historico }` e devolve `{ modo: 'ia', resposta }` ou
`{ modo: 'roteiro' }`.

**Sobre o pedido de uma Netlify Function:** o site saiu do Netlify e está na
Vercel. Um arquivo em `netlify/functions/` não seria executado por ninguém —
seria código morto dando a impressão de que existe atendimento. A ponte está
em `api/bot.js`, que é onde de fato roda. Se um dia o site voltar para o
Netlify, o corpo do arquivo migra sem mudar uma linha de lógica: muda o
invólucro, de `handler(req, res)` para `(event, context)`.

### Ligar a inteligência

Cadastre **uma** destas na Vercel (*Settings → Environment Variables*) e
republique:

| Variável | Efeito |
| --- | --- |
| `ANTHROPIC_API_KEY` | Liga o Claude. Tem precedência. |
| `OPENAI_API_KEY` | Liga o GPT, se não houver chave da Anthropic. |
| `BOT_MODELO` | Opcional, fixa o modelo. |
| `BOT_TETO_DIARIO` | Opcional, máximo de respostas por dia. Padrão: 300. |

Sem chave nenhuma, a rota responde `roteiro` e o chat segue com as seis
perguntas de sempre — que funcionam, qualificam e não custam nada.

### O que protege o seu dinheiro e a sua reputação

- **Teto diário.** O endereço é público e cada chamada custa. Sem teto, um
  roteiro simples consome a conta da empresa numa madrugada. O contador vive
  na tabela de configuração; contador quebrado fecha a torneira em vez de
  abrir.
- **Só chamada da própria página**, corpo limitado a 32 kB e histórico a 16
  mensagens.
- **Instrução de sistema nunca vem do navegador.** Texto de fora virando
  instrução é exatamente como se sequestra um atendimento.
- **A instrução proíbe inventar preço e prazo.** Ela é editável no painel,
  aba *Robô do WhatsApp* — e é o lugar mais importante do sistema, porque é
  o que impede a inteligência de prometer o que a empresa não vai cumprir.
- **Falha nunca deixa ninguém no vácuo.** Chave vencida, cota estourada ou
  modelo fora do ar caem para o roteiro e para o WhatsApp.

## Onde a conversa livre aparece

Depois que o roteiro termina e o lead é registrado, aparece *Tenho outra
dúvida*. Dali em diante a conversa é livre, pela ponte. Se a ponte disser
`roteiro`, o chat agradece e oferece o WhatsApp.

Ordem deliberada: primeiro qualifica e registra o lead, depois conversa. Se
a inteligência viesse antes, uma conversa boa poderia terminar sem nome nem
contato — e um lead sem contato não é um lead.
