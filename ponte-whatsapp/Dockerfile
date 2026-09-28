# A ponte do WhatsApp num container: roda em qualquer servidor com Docker.
FROM node:20-slim
WORKDIR /app
# Só o manifesto primeiro, para o cache do npm sobreviver a mudanças no código.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY ponte.mjs ./
# A sessão do WhatsApp e o diário vivem aqui; monte um volume nesta pasta
# para não precisar ler o QR de novo a cada reinício.
ENV PASTA_DADOS=/dados
VOLUME /dados
# O host injeta PORT; o servidor escuta nela.
ENV PORT=8080
EXPOSE 8080
CMD ["node", "ponte.mjs"]
