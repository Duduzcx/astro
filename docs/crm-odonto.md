# CRM multi-clínica com assistente no WhatsApp

Cada clínica odontológica entra em **astrosolucoes.vercel.app/crm**, conecta o
próprio WhatsApp por QR code e um assistente passa a atender os pacientes:
identifica, faz triagem, marca no Cal.com, lembra no dia da consulta e
reagenda. A recepção acompanha tudo no painel e assume a conversa quando
quiser. Custo de infraestrutura: zero, com os planos gratuitos abaixo.

## Suposições que fiz sobre o projeto (leia antes de tudo)

O pedido descrevia um projeto Next.js. **Este site não é Next.js**: é Vite
(React) com três páginas — o site, `/admin` e agora `/crm` — e funções sem
servidor da Vercel em `api/`. Portei o módulo para a arquitetura real, que é
o que roda:

| No pedido | Aqui |
| --- | --- |
| Route Handlers e Server Actions | uma função só, `api/crm/[...rota].ts`, que roteia por caminho. O plano gratuito da Vercel para em doze funções por deploy, e cada arquivo em `api/` vira uma |
| `lib/evolution.ts`, `lib/calcom.ts`, `lib/bot/` | exatamente isso, em TypeScript, na raiz do repositório. O motor não conhece Supabase, Evolution nem Cal.com: recebe um canal, um repositório e uma agenda injetados (`lib/bot/tipos.ts`) |
| páginas em `/app/crm/...` | `crm.html` + `src/crm/`, com um roteador de um arquivo. `/crm/*` é reescrito para `crm.html` no `vercel.json` |
| Supabase Auth no servidor | Supabase Auth no navegador (e-mail e senha, chave pública); cada chamada às rotas leva o JWT, que o servidor confere com a chave de serviço e troca pela `clinica_id` do usuário |
| Realtime | o painel assina `mensagens` e `conversas` com a chave pública; as policies de leitura por clínica estão nas migrations |
| Vercel Cron a cada hora | o plano gratuito da Vercel só permite cron diário. O endpoint existe (`/api/crm/cron/lembretes`) e é chamado por um agendador gratuito externo (cron-job.org). Veja abaixo |
| botões do WhatsApp | texto numerado ("1) 2) 3)"), sempre: botões da Evolution não aparecem em boa parte dos aparelhos, e o motor entende número ou texto na volta |

Outras decisões:

- O schema do Supabase (`astro-odonto`) já existia; as duas migrations em
  `supabase/migrations/` só estendem, e **já foram aplicadas** ao projeto.
  Acrescentei `config_clinica.simulador_testado_em`, que o pedido não
  previa: é o que libera o passo "Conectar WhatsApp" do onboarding.
- Perguntas livres vão para a Groq (Llama) **só com o texto da pergunta e os
  dados públicos da clínica**; nome, CPF e telefone nunca saem do banco.
- O paciente do simulador tem telefone `sim_<id do usuário>`; agendamentos
  de teste vão para o Cal.com com `[TESTE]` no nome, e o lembrete os pula.
- O segundo usuário de uma clínica (recepção) é ligado por SQL, por enquanto:
  `insert into usuarios_clinica (user_id, clinica_id, papel) values (…)`.

## Arquivos

| O quê | Onde |
| --- | --- |
| migrations | `supabase/migrations/20260925120000_*.sql`, `20260925120100_*.sql` |
| motor do assistente | `lib/bot/motor.ts` (máquina de estados), `textos.ts` (mensagens e tom), `faq.ts` (Groq), `util.ts`, `tipos.ts` |
| clientes | `lib/evolution.ts`, `lib/calcom.ts` |
| rotas | `api/crm/[...rota].ts` → `api/crm/_lib/` (`bot.ts` webhook e motor, `cron.ts`, `painel.ts`, `repo.ts` Supabase, `sessao.ts`, `clinica.ts`, `ambiente.ts`) |
| painel | `crm.html`, `src/crm/App.tsx`, `src/crm/paginas/*` |
| testes | `tests/bot-motor.test.ts` (conversas inteiras, sem rede), `tests/bot-util.test.ts` |
| Evolution API | `infra/evolution/docker-compose.yml` |

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | O que é |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | chave de serviço do projeto `astro-odonto` (Supabase → Settings → API). **Obrigatória.** Nunca vai para o navegador |
| `SUPABASE_URL` | opcional; padrão `https://mtmrotcstapfmtxqzwog.supabase.co` |
| `EVOLUTION_API_URL` | endereço https da sua Evolution API |
| `EVOLUTION_API_KEY` | a `AUTHENTICATION_API_KEY` que você definiu nela |
| `CAL_API_KEY` | Cal.com → Settings → Developer → API keys |
| `CRON_SECRET` | `openssl rand -hex 32`; protege o lembrete anti-faltas e, por padrão, o webhook |
| `CRM_WEBHOOK_TOKEN` | opcional; token só do webhook (senão usa `CRON_SECRET`) |
| `GROQ_API_KEY` | opcional; liga as perguntas livres (console.groq.com, plano gratuito) |
| `GROQ_MODELO` | opcional; padrão `llama-3.3-70b-versatile` |
| `PUBLIC_URL` | opcional; padrão `https://astrosolucoes.vercel.app` (monta a URL do webhook) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | opcionais; aviso à recepção fora do painel |

