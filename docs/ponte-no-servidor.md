# A ponte do WhatsApp rodando 24 horas (servidor grátis)

A ponte (`ponte-whatsapp/`) liga o seu número por QR code e o robô só
responde enquanto ela está no ar. No seu PC, ela morre quando você desliga a
máquina. Para o robô atender 24 horas, a ponte roda num servidor.

O que o servidor precisa dar, e é onde a maioria dos "grátis" falha:
- **ficar sempre ligado** (o WhatsApp derruba a conexão se o processo dorme);
- **guardar um disco** (a sessão do WhatsApp, em `/dados`; sem isso você lê o
  QR de novo a cada reinício);
- **um endereço público** (o site chama a ponte por ele).

Dois caminhos grátis, do mais fácil ao mais robusto.

## Opção A — Fly.io (mais fácil, pela linha de comando)

O plano grátis do Fly dá uma máquina pequena sempre ligada e um disco. Pede
cartão para verificar identidade, mas não cobra dentro do plano grátis.

1. Instale o `flyctl`: em https://fly.io/docs/flyctl/install/ (no Windows,
   PowerShell: `iwr https://fly.io/install.ps1 -useb | iex`).
2. `fly auth signup` (cria a conta) ou `fly auth login`.
3. No terminal, entre na pasta: `cd ponte-whatsapp`.
4. Abra `fly.toml` e troque **as três** ocorrências de `SEUNOME` por um nome
   único (ex.: `astro-ponte-eduardo`). O `URL_PUBLICA` tem que casar com o
   nome do app.
5. `fly launch --no-deploy --copy-config --name astro-ponte-SEUNOME` (aceite
   a região `gru`, São Paulo). Se ele perguntar de banco/Redis, diga não.
6. Crie o disco da sessão: `fly volumes create dados --size 1 --region gru`.
7. Cadastre a chave (a mesma `EVOLUTION_API_KEY` da Vercel):
   `fly secrets set PONTE_CHAVE=coloque-a-mesma-chave-aqui`
8. `fly deploy`.
9. Veja o QR: `fly logs`. Aparece um bloco de QR no terminal; leia com o
   celular (WhatsApp → Aparelhos conectados). Ou abra o painel do site em
   `/admin` → Prospecção — o QR aparece lá sozinho.
10. Pronto: a ponte fica no ar e se registra no site sozinha. Pode desligar o
    PC. Para ver o que ela faz: `fly logs`. Para atualizar depois de mexer no
    código: `fly deploy` de novo.

O QR só é lido uma vez; a sessão fica no disco `/dados`.

## Opção B — Oracle Cloud Always Free (sem cobrança nenhuma, mais passos)

A Oracle dá uma máquina Linux **Always Free** de verdade (ARM, até 24 GB).
Pede cartão para criar a conta, mas a máquina nunca sai do grátis.

1. Crie a conta em https://cloud.oracle.com e uma **VM Instance** Always
   Free: shape `VM.Standard.A1.Flex`, imagem Ubuntu 22.04. Guarde a chave SSH.
   Na *Security List* da rede (VCN), libere a porta `443` de entrada.
2. Entre por SSH e instale o Node e o Caddy (para o https):
   ```
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs caddy git
   ```
3. Copie a pasta `ponte-whatsapp/` para o servidor (git clone do seu repo, ou
   `scp`). Dentro dela: `npm install`.
4. Um domínio grátis apontando para o IP da VM (DuckDNS, por exemplo:
   `seu-nome.duckdns.org`). No `/etc/caddy/Caddyfile`:
   ```
   seu-nome.duckdns.org {
     reverse_proxy localhost:3777
   }
   ```
   `sudo systemctl restart caddy` (o Caddy tira o certificado https sozinho).
5. Crie `.env` na pasta (a partir do `.env.exemplo`): `PONTE_CHAVE=` a mesma
   da Vercel, e `URL_PUBLICA=https://seu-nome.duckdns.org`.
6. Deixe a ponte sempre ligada com o PM2:
   ```
   sudo npm install -g pm2
   pm2 start ponte.mjs --name astro-ponte
   pm2 save && pm2 startup   (rode a linha que ele imprimir)
   ```
7. Veja o QR: `pm2 logs astro-ponte`. Leia com o celular. Pronto, 24 horas.

## Depois de subir, em qualquer opção

- O painel do site (`/admin` → Prospecção) mostra "Conectado" e o endereço da
  ponte. As conversas aparecem sozinhas.
- Se trocar de endereço (novo deploy no Fly mantém o mesmo; na Oracle o
  domínio é fixo), a ponte re-registra sozinha.
- A `EVOLUTION_API_URL` na Vercel deve ficar **em branco**: o site usa o
  endereço que a ponte registra. Só preencha se quiser fixar um.
