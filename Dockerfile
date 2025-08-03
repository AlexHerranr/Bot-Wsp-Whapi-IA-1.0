# Dockerfile optimizado para Railway (estándar de industria)
FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias primero (mejor cache)
COPY package.json package-lock.json ./

# Instalar dependencias de producción
RUN npm ci --only=production

# Copiar schema y generar Prisma client (separado del build)
COPY prisma ./prisma/
RUN npx prisma generate

# Copiar código fuente
COPY src ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Crear directorios necesarios
RUN mkdir -p logs tmp

# Variables de entorno optimizadas para Railway
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Exponer puerto Railway
EXPOSE 8080

# Health check ligero
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=2 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start optimizado
CMD ["node", "--max-old-space-size=512", "dist/main.js"]