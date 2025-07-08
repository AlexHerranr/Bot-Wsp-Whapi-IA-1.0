# Multi-stage Dockerfile optimizado para Cloud Run
FROM node:18-alpine AS deps
WORKDIR /app

# Copiar solo archivos de dependencias primero
COPY package.json pnpm-lock.yaml ./

# Instalar pnpm y dependencias (sin scripts de post-install)
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# Stage de build
FROM node:18-alpine AS builder
WORKDIR /app

# Instalar dependencias del sistema necesarias para compilar
RUN apk add --no-cache python3 make g++

# Copiar dependencias de producción
COPY --from=deps /app/node_modules ./node_modules

# Instalar dependencias de desarrollo
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --ignore-scripts

# Copiar código fuente y archivos de configuración
COPY tsconfig.json ./
COPY src/ ./src/
COPY config/ ./config/

# Compilar aplicación
RUN pnpm run build

# Stage de producción - imagen mínima
FROM node:18-alpine AS runner
WORKDIR /app

# Variables de entorno para Cloud Run
ENV NODE_ENV=production \
    PORT=8080 \
    NODE_OPTIONS="--max-old-space-size=768"

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar solo lo necesario
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package.json ./

# Crear directorios necesarios
RUN mkdir -p /app/logs /app/tmp && \
    chown -R nodejs:nodejs /app

# Cambiar a usuario no-root
USER nodejs

# Exponer puerto
EXPOSE 8080

# Health check simplificado
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Comando de inicio directo
CMD ["node", "--max-old-space-size=768", "dist/app.js"]