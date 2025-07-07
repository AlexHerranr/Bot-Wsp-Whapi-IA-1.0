# Dockerfile para Google Cloud Run
FROM node:18-alpine

WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache python3 make g++

# Copiar archivos de dependencias
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY tsconfig.json ./

# Instalar pnpm globalmente
RUN npm install -g pnpm

# Instalar dependencias usando pnpm (más rápido y eficiente)
RUN pnpm install --frozen-lockfile --prod=false

# Copiar configuración de rollup
COPY rollup.config.js ./
COPY config/ ./config/

# Copiar código fuente
COPY src/ ./src/
COPY RAG* ./RAG*/

# Compilar TypeScript usando rollup
RUN pnpm run build

# Crear directorio de logs
RUN mkdir -p /app/logs

# Limpiar dependencias de desarrollo para reducir tamaño
RUN pnpm prune --prod

# Exponer puerto 8080 (requerido por Cloud Run)
EXPOSE 8080

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=8080

# Comando de inicio
CMD ["node", "dist/app.js"]