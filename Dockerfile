# Multi-stage Dockerfile optimizado para Railway/Cloud Run
FROM node:18-bullseye AS deps
WORKDIR /app

# Copiar solo archivos de dependencias primero
COPY package.json package-lock.json ./

# Instalar dependencias de producción (sin scripts de post-install)
RUN npm ci --only=production --ignore-scripts

# Stage de build
FROM node:18-bullseye AS builder
WORKDIR /app

# Instalar dependencias de sistema y Chrome para Puppeteer
RUN apt-get update && apt-get install -y \
    ca-certificates curl gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    fontconfig fonts-freefont-ttf libfontconfig libfreetype6 libjpeg62-turbo libpng16-16 libx11-6 libxcb1 libxext6 libxrender1 xfonts-75dpi xfonts-base \
    libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcairo2 libcups2 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libxrandr2 libxss1 libxtst6 \
    libasound2 libexpat1 libfontconfig1 libpangocairo-1.0-0 libx11-xcb1 lsb-release wget xdg-utils \
    fonts-liberation fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst \
    python3 make g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copiar dependencias de producción
COPY --from=deps /app/node_modules ./node_modules

# Instalar todas las dependencias (incluidas dev)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copiar código fuente y archivos de configuración
COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/
COPY scripts/ ./scripts/

# Generar Prisma client y compilar aplicación
RUN npx prisma generate
RUN npm run build

# Stage de producción - imagen mínima con Chrome
FROM node:18-bullseye-slim AS runner
WORKDIR /app

# Variables de entorno para producción (Railway setea PORT dinámicamente)
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=768" \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Instalar Chrome en producción (slim version)
RUN apt-get update && apt-get install -y \
    ca-certificates curl gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario no-root (sintaxis Debian)
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs

# Copiar solo lo necesario
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist  
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --chown=nodejs:nodejs package.json ./

# Crear directorios necesarios
RUN mkdir -p /app/logs /app/tmp && \
    chown -R nodejs:nodejs /app

# Cambiar a usuario no-root
USER nodejs

# Exponer puerto (Railway usa el puerto de la variable PORT)
EXPOSE 8080

# Health check usando variable PORT
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "const port = process.env.PORT || 8080; require('http').get('http://localhost:' + port + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Comando de inicio directo (adaptado a arquitectura actual)
CMD ["node", "--max-old-space-size=768", "dist/main.js"]