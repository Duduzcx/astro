# Prospecção pelo número pessoal do WhatsApp

O número da agência na Cloud API atende quem chega (`docs/whatsapp-automacao.md`).
A prospecção é o contrário: o **número pessoal** do fundador, conectado por QR
code pela Evolution API (a mesma do CRM das clínicas), com o painel listando
as conversas que já existem no aparelho. A equipe marca as conversas que quer
trabalhar, e o robô assume só essas: retoma o assunto de onde parou, com a
instrução mestre de prospecção, e conduz até o diagnóstico gratuito.

## O que é preciso

| Variável (Vercel) | O que é |
| --- | --- |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` | a Evolution API, a mesma do CRM (`docs/crm-odonto.md` explica como subir de graça) |
| `EVOLUTION_INSTANCIA_PESSOAL` | opcional; o nome da instância. Padrão `astro-pessoal` |
| `CRON_SECRET` (ou `CRM_WEBHOOK_TOKEN`) | o token que protege o webhook, já usado pelo CRM |
| `POSTGRES_URL` | o banco do funil: cada conversa assumida vira um lead |
| `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` | a inteligência que escreve pelo número |

## Como usar

1. `/admin` → aba **Prospecção** → *Conectar número*. Aparece um QR code;
   no celular, WhatsApp → Aparelhos conectados → Conectar aparelho. O painel
   confere sozinho até ficar "Conectado" e mostra o número.
2. A lista traz as conversas do aparelho, da mais recente para a mais
   antiga, com a última mensagem de cada uma. Marque as que quer prospectar
   e clique em **O robô assume**.
3. Para cada conversa marcada o robô importa o histórico do aparelho para
   um lead do funil (canal `prospeccao`), escreve a mensagem de abordagem a
   partir desse histórico e envia. Dali em diante responde o que a pessoa
   mandar, dentro do teto diário da inteligência.
4. A instrução mestre de prospecção fica na mesma aba e vale para todas as
   conversas assumidas. Vazia, volta ao padrão de fábrica.

## O que o robô nunca faz

- **Responder conversa que não foi marcada.** Família, amigo, fornecedor:
  silêncio absoluto. A decisão é sempre de quem está no painel.
- **Falar por cima do dono.** Se você escrever pelo celular numa conversa
  assumida, o robô percebe (a mensagem saiu do aparelho, mas não saiu dele),
  marca o lead como *pausado* e para. O painel devolve com um clique, na
  gaveta do lead ou na lista da aba.
- Inventar preço, prazo ou funcionalidade; pedir senha, cartão ou dado
  bancário; insistir com quem pediu para parar. Está na instrução padrão.

## Onde mora

| O quê | Onde |
| --- | --- |
| a lógica (assumir, abordar, responder, pausar) | `api/_lib/prospeccao.js` |
| a rota do painel | `api/admin/prospeccao.js` |
| o webhook | o mesmo do CRM, `api/crm/rota.js` → `bot.js`, que desvia a instância pessoal para a prospecção |
| a lista de conversas e o histórico | `conversas()` e `mensagens()` em `api/crm/_lib/evolution.js` |
| a coluna `leads.prospeccao` e a tabela `prospeccao_mensagens` | `api/_lib/db.js` |
| testes das regras puras | `tests/prospeccao.test.ts` |

## Limites e avisos

- A Evolution roda sobre o aplicativo (Baileys). A Meta pode bloquear
  números que disparam em massa: por isso o painel assume até trinta
  conversas por vez, e o robô só escreve para quem já tem conversa aberta.
- O histórico importado são as últimas quarenta mensagens de texto de cada
  conversa; mídia sem legenda fica de fora.
- Um lead que já existia (veio do site ou do número da agência) mantém a
  conversa que tinha; o histórico do aparelho só entra quando o lead é
  criado pela prospecção.

## Por que não dá para pôr o número pessoal na Cloud API da Meta

A Cloud API só aceita um número que NÃO esteja registrado no aplicativo do
WhatsApp: ao cadastrar, a Meta responde "já está registrado em uma conta do
WhatsApp" e pede para desconectar do aplicativo. Não há contorno. O número da
Cloud API (`api/whatsapp.js`, a linha oficial da agência) precisa ser um
número só dela — um chip novo ou, para testar, o número de teste que a Meta
dá no painel do desenvolvedor.

Para "meu número, minhas conversas, o robô assumindo", os dois caminhos são:

1. **Este módulo** (Evolution API, QR code como o WhatsApp Web): não mexe no
   aplicativo, não desconecta nada, lista as conversas do aparelho. Precisa
   de um servidor com a Evolution (`docs/crm-odonto.md`, Oracle Always Free).
   É não oficial: a Meta pode bloquear números que disparam em massa; aqui o
   robô só escreve para conversas que já existem e que você escolheu.
2. **Coexistência oficial da Meta** (desde maio de 2025): o mesmo número no
   aplicativo **WhatsApp Business** e na Cloud API, com as conversas
   espelhadas por webhook e os últimos seis meses sincronizados. Exige migrar
   o número do WhatsApp comum para o WhatsApp Business (o próprio app faz,
   mantendo as conversas), uma conta com algum tempo de uso, e a ligação
   feita por Embedded Signup (uma página nossa com o SDK da Meta). Não está
   construído: seria uma página de conexão no painel, a troca do código pelo
   token no servidor, e a leitura dos webhooks de histórico para montar a
   lista de conversas no banco.
