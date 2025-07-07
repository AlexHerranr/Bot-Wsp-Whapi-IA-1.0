# Multi-stage Dockerfile optimizado para Cloud Run
FROM node:18-alpine AS deps
WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache python3 make g++

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml ./

# Instalar pnpm y dependencias
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Stage de build
FROM node:18-alpine AS builder
WORKDIR /app

# Copiar dependencias del stage anterior
COPY --from=deps /app/node_modules ./node_modules

# Copiar archivos de configuración
COPY package.json pnpm-lock.yaml tsconfig.json rollup.config.js ./
COPY config/ ./config/

# Copiar código fuente
COPY src/ ./src/
COPY RAG* ./RAG*/

# Instalar pnpm y compilar
RUN npm install -g pnpm && \
    pnpm run build

# Stage de producción
FROM node:18-alpine AS runner
WORKDIR /app

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=8080

# Crear usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar archivos compilados y dependencias de producción
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules

# Crear directorio de logs con permisos
RUN mkdir -p /app/logs && \
    chown -R nextjs:nodejs /app

# Cambiar a usuario no-root
USER nextjs

# Exponer puerto 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Comando de inicio
CMD ["node", "dist/app.js"]