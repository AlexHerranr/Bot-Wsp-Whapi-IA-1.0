# 🚀 Despliegue Rápido - Optimización del Proceso

## ⚡ **Métodos para Acelerar el Despliegue**

### **1. 🎯 Despliegue Directo (Sin Git Push)**

```bash
# Despliegue directo desde tu PC a Cloud Run
gcloud run deploy bot-wsp-whapi-ia --source . --region=northamerica-northeast1 --allow-unauthenticated
```

**Ventajas:**
- ✅ **Más rápido** - no necesitas push/commit
- ✅ **Directo** - desde tu PC a Cloud Run
- ✅ **Ideal para pruebas** - cambios rápidos

### **2. 🔄 Despliegue Automático con Git**

```bash
# Configurar para que cada push despliegue automáticamente
# En cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - run
      - deploy
      - bot-wsp-whapi-ia
      - --source=.
      - --region=northamerica-northeast1
      - --allow-unauthenticated
```

**Ventajas:**
- ✅ **Automático** - cada push despliega
- ✅ **Versionado** - cada cambio tiene su commit
- ✅ **Historial** - puedes hacer rollback

### **3. 🏗️ Build Optimizado**

```dockerfile
# Dockerfile optimizado para builds rápidos
FROM node:18-alpine

WORKDIR /app

# Copiar solo package.json primero (para cache de dependencias)
COPY package*.json ./
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Build más rápido
RUN npm run build

EXPOSE 8080
CMD ["npm", "start"]
```

## 📋 **Workflow Recomendado por Tipo de Cambio**

### **🔄 Cambios en Código (app.ts, funciones, etc.)**

```bash
# Opción 1: Despliegue directo (más rápido)
gcloud run deploy bot-wsp-whapi-ia --source . --region=northamerica-northeast1

# Opción 2: Git push (más organizado)
git add .
git commit -m "Cambios en app.ts"
git push
```

### **🔑 Cambios en Configuración (API keys, URLs)**

```bash
# Actualizar secretos (NO requiere rebuild)
gcloud secrets create OPENAI_API_KEY --data-file=-
gcloud secrets create WHAPI_TOKEN --data-file=-

# Cloud Run reinicia automáticamente
```

### **📦 Cambios en Dependencias (package.json)**

```bash
# Requiere rebuild completo
git add package.json package-lock.json
git commit -m "Actualizar dependencias"
git push
```

## ⚡ **Optimizaciones para Despliegue Rápido**

### **1. Build Cache**

```yaml
# cloudbuild.yaml optimizado
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - build
      - --cache-from
      - gcr.io/$PROJECT_ID/bot-wsp-whapi-ia:latest
      - -t
      - gcr.io/$PROJECT_ID/bot-wsp-whapi-ia:$COMMIT_SHA
      - .
```

### **2. Dependencias Pre-instaladas**

```dockerfile
# Usar imagen base con dependencias comunes
FROM node:18-alpine

# Instalar dependencias comunes
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
```

### **3. Multi-stage Build**

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --only=production
EXPOSE 8080
CMD ["npm", "start"]
```

## 🎯 **Comandos Rápidos para Desarrollo**

### **Scripts en package.json**

```json
{
  "scripts": {
    "deploy:fast": "gcloud run deploy bot-wsp-whapi-ia --source . --region=northamerica-northeast1 --allow-unauthenticated",
    "deploy:staging": "gcloud run deploy bot-wsp-whapi-ia-staging --source . --region=northamerica-northeast1 --allow-unauthenticated",
    "logs:live": "gcloud run services logs tail bot-wsp-whapi-ia --region=northamerica-northeast1",
    "logs:staging": "gcloud run services logs tail bot-wsp-whapi-ia-staging --region=northamerica-northeast1"
  }
}
```

### **Uso Rápido**

```bash
# Despliegue rápido
npm run deploy:fast

# Ver logs en tiempo real
npm run logs:live

# Despliegue a staging
npm run deploy:staging
```

## 🔍 **Monitoreo de Despliegue**

### **Ver Estado del Despliegue**

```bash
# Ver servicios activos
gcloud run services list

# Ver revisiones
gcloud run revisions list --service=bot-wsp-whapi-ia

# Ver logs específicos
gcloud run services logs read bot-wsp-whapi-ia --limit=50
```

### **Rollback Rápido**

```bash
# Volver a versión anterior
gcloud run services update-traffic bot-wsp-whapi-ia --to-revisions=REVISION_NAME=100

# Ver revisiones disponibles
gcloud run revisions list --service=bot-wsp-whapi-ia
```

## 🎯 **Resumen: Cuándo Usar Cada Método**

| Tipo de Cambio | Método Recomendado | Tiempo |
|----------------|-------------------|---------|
| **Código (app.ts)** | `gcloud run deploy --source .` | 2-3 min |
| **Configuración** | `gcloud secrets create` | 30 seg |
| **Dependencias** | `git push` | 5-7 min |
| **Pruebas rápidas** | Desarrollo local | Instantáneo |

**Para tu caso: Si cambias `app.ts`, usa `gcloud run deploy --source .` para despliegue directo y rápido.** 