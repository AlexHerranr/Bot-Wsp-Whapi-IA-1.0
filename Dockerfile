# Dockerfile para Google Cloud Run
FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY src/ ./src/

# Compilar TypeScript
RUN npm run build

# Exponer puerto
EXPOSE 3008

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3008

# Comando de inicio
CMD ["node", "dist/app.js"]