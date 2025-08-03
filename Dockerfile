# Multi-stage Dockerfile optimizado para Railway/Cloud Run
FROM node:18-alpine AS deps
WORKDIR /app

# Copiar solo archivos de dependencias primero
COPY package.json package-lock.json ./

# Instalar dependencias de producción (sin scripts de post-install)
RUN npm ci --only=production --ignore-scripts

# Stage de build
FROM node:18-alpine AS builder
WORKDIR /app

# Instalar dependencias del sistema necesarias para compilar
RUN apk add --no-cache python3 make g++

# Copiar dependencias de producción
COPY --from=deps /app/node_modules ./node_modules

# Instalar todas las dependencias (incluidas dev)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copiar código fuente y archivos de configuración
COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generar Prisma client y compilar aplicación
RUN npx prisma generate
RUN npm run build

# Stage de producción - imagen mínima
FROM node:18-alpine AS runner
WORKDIR /app

# Variables de entorno para producción (Railway setea PORT dinámicamente)
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=768"

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar solo lo necesario
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
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

# Comando de inicio directo
CMD ["node", "--max-old-space-size=768", "dist/main.js"]