# 🌐 Despliegue usando Google Cloud Console (Sin instalar nada)

## 🚀 Método 1: Cloud Shell (Más Fácil)

### Paso 1: Abrir Cloud Shell
1. Ve a: https://console.cloud.google.com/
2. Selecciona tu proyecto: `gen-lang-client-0318357688`
3. Haz clic en el ícono de Cloud Shell (>_) en la barra superior derecha
4. Espera a que se active (puede tomar 1-2 minutos)

### Paso 2: Subir archivos del proyecto
**Opción A: Clonar desde GitHub**
```bash
# Si tu código está en GitHub
git clone https://github.com/tu-usuario/Bot-Wsp-Whapi-IA.git
cd Bot-Wsp-Whapi-IA
```

**Opción B: Subir archivos manualmente**
1. En Cloud Shell, haz clic en "Subir archivo" (ícono de carpeta)
2. Sube todos los archivos del proyecto (especialmente: Dockerfile, src/, package.json, etc.)

### Paso 3: Configurar secretos
```bash
# Habilitar APIs necesarias
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Crear secretos (reemplaza con tus valores reales)
echo "tu-openai-api-key-aqui" | gcloud secrets create openai-api-key --data-file=-
echo "tu-whapi-token-aqui" | gcloud secrets create whapi-token --data-file=-
echo "tu-assistant-id-aqui" | gcloud secrets create assistant-id --data-file=-

# Configurar permisos
PROJECT_NUMBER=$(gcloud projects describe gen-lang-client-0318357688 --format="value(projectNumber)")
gcloud projects add-iam-policy-binding gen-lang-client-0318357688 \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### Paso 4: Ejecutar despliegue
```bash
# Hacer ejecutable el script
chmod +x deploy-cloud-run.sh

# Ejecutar despliegue
./deploy-cloud-run.sh
```

---

## 🏗️ Método 2: Cloud Build (Automatizado)

### Paso 1: Configurar repositorio
1. Ve a: https://console.cloud.google.com/cloud-build/triggers
2. Haz clic en "Conectar repositorio"
3. Selecciona GitHub y conecta tu repositorio
4. Autoriza el acceso

### Paso 2: Crear activador
1. Haz clic en "Crear activador"
2. Configura:
   - **Nombre**: `deploy-bot-whapi`
   - **Evento**: Push a una rama
   - **Rama**: `^master$` (o `^main$`)
   - **Configuración**: Cloud Build configuration file (yaml or json)
   - **Ubicación**: `/cloudbuild.yaml`

### Paso 3: Configurar secretos (igual que método 1)
```bash
# En Cloud Shell
echo "tu-openai-api-key-aqui" | gcloud secrets create openai-api-key --data-file=-
echo "tu-whapi-token-aqui" | gcloud secrets create whapi-token --data-file=-
echo "tu-assistant-id-aqui" | gcloud secrets create assistant-id --data-file=-
```

### Paso 4: Hacer push para activar
```bash
# Hacer cualquier cambio y push
git add .
git commit -m "Deploy bot to Cloud Run"
git push origin master
```

---

## 🔧 Método 3: Despliegue Manual desde Console

### Paso 1: Crear repositorio de imágenes
1. Ve a: https://console.cloud.google.com/artifacts
2. Haz clic en "Crear repositorio"
3. Configura:
   - **Nombre**: `cloud-run-source-deploy`
   - **Formato**: Docker
   - **Región**: `northamerica-south1`

### Paso 2: Usar Cloud Build para construir
1. Ve a: https://console.cloud.google.com/cloud-build/builds
2. Haz clic en "Ejecutar compilación"
3. Configura:
   - **Fuente**: GitHub (conecta tu repo)
   - **Rama**: master
   - **Configuración de compilación**: Cloud Build configuration file
   - **Ubicación**: `/cloudbuild.yaml`

### Paso 3: Desplegar a Cloud Run
1. Ve a: https://console.cloud.google.com/run
2. Haz clic en "Crear servicio"
3. Configura:
   - **Imagen del contenedor**: Selecciona la imagen que acabas de construir
   - **Nombre del servicio**: `bot-wsp-whapi-ia-1-0`
   - **Región**: `northamerica-south1`
   - **Permitir invocaciones no autenticadas**: ✅
   - **CPU**: 1
   - **Memoria**: 1 GiB
   - **Puerto**: 8080

### Paso 4: Configurar variables de entorno
En la configuración del servicio:
- **Variables de entorno**:
  - `NODE_ENV` = `production`
  - `PORT` = `8080`
  - `LOG_LEVEL` = `production`
- **Secretos**:
  - `OPENAI_API_KEY` → `openai-api-key:latest`
  - `WHAPI_TOKEN` → `whapi-token:latest`
  - `ASSISTANT_ID` → `assistant-id:latest`

---

## ✅ Verificación del Despliegue

### Comprobar que funciona
1. Ve a la URL del servicio: https://bot-wsp-whapi-ia-1-0-908808352514.northamerica-south1.run.app
2. Prueba el endpoint de salud: https://bot-wsp-whapi-ia-1-0-908808352514.northamerica-south1.run.app/health
3. Configura el webhook en Whapi: https://bot-wsp-whapi-ia-1-0-908808352514.northamerica-south1.run.app/hook

### Ver logs
1. Ve a: https://console.cloud.google.com/run/detail/northamerica-south1/bot-wsp-whapi-ia-1-0
2. Haz clic en "Registros"
3. Filtra por gravedad si es necesario

---

## 🎯 Recomendación

**Para tu caso, te recomiendo el Método 1 (Cloud Shell)** porque:
- ✅ No necesitas instalar nada
- ✅ Es rápido y directo
- ✅ Tienes control total del proceso
- ✅ Puedes ver los logs en tiempo real

¿Cuál método prefieres usar? 