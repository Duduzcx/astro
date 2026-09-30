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
| `EVOLUTION_API_KEY` | a chave que a ponte e o site compartilham (invente uma: `openssl rand -hex 24`); na ponte é `PONTE_CHAVE` |
| `EVOLUTION_API_URL` | só se você tiver uma Evolution API ou a ponte num servidor com domínio fixo; sem ela, o site usa o endereço que a ponte registra sozinha |
| `EVOLUTION_INSTANCIA_PESSOAL` | opcional; o nome da instância. Padrão `astro-pessoal` |
| `CRON_SECRET` (ou `CRM_WEBHOOK_TOKEN`) | o token que protege o webhook, já usado pelo CRM |
| `POSTGRES_URL` | o banco do funil: cada conversa assumida vira um lead |
| `GROQ_API_KEY` | a inteligência **grátis** que escreve pelo número (console.groq.com, sem cartão). Ou `ANTHROPIC_API_KEY`, ou `OPENAI_API_KEY` — nesta ordem de preferência |

## A ponte: o número entra como no WhatsApp Web

Nada de Meta, nada de Docker, nada de banco. A pasta `ponte-whatsapp/` é um
programa Node que liga o número pelo QR code (o protocolo de aparelho
conectado, o mesmo do WhatsApp Web), guarda as conversas em `dados/` e
atende o site no formato da Evolution. No seu PC:

1. Na Vercel, cadastre `EVOLUTION_API_KEY` com uma chave inventada (16 ou
   mais caracteres) e republique (ou espere o próximo deploy).
2. No PC: `cd ponte-whatsapp`, `npm install`, copie `.env.exemplo` para
   `.env` e ponha a mesma chave em `PONTE_CHAVE`.
3. `npm start`. A ponte baixa o `cloudflared` uma vez, abre um túnel público
   (endereço `*.trycloudflare.com`, sem conta) e se registra no site. O QR
   aparece no terminal e no painel.
4. Enquanto a ponte roda, o robô trabalha. PC desligado, ponte parada: as
   mensagens ficam no celular e o robô só volta quando a ponte voltar. Para
   ficar ligada o dia inteiro, a mesma pasta roda em qualquer servidor com
   Node (Oracle Always Free, por exemplo); com domínio fixo, `URL_PUBLICA`
   no `.env` dispensa o túnel.

O endereço do túnel muda a cada subida, por isso a ponte se registra
sozinha (`POST /api/crm/ponte/registrar`, com a chave) na subida e de dez
em dez minutos; o painel mostra "ponte em … · registrada há …".

**Desconectar e reconectar.** Ao clicar em *Desconectar* (ou ao remover o
aparelho pelo celular), a ponte encerra a sessão, apaga `dados/auth` e já
oferece um QR novo; o painel busca e mostra o QR sozinho quando a ponte está
esperando. *Conectar número* espera o QR nascer (até oito segundos na ponte,
três tentativas no painel) antes de desistir com aviso.

**Rodando sem terminal.** `node ponte.mjs > dados/saida.log 2>&1 &` deixa a
ponte em segundo plano; para parar, encerre o processo `node ponte.mjs`
(no Windows: `taskkill /F /IM node.exe` derruba todos os node, cuidado).

**A lista de conversas chega na hora de ligar o aparelho**, e só nessa hora:
é o pacote inicial que o telefone manda ao novo aparelho conectado. Se a
lista ficar vazia (a ponte subiu depois, ou a primeira ligação veio sem o
pacote), no painel clique em *Desconectar* e depois em *Conectar número*, e
leia o QR de novo. O que a ponte recebeu está em
`http://localhost:3777/diagnostico` (com o cabeçalho `apikey`) e em
`dados/eventos.log`: conexões, pacotes de histórico com as contagens,
mensagens, webhooks e o registro no site.

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
| a ponte (o número pelo QR, as conversas, o envio) | `ponte-whatsapp/ponte.mjs` |
| o webhook | o mesmo do CRM, `api/crm/rota.js` → `bot.js`, que desvia a instância pessoal para a prospecção |
| o registro do endereço da ponte | `registrarPonte` em `api/_lib/prospeccao.js`, rota `ponte/registrar` |
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

## A frase gatilho: o robô assume a partir do seu celular

Além de marcar conversas no painel ou digitar um número, dá para acionar o
robô sem abrir o painel: mande **uma das frases gatilho** pelo seu próprio
WhatsApp, na conversa que quiser. O webhook vê que a mensagem é sua
(`fromMe`), reconhece a frase, cria o lead (se não existir), marca como
`bot` e guarda a sua mensagem como a primeira fala do robô. Ele **não manda
nada nessa hora**: responde quando a pessoa replicar, já com a instrução
mestre e o histórico.

- As frases ficam na aba Prospecção ("Frases gatilho"), uma por linha. A
  comparação ignora maiúsculas, acentos e pontuação, e vale se a mensagem
  contiver a frase. Padrão: "Boa tarde", "Bom dia", "Boa noite" e "notei um
  gargalo": a saudação sozinha já basta.
- Cuidado com frases que você também usa com amigos: se mandar "bom dia,
  tudo bem?" para a sua mãe, o robô vai responder a ela. Prefira uma frase que
  só apareça na prospecção (a abertura do gargalo é a mais segura).
- Escreveu pelo celular numa conversa assumida? O robô cala naquela vez (não
  há o que responder), guarda o que você disse como fala dele e continua na
  próxima réplica da pessoa, já levando o seu texto em conta. Para desligar o
  robô numa conversa, mande `#pausa` nela; `#robo` religa. O painel também
  pausa e devolve.

## Restrição do WhatsApp e o modo do robô

Em 30/09/2026 o número pessoal levou uma restrição de 24 horas depois de
dezenas de abordagens a frio num minuto, por um cliente não oficial. Não há
como contornar isso e a ponte não tenta. O que existe é o **modo do robô**
(aba Prospecção):

- **Só responde** (padrão): o robô fala apenas com quem escreveu primeiro ou
  com quem você abriu à mão pelo celular (frase gatilho). Nada de abordagem
  a frio pelo painel, nada de empurrão automático.
- **Ativo**: empurrão em conversa parada e abordagem a frio pelo painel, até
  10 por dia (`ABORDAGENS_POR_DIA`). Use sabendo do risco.

Regras que valem sempre: uma ponte só por número; não reparear à toa; parar
no primeiro "não" definitivo ou hostilidade; nunca rajada. Para prospecção
em volume, o caminho é a API oficial do WhatsApp Business (número
dedicado, modelos aprovados, opt-in), que o site pode passar a usar.

## Mão humana, humanização e limite diário

- Você escreveu numa conversa do robô? Por dez minutos é você quem atende: a
  resposta da pessoa fica guardada e o robô cala. Depois ele volta com tudo
  no contexto (a retomada também respeita a janela). `#pausa` desliga de vez.
- Toda resposta passa por `humanizar`: sem dois-pontos fora de horário, sem
  ponto e vírgula, sem travessão, sem negrito. A instrução pede frases curtas
  e começo variado.
- Abordagens a frio (número digitado) têm limite de 20 por dia
  (`ABORDAGENS_POR_DIA`). É a regra do WhatsApp, não uma opção: mensagem não
  solicitada em volume bloqueia o número. Conversas existentes não contam.
  Para volume, o caminho é a API oficial do WhatsApp Business.

## Ritmo: saudação, retomada e anti-repetição

- Cumprimento puro nas duas primeiras falas da pessoa ("Boa tarde", "Oi,
  tudo bem?") recebe só o cumprimento de volta, sem pergunta comercial; um
  "tudo bem?" de volta vira "Tudo certo por aqui também! Estou falando com o
  responsável pela imobiliária?". Isso é do site, não do modelo.
- Abertura a frio (número digitado no painel) é só "Boa tarde, tudo bem? Aqui
  é o assistente da Astro Soluções." O assunto vem quando a pessoa responder.
- Parou de responder? A ponte pede ao site, a cada dez minutos, um empurrão
  leve nas conversas do robô paradas entre 20 minutos e 2 dias, três por vez,
  uma vez só por conversa (`POST /api/crm/ponte/retomar`, com a chave).
- O site compara cada resposta com as três últimas do robô; parecida, pede
  outra; se insistir, manda uma frase neutra que devolve a vez à pessoa.
- Vários números de uma vez no painel: um por linha, um pedido por número com
  pausa de 5 a 9 segundos entre eles, até 30 por rodada.

## Áudio

Quem responde por áudio é atendido normalmente: a ponte baixa o arquivo e o
manda em base64 junto do webhook; o site transcreve pelo Whisper da Groq
(grátis, `whisper-large-v3-turbo`) e a conversa segue como texto, com a fala
guardada como "(áudio) …". Se a transcrição falhar, o robô pede por escrito.
Limite: 2 MB por áudio na ponte, 3 MB de corpo no site.

## Robô do outro lado

Muita imobiliária tem resposta automática (menu "digite 1", "seja
bem-vindo", "responderemos em breve"). O site reconhece isso na mensagem
recebida e, em vez de conversar com o robô, manda a IA escolher a opção que
leva a uma pessoa ou pedir o responsável. Na terceira mensagem automática
seguida (a mesma mensagem repetida também conta), o robô deixa um recado
("Quando o responsável puder, é só me chamar por aqui") e o lead fica pausado.
Quando uma pessoa de verdade escrever, `#robo` pelo celular ou o painel
devolvem ao robô.

## Quando o robô para sozinho

Segunda recusa da pessoa, ou um não definitivo ou hostil ("me tira da lista",
"não me mande mais"): o robô manda uma despedida curta e o lead fica
**pausado**, sem receber mais nada. A contagem de recusas é do próprio site
(não depende do modelo) e entra no fim da instrução como "Recusas até agora".
Para reativar, o painel ou `#robo` pelo celular.

## Só uma ponte por número

O site aceita o registro de uma ponte nova apenas se a antiga estiver morta
ou desconectada. Uma ponte que sobe enquanto outra está conectada (a do PC
com a do Fly no ar, por exemplo) recebe 409 e imprime no terminal "o site
recusou o registro: já existe uma ponte conectada em …". Desligue a outra
antes. Sem isso as duas brigam pela sessão, o WhatsApp derruba as duas (440)
e o painel fica apontando para a que morrer por último.

## "Aguardando mensagem. Essa ação pode levar alguns instantes"

É o celular de quem recebe (ou o seu) sem conseguir decifrar uma mensagem
que a ponte mandou. Ele pede o reenvio e a Baileys só reenvia se a ponte
souber o conteúdo original: por isso a ponte guarda o conteúdo de cada
mensagem enviada e o devolve em `getMessage`. Se ainda acontecer, a sessão
está suja (duas pontes com a mesma sessão, ou uma sessão apagada e recriada
enquanto o celular lembrava a antiga): desconecte pelo celular (Aparelhos
conectados) e leia o QR de novo, com uma ponte só no ar.
Medido em 30/09/2026: com a Baileys 6.7 o diario mostrava
`SessionError: No matching sessions found` em jids `@lid` e 46 dos ultimos 50
envios ficavam PENDENTE (sem confirmacao do servidor). A Baileys 7 (7.0.0-rc14)
reescreveu o suporte ao endereçamento LID; com ela os pendentes passaram a
sair e as confirmacoes (SERVIDOR, ENTREGUE, LIDA) apareceram. O
`/diagnostico` da ponte mostra `versao`, `envios.porStatus` (contagem dos
ultimos 50 envios por status) e os avisos da Baileys com numeros mascarados.