No painel do Supabase, em Authentication → Providers → Email, deixe
"Confirm email" como preferir: com ele ligado, quem cria conta recebe um
e-mail antes de entrar.

## Evolution API no Oracle Cloud Always Free

1. Crie a conta em cloud.oracle.com e um **Compute Instance** Always Free:
   shape `VM.Standard.A1.Flex` (ARM, até 4 OCPU e 24 GB, grátis), imagem
   Ubuntu 22.04. Abra as portas 80 e 443 na *Security List* da VCN.
2. No VM: `sudo apt update && sudo apt install -y docker.io docker-compose-v2`
   e `sudo usermod -aG docker $USER` (saia e entre de novo).
3. Copie `infra/evolution/` para o VM, `cp .env.exemplo .env`, preencha
   `AUTHENTICATION_API_KEY`, `POSTGRES_PASSWORD` e `DOMINIO`.
4. Aponte um domínio (ou um nome gratuito do DuckDNS) para o IP público do
   VM. O Caddy do compose tira o certificado sozinho.
5. `docker compose up -d`. Teste:
   `curl -H "apikey: SUA_CHAVE" https://SEU_DOMINIO/instance/fetchInstances`
   deve devolver `[]`.
6. Na Vercel, cadastre `EVOLUTION_API_URL=https://SEU_DOMINIO` e
   `EVOLUTION_API_KEY=SUA_CHAVE`. Republique.

Alternativas gratuitas se a Oracle recusar a conta: Fly.io (256 MB, aperta
mas roda com `DATABASE_SAVE_DATA_*` desligados), Koyeb (uma instância nano)
ou uma máquina sua com um túnel (Cloudflare Tunnel é grátis).

O webhook de cada instância é registrado pelo próprio painel ao clicar em
*Conectar*, apontando para
`https://astrosolucoes.vercel.app/api/crm/whatsapp/webhook/{instancia}?token=…`.
Nada a configurar na Evolution à mão.

## Lembrete anti-faltas (cron)

`GET https://astrosolucoes.vercel.app/api/crm/cron/lembretes` com o cabeçalho
`Authorization: Bearer CRON_SECRET` (ou `?secret=…`). Pega as consultas que
começam entre 3 e 4 horas a partir de agora, manda "confirma sua presença?"
e põe a conversa em `aguardando_confirmacao`.

No plano gratuito da Vercel, agende de fora: em **cron-job.org** (grátis),
crie um job para essa URL, a cada hora, de segunda a sexta, das 8h às 17h
(fuso America/Sao_Paulo), com o cabeçalho de autorização. Se o projeto for
para o plano Pro, o mesmo endpoint entra em `vercel.json`:

```json
"crons": [{ "path": "/api/crm/cron/lembretes", "schedule": "0 11-20 * * 1-5" }]
```

(a Vercel roda em UTC; 11–20 UTC = 8–17 em São Paulo).

## Checklist de uma clínica nova

1. A clínica cria a conta em `/crm` (e-mail e senha) e cai no assistente de
   configuração.
2. **Clínica**: nome, dentista, endereço, Maps, recepção, recomendações,
   IDs dos eventos do Cal.com (avaliação e limpeza), valor da avaliação.
3. **Dentistas** e **Procedimentos** (cada um com o ID do evento no Cal.com;
   são os botões que o assistente oferece).
4. **Horários** de funcionamento e **Base de conhecimento** (perguntas que
   o assistente pode responder).
5. **Simulador**: conversar como paciente até marcar uma consulta de teste.
   Depois, *Cancelar todos os agendamentos de teste*.
6. **Conectar WhatsApp**: só aparece depois do simulador. Escaneia o QR com
   o celular da clínica (Aparelhos conectados). Use um número só da clínica.
7. Mandar um "oi" de outro celular e ver a conversa entrar em `/crm/conversas`.
8. Opcional: Telegram para avisos e Groq para perguntas livres.

## Como o assistente decide

`lib/bot/motor.ts`, uma etapa por mensagem, guardada em `conversas.etapa`:
`inicio` → (`coletando_nome` → `coletando_cpf`) ou `menu_principal` →
`triagem` → `escolhendo_tipo` → `escolhendo_vaga` → `concluido`; o cron põe
em `aguardando_confirmacao`. Urgência (palavras da clínica) e "falar com
recepção" viram `humano_ativo = true`: o bot cala até a recepção devolver.
Pergunta livre no meio de qualquer etapa vai para a base de conhecimento e
a etapa é retomada; sem resposta, cai em *Perguntas sem resposta* com um
botão que a transforma em entrada da base. Duas buscas de vaga sem sucesso
transferem para a recepção.

Os testes em `tests/bot-motor.test.ts` contam essas conversas inteiras sem
rede. Depois de mexer no motor: `npm test && npm run lint && npm run build`.

## LGPD

CPF e queixa nunca aparecem em log; o painel mostra o CPF mascarado
(`***.***.***-12`). O modelo de linguagem recebe só a pergunta. Endereço de
rede não é guardado. A política de privacidade do site vale para o módulo.
