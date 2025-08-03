# Multi-stage build para Railway con Prisma
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production --ignore-scripts

FROM node:18-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --chown=nodejs:nodejs package.json ./
RUN mkdir -p /app/logs /app/tmp && \
    chown -R nodejs:nodejs /app

USER nodejs
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"
EXPOSE $PORT

# Health check adaptativo al puerto Railway
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=2 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3010) + '/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "--max-old-space-size=512", "dist/main.js"]