# Painel da empresa, chat do site e CRM

Três peças que dividem a mesma base de dados:

1. **O chat do site** conversa com o visitante, faz seis perguntas de
   qualificação e manda o resultado para dentro. O botão dele não fica na
   tela o tempo todo: some no hero, no contato e no rodapé, onde cobriria os
   botões e o formulário que a pessoa foi procurar, e aparece no meio do
   percurso, que é onde alguém trava e precisa perguntar.
2. **O painel** em `/admin` mostra esses contatos como um funil, com números.
3. **O robô do WhatsApp** (`docs/whatsapp-automacao.md`) grava na mesma
   tabela, então o painel tem tudo num lugar só.

Sem banco configurado, o chat continua funcionando: ele manda a conversa
inteira pelo WhatsApp. Nada se perde — mas nada é guardado, e o painel avisa
isso em amarelo, bem grande. Nunca fingimos ter recebido.

---

## 1. Ligar o banco (10 minutos)

Serve qualquer Postgres. O mais rápido é o da própria Vercel:

1. No painel da Vercel, aba **Storage** → **Create Database** → **Postgres**.
2. Conecte ao projeto. A Vercel cria a variável `POSTGRES_URL` sozinha.
3. **Republique** o site. Variável nova só entra num deploy novo.

Outras opções servem igual: Neon, Supabase ou um servidor seu. Copie a string
de conexão para uma variável chamada `POSTGRES_URL` (ou `DATABASE_URL`).

As tabelas se criam sozinhas na primeira chamada. Não há passo de migração
para esquecer.

## 2. Abrir o painel

Cadastre duas variáveis na Vercel (*Settings → Environment Variables*):

| Variável | O que pôr |
| --- | --- |
| `ADMIN_SENHA` | A senha da equipe. **Mínimo de 12 caracteres — abaixo disso a porta não abre**, e o painel diz o motivo. É a única porta: use algo longo e aleatório. |
| `ADMIN_SEGREDO` | Uma cadeia aleatória longa, que assina o cookie de sessão. Gere com `openssl rand -base64 48` e nunca reuse a senha aqui. |

Republique e abra **astrosolucoes.vercel.app/admin**.

### Como a porta é protegida

- A senha é comparada em tempo constante, e o que volta é um cookie **assinado
  com HMAC**, não a senha.
- O cookie é `HttpOnly` (JavaScript da página não lê, então um XSS não rouba a
  sessão), `Secure` (só HTTPS), `SameSite=Lax` (não viaja em requisição vinda
  de outro site, o que corta CSRF) e vale 12 horas.
- Duas travas de tentativa. Uma por origem (cinco erros em dez minutos) e uma
  global (quarenta erros em dez minutos). A global existe porque a primeira é
  contornável: o endereço de quem chama vem de um cabeçalho, e quem tenta
  adivinhar a senha manda um valor diferente a cada vez. A global não depende
  de nada que o visitante escolha.
- A origem é lida do cabeçalho que a própria Vercel escreve, nunca do que o
  cliente manda.
- A senha precisa ter 12 caracteres ou mais. Não é recomendação: com senha
  curta a rota recusa entrar, porque limite de tentativas com senha fraca é
  teatro.
- A página `/admin` é pública — o que é privado são as rotas `/api/admin/*`,
  que exigem o cookie. Esconder a rota no navegador não protegeria nada, já
  que qualquer pessoa lê o JavaScript servido.
- `/admin` está fora do `robots.txt` e marcada como `noindex`.

**Se alguém sair da equipe, troque `ADMIN_SENHA` e `ADMIN_SEGREDO`.** Trocar o
segredo invalida na hora todas as sessões abertas.

## 3. Avisar a equipe quando entra lead (opcional)

Com a Cloud API já configurada (veja `docs/whatsapp-automacao.md`), acrescente
`EQUIPE_WHATSAPP` com o número que recebe o aviso, no formato
`5511999999999`. Cada lead novo do chat chega lá formatado.

Sem isso, nada quebra: o lead é guardado e aparece no painel.

---

## O que o painel faz

Três abas.

**Funil** — o quadro, uma coluna por estágio (novo, contatado, proposta,
fechado, perdido), com a soma dos valores em cada coluna. Mover um negócio é
um toque no estágio.

**Leads** — a lista completa. Cada um abre com:

- **Retornar em** — a data do próximo contato. Quem passou da data aparece
  destacado em amarelo, entra no contador *Retornos vencidos* no topo e pode
  ser isolado pelo filtro *só vencidos*. É este número que faz alguém abrir o
  painel de manhã.
- **Responsável** — quem cuida.
- **Valor do negócio**, que alimenta a receita fechada.
- **Histórico** — cada ligação, proposta ou conversa registrada com data. É
  isto que separa um CRM de uma lista de contatos.
- **A conversa** que trouxe o lead, inteira, do chat ou do WhatsApp.

**Robô do WhatsApp** — o estado da integração (Cloud API ligada, assinatura
conferida) e **os textos que o robô responde, editáveis ali mesmo**. Mudou,
salvou, vale na próxima mensagem: sem programador e sem republicar. O padrão
de fábrica continua no código, e o botão *Voltar ao padrão* o traz de volta.

**Números do topo:** total, últimos 7 dias, retornos vencidos, conversão e
receita fechada. A conversão é calculada sobre o que já saiu do funil
(fechados sobre fechados + perdidos) — contar quem entrou ontem como "ainda
não fechou" faria o número parecer pior do que é. Abaixo, entrada por semana
e por canal.

## O que o chat do site faz

Segue um roteiro de seis perguntas: o que precisa, para quando, orçamento
previsto, o que trava hoje (opcional), nome e contato. Só então envia.

Ele **não** improvisa. É um roteiro, não um modelo de linguagem. A escolha é
deliberada: um modelo solto respondendo por uma agência inventa prazo e preço,
e quem paga a conta é a reputação. O roteiro é previsível, custa zero por
conversa e entrega exatamente o que o time precisa para responder bem.

Se um dia fizer sentido colocar um modelo de linguagem no lugar, o ponto de
troca é a função `encerrar` em `src/components/Chatbot.tsx` e a rota
`api/lead.js` — o resto continua igual.

---

## Onde mexer

| O quê | Arquivo |
| --- | --- |
| Perguntas do chat | `src/components/Chatbot.tsx`, constante `ROTEIRO` |
| Textos do robô do WhatsApp | pelo painel, aba *Robô do WhatsApp*. O padrão de fábrica fica em `api/_lib/whatsapp-textos.js` |
| Situações do funil | `api/_lib/db.js`, constante `SITUACOES` (e a lista igual em `src/admin/Painel.tsx`) |
| Cálculo dos números | `api/_lib/leads.js`, função `resumo` |

Depois de mexer, rode `npm test && npm run lint && npm run build`.

## Quando algo não funciona

Abra *Logs* no painel da Vercel e filtre pela rota:

- **`/api/lead` respondendo 503** — falta `POSTGRES_URL`, ou ela não foi
  publicada num deploy novo.
- **`/admin` pedindo senha em looping** — falta `ADMIN_SEGREDO`, ou ele mudou
  entre deploys (o que invalida os cookies).
- **429 ao entrar** — a trava de força bruta pegou; espere dez minutos.
- **Painel vazio com aviso amarelo** — é o esperado antes do passo 1. Enquanto
  o banco não está ligado, o painel entra em *modo demonstração*: mostra três
  leads de exemplo, marcados como exemplo, só para você ver a ferramenta
  funcionando. Eles não podem ser editados e somem quando o banco entra.

O widget do chat, a ponte da inteligência e as proteções de custo estão em
`docs/chat-inteligente.md`.
