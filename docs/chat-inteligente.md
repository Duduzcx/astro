# O atendimento do site: widget, ponte e inteligência

## O widget

Um botão flutuante com a marca, no canto inferior direito. Sem texto: ele
ocupa um canto em vez de uma faixa. O nome do que ele faz vive no
`aria-label`, que é onde o leitor de tela procura.

Ele não acompanha a página inteira. Some no hero, no contato e no rodapé —
ali cobriria os botões e o formulário que a pessoa foi procurar — e aparece
no meio do percurso, que é onde alguém trava e precisa perguntar. Enquanto a
tela de carregamento está no ar, não existe.

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
