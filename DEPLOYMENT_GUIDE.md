# 🚀 Guía de Despliegue - TeAlquilamos Bot en Google Cloud Run

## 📋 Resumen del Problema

El error que estás viendo indica que la imagen Docker no se encuentra en el registro de Google Cloud. Esto sucede porque:

1. **La imagen no se construyó correctamente**
2. **La imagen no se subió al registro**
3. **Hay problemas de configuración en el Dockerfile**

## 🔧 Solución Completa

### Paso 1: Prerequisitos

Asegúrate de tener instalado:

- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
- [Docker Desktop](https://docs.docker.com/get-docker/)
- Git Bash o PowerShell (Windows)

### Paso 2: Autenticación

```bash
# Autenticarse con Google Cloud
gcloud auth login

# Configurar el proyecto
gcloud config set project gen-lang-client-0318357688

# Verificar configuración
gcloud config list
```

### Paso 3: Configurar Secretos (Recomendado)

**Opción A: Usar el script automático**
```bash
# En Git Bash (Windows) o Terminal (Mac/Linux)
./setup-secrets.sh

# En PowerShell (Windows)
# Ejecutar manualmente los comandos del script
```

**Opción B: Configurar manualmente**
```bash
# Habilitar Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Crear secretos
echo "tu-openai-api-key" | gcloud secrets create openai-api-key --data-file=-
echo "tu-whapi-token" | gcloud secrets create whapi-token --data-file=-
echo "tu-assistant-id" | gcloud secrets create assistant-id --data-file=-

# Configurar permisos
PROJECT_NUMBER=$(gcloud projects describe gen-lang-client-0318357688 --format="value(projectNumber)")
gcloud projects add-iam-policy-binding gen-lang-client-0318357688 \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### Paso 4: Desplegar el Bot

**Opción A: Script Automático (Recomendado)**

En Git Bash:
```bash
./deploy-cloud-run.sh
```

En PowerShell:
```powershell
.\deploy-cloud-run.ps1
```

**Opción B: Comandos Manuales**

```bash
# 1. Habilitar APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# 2. Configurar Docker
gcloud auth configure-docker northamerica-south1-docker.pkg.dev

# 3. Construir imagen
docker build -t northamerica-south1-docker.pkg.dev/gen-lang-client-0318357688/cloud-run-source-deploy/bot-wsp-whapi-ia-1.0/bot-wsp-whapi-ia-1-0:latest .

# 4. Subir imagen
docker push northamerica-south1-docker.pkg.dev/gen-lang-client-0318357688/cloud-run-source-deploy/bot-wsp-whapi-ia-1.0/bot-wsp-whapi-ia-1-0:latest

# 5. Desplegar servicio
gcloud run deploy bot-wsp-whapi-ia-1-0 \
    --image=northamerica-south1-docker.pkg.dev/gen-lang-client-0318357688/cloud-run-source-deploy/bot-wsp-whapi-ia-1.0/bot-wsp-whapi-ia-1-0:latest \
    --platform=managed \
    --region=northamerica-south1 \
    --allow-unauthenticated \
    --port=8080 \
    --memory=1Gi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=10 \
    --timeout=300 \
    --set-env-vars="NODE_ENV=production,PORT=8080,LOG_LEVEL=production"
```

### Paso 5: Configurar Variables de Entorno

Si no usaste Secret Manager, configura las variables manualmente:

```bash
gcloud run services update bot-wsp-whapi-ia-1-0 \
    --region=northamerica-south1 \
    --set-env-vars="OPENAI_API_KEY=tu-clave-aqui,WHAPI_TOKEN=tu-token-aqui,ASSISTANT_ID=tu-id-aqui"
```

## 🔍 Verificación del Despliegue

### Comprobar Estado del Servicio

```bash
# Ver estado del servicio
gcloud run services describe bot-wsp-whapi-ia-1-0 --region=northamerica-south1

# Ver logs en tiempo real
gcloud run services logs tail bot-wsp-whapi-ia-1-0 --region=northamerica-south1

# Probar endpoint de salud
curl https://bot-wsp-whapi-ia-1-0-908808352514.northamerica-south1.run.app/health
```

### Configurar Webhook

Una vez desplegado, configura el webhook en Whapi:

**URL del Webhook:**
```
https://bot-wsp-whapi-ia-1-0-908808352514.northamerica-south1.run.app/hook
```

## 🛠️ Solución de Problemas

### Error: "Image not found"

**Causa:** La imagen no se subió correctamente al registro.

**Solución:**
```bash
# Verificar que la imagen existe
gcloud container images list --repository=northamerica-south1-docker.pkg.dev/gen-lang-client-0318357688/cloud-run-source-deploy

# Si no existe, reconstruir y subir
docker build -t northamerica-south1-docker.pkg.dev/gen-lang-client-0318357688/cloud-run-source-deploy/bot-wsp-whapi-ia-1.0/bot-wsp-whapi-ia-1-0:latest .
docker push northamerica-south1-docker.pkg.dev/gen-lang-client-0318357688/cloud-run-source-deploy/bot-wsp-whapi-ia-1.0/bot-wsp-whapi-ia-1-0:latest
```

### Error: "Build failed"

**Causa:** Problemas en el Dockerfile o dependencias.

**Solución:**
```bash
# Probar build local
docker build -t test-bot .

# Ver logs detallados
docker build -t test-bot . --progress=plain --no-cache
```

### Error: "Permission denied"

**Causa:** Falta de permisos en el proyecto.

**Solución:**
```bash
# Verificar permisos
gcloud projects get-iam-policy gen-lang-client-0318357688

# Agregar rol de Cloud Run Developer
gcloud projects add-iam-policy-binding gen-lang-client-0318357688 \
    --member="user:tu-email@gmail.com" \
    --role="roles/run.developer"
```

## 📊 Monitoreo y Logs

### Acceder a Logs

- **Consola Web:** https://console.cloud.google.com/run/detail/northamerica-south1/bot-wsp-whapi-ia-1-0
- **CLI:** `gcloud run services logs read bot-wsp-whapi-ia-1-0 --region=northamerica-south1`

### Métricas Importantes

- **Latencia de respuesta**
- **Tasa de errores**
- **Uso de CPU y memoria**
- **Número de instancias activas**

## 🔄 Actualizaciones Futuras

Para actualizar el bot:

```bash
# 1. Hacer cambios en el código
# 2. Reconstruir imagen
docker build -t northamerica-south1-docker.pkg.dev/gen-lang-client-0318357688/cloud-run-source-deploy/bot-wsp-whapi-ia-1.0/bot-wsp-whapi-ia-1-0:latest .

# 3. Subir nueva versión
docker push northamerica-south1-docker.pkg.dev/gen-lang-client-0318357688/cloud-run-source-deploy/bot-wsp-whapi-ia-1.0/bot-wsp-whapi-ia-1-0:latest

# 4. Cloud Run detectará automáticamente la nueva imagen y desplegará
```

## 📞 Contacto y Soporte

- **Documentación:** [Google Cloud Run](https://cloud.google.com/run/docs)
- **Logs del Bot:** `/logs` directory (configurado en el bot)
- **Monitoreo:** Google Cloud Console

---

**✅ Con esta guía, tu bot debería desplegarse correctamente en Google Cloud Run.** 