# Atendimento automático no WhatsApp

Há dois caminhos. Eles não são concorrentes: o primeiro funciona hoje à tarde
e o segundo é para quando o volume justificar.

---

## Caminho 1 — aplicativo WhatsApp Business (sem código, sem custo)

**Recomendado para começar.** O número continua no celular, a equipe continua
respondendo normalmente, e o cliente que escreve fora de hora recebe resposta
na hora.

No aplicativo **WhatsApp Business**, em *Configurações → Ferramentas
comerciais*:

- **Mensagem de saudação** — vai para quem escreve pela primeira vez, ou
  depois de 14 dias parado.
- **Mensagem de ausência** — vai fora do horário que você definir. Como o site
  promete equipe das 8h às 21h com plantão para urgência, o razoável é ligar
  das 21h às 8h.
- **Respostas rápidas** — atalhos digitados pela equipe (`/preco`, `/prazo`),
  não automáticos, mas eliminam a redigitação.

Textos prontos para colar:

> **Saudação**
> Olá! Aqui é a Astro Soluções 👋
> Que bom ter você por aqui. Me conta em uma frase o que está travando na sua
> operação hoje — respondemos em minutos, das 8h às 21h.

> **Ausência**
> Recebemos a sua mensagem! 🌙
> O time responde a partir das 8h. Se for urgência de sistema no ar, escreva
> *URGENTE* que o plantão é acionado.

**Limite honesto:** o aplicativo não conversa. Ele manda uma mensagem e para.
Não existe menu com opções, nem resposta diferente por assunto.

---

## Caminho 2 — robô de verdade (WhatsApp Cloud API)

O código já está pronto e publicado: `api/whatsapp.js`. Ele responde com um
menu de quatro opções, entende o pedido escrito (“quanto custa”, “quero
agendar”) e entrega para um humano quando não entende. Nunca insiste.

### Leia isto antes de qualquer coisa

**O número usado na Cloud API sai do aplicativo comum do WhatsApp.** Ele passa
a ser atendido só por programa. Se o (11) 92157-2675 é o número que a equipe
usa no celular para conversar, **não migre esse número**: pegue um segundo
número (um chip novo ou um número virtual) para o robô.

Outras coisas que valem saber antes:

- **Janela de 24 horas.** O robô só pode escrever livremente por 24 horas
  depois da última mensagem da pessoa. Fora disso, só modelos aprovados pela
  Meta.
- **Custo.** A Meta cobra por conversa iniciada. Conversa iniciada pelo
  cliente tem uma cota mensal gratuita; acima dela, e em conversas iniciadas
  pela empresa, há cobrança. Confira a tabela atual, que muda.
- **Verificação.** A conta comercial precisa ser verificada pela Meta. Isso
  leva dias, não minutos, e pede documento da empresa.

### Passo a passo

1. **Meta for Developers** (developers.facebook.com) → criar um aplicativo do
   tipo *Business* → adicionar o produto **WhatsApp**.
2. Em *WhatsApp → API Setup*, anote o **Phone number ID** e cadastre o número
   do robô.
3. Crie um **usuário do sistema** em *Business Settings → System Users*, dê a
   ele a permissão `whatsapp_business_messaging` e gere um **token
   permanente**. O token de teste vence em 24 horas — não use esse.
4. No painel da **Vercel**, em *Settings → Environment Variables*, cadastre as
   quatro variáveis (marque *Production*):

   | Variável | O que é |
   | --- | --- |
   | `WHATSAPP_VERIFY_TOKEN` | Uma senha que você inventa. Serve só para a Meta provar que o endereço é seu. |
   | `WHATSAPP_TOKEN` | O token permanente do passo 3. |
   | `WHATSAPP_PHONE_ID` | O *Phone number ID* do passo 2 (é um número longo, não o telefone). |
   | `WHATSAPP_APP_SECRET` | *App Secret*, em *Settings → Basic* do aplicativo. |

5. **Republique** o site na Vercel. Variável de ambiente só entra num deploy
   novo.
6. Em *WhatsApp → Configuration → Webhook*, clique em **Edit** e preencha:
   - **Callback URL:** `https://astrosolucoes.vercel.app/api/whatsapp`
   - **Verify token:** o mesmo `WHATSAPP_VERIFY_TOKEN`
   - Clique em **Verify and save**. Se der erro, é quase sempre a variável não
     publicada (passo 5).
7. Ainda em *Webhook*, clique em **Manage** e assine o campo **messages**. Sem
   essa assinatura nada chega, e o silêncio não dá pista nenhuma.
8. Mande um “oi” do seu celular para o número do robô.

### Se não responder

Abra *Logs* no painel da Vercel e filtre por `/api/whatsapp`:

- **Sem nenhuma linha** — a Meta não está chamando. Reveja o passo 7.
- **401 assinatura invalida** — `WHATSAPP_APP_SECRET` errado ou não publicado.
- **`WhatsApp recusou o envio: 401`** — `WHATSAPP_TOKEN` vencido ou sem a
  permissão.
- **`WhatsApp recusou o envio: 400`** — quase sempre a janela de 24 horas
  fechada, ou o número de destino em formato errado.

### Onde mexer nos textos

Tudo no topo de `api/whatsapp.js`: `MENU`, `RESPOSTAS`, `BOAS_VINDAS` e
`NAO_ENTENDI`. A função `entender` decide qual resposta vai — ela tem teste em
`tests/whatsapp.test.ts`, então rode `npm test` depois de mexer nas palavras-
chave.

### O que o robô não faz, de propósito

Ele não guarda o passo da conversa. Cada mensagem é lida inteira e respondida
por si, porque uma função sem servidor morre entre uma chamada e outra e
qualquer memória ali seria mentira. Na prática isso é melhor: ninguém fica
preso num menu, e escrever “quanto custa” funciona a qualquer momento.

Ele também não finge ser gente. Quando não entende, diz que uma pessoa vai
ler — e alguém precisa ler de verdade.
