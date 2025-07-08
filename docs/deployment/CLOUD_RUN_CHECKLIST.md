# ✅ Checklist Completo para Google Cloud Run

## 📋 Pre-requisitos del Sistema

### 1. Herramientas Necesarias
- [ ] **Google Cloud CLI** instalado y configurado
- [ ] **Docker** instalado y funcionando
- [ ] **Cuenta de Google Cloud** con facturación habilitada
- [ ] **Proyecto de Google Cloud** creado (`gen-lang-client-0318357688`)

### 2. Verificar Instalaciones
```bash
# Verificar gcloud
gcloud version

# Verificar Docker
docker --version

# Verificar autenticación
gcloud auth list
```

## 🔧 Configuración Inicial

### 3. Configurar Proyecto
```bash
# Configurar proyecto
gcloud config set project gen-lang-client-0318357688

# Verificar configuración
gcloud config list
```

### 4. Habilitar APIs Necesarias
```bash
# Habilitar APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

## 🔐 Configuración de Secretos

### 5. Configurar Secret Manager
- [ ] Ejecutar: `chmod +x setup-secrets.sh`
- [ ] Ejecutar: `./setup-secrets.sh`
- [ ] Ingresar **OPENAI_API_KEY**
- [ ] Ingresar **WHAPI_TOKEN**  
- [ ] Ingresar **ASSISTANT_ID**

### 6. Verificar Secretos
```bash
# Listar secretos
gcloud secrets list

# Verificar versiones
gcloud secrets versions list openai-api-key
gcloud secrets versions list whapi-token
gcloud secrets versions list assistant-id
```

## 📦 Configuración de Artifact Registry

### 7. Crear Repositorio
```bash
# Crear repositorio si no existe
gcloud artifacts repositories create cloud-run-source-deploy \
    --repository-format=docker \
    --location=northamerica-south1 \
    --description="Repositorio para TeAlquilamos Bot"
```

### 8. Configurar Docker
```bash
# Configurar autenticación Docker
gcloud auth configure-docker northamerica-south1-docker.pkg.dev
```

## 🚀 Despliegue

### Opción A: Despliegue Automático
- [ ] Ejecutar: `chmod +x deploy-cloud-run.sh`
- [ ] Ejecutar: `./deploy-cloud-run.sh`

### Opción B: Despliegue Manual (tu plan actual)

#### 9. Crear Repositorio Artifact Registry
- [ ] Ir a: https://console.cloud.google.com/artifacts
- [ ] Crear repositorio: `cloud-run-source-deploy`
- [ ] Formato: Docker
- [ ] Región: `northamerica-south1`

#### 10. Construir Imagen con Cloud Build
- [ ] Ir a: https://console.cloud.google.com/cloud-build/builds
- [ ] Ejecutar compilación
- [ ] Fuente: GitHub `AlexHerranr/Bot-Wsp-Whapi-IA-1.0`
- [ ] Rama: `master`
- [ ] Dockerfile: `/` (raíz)
- [ ] Nombre imagen: `northamerica-south1-docker.pkg.dev/gen-lang-client-0318357688/cloud-run-source-deploy/bot-wsp-whapi-ia:latest`

#### 11. Crear Servicio Cloud Run
- [ ] Ir a: https://console.cloud.google.com/run
- [ ] Crear servicio
- [ ] Seleccionar imagen construida
- [ ] Configuración:
  - Nombre: `bot-wsp-whapi-ia`
  - Región: `northamerica-south1`
  - Permitir invocaciones no autenticadas: ✅
  - Puerto: `8080`
  - CPU: `1`
  - Memoria: `1 GiB`
  - Timeout: `300 segundos`
  - Min instancias: `0`
  - Max instancias: `10`

#### 12. Configurar Variables de Entorno
- [ ] Variables básicas:
  - `NODE_ENV` = `production`
  - `PORT` = `8080`
  - `LOG_LEVEL` = `production`
- [ ] Secretos:
  - `OPENAI_API_KEY` → `openai-api-key:latest`
  - `WHAPI_TOKEN` → `whapi-token:latest`
  - `ASSISTANT_ID` → `assistant-id:latest`

## ✅ Verificación Post-Despliegue

### 13. Verificar Servicios
- [ ] Servicio desplegado exitosamente
- [ ] URL del servicio obtenida
- [ ] Health check funciona: `https://tu-url/health`

### 14. Configurar Webhook
- [ ] Configurar webhook en Whapi: `https://tu-url/hook`
- [ ] Probar envío de mensaje de prueba

### 15. Monitoreo
- [ ] Verificar logs: https://console.cloud.google.com/logs
- [ ] Verificar métricas: https://console.cloud.google.com/run
- [ ] Verificar alertas (opcional)

## 🔍 Comandos Útiles

### Logs
```bash
# Ver logs del servicio
gcloud run services logs read bot-wsp-whapi-ia --region=northamerica-south1

# Logs en tiempo real
gcloud run services logs tail bot-wsp-whapi-ia --region=northamerica-south1
```

### Gestión del Servicio
```bash
# Describir servicio
gcloud run services describe bot-wsp-whapi-ia --region=northamerica-south1

# Actualizar servicio
gcloud run services update bot-wsp-whapi-ia --region=northamerica-south1

# Eliminar servicio
gcloud run services delete bot-wsp-whapi-ia --region=northamerica-south1
```

### Gestión de Secretos
```bash
# Actualizar secreto
echo "nuevo-valor" | gcloud secrets versions add nombre-secreto --data-file=-

# Ver valor de secreto (solo si tienes permisos)
gcloud secrets versions access latest --secret="nombre-secreto"
```

## 🚨 Solución de Problemas

### Errores Comunes
1. **Error de permisos**: Verificar roles IAM
2. **Error de build**: Verificar Dockerfile y dependencias
3. **Error de secretos**: Verificar Secret Manager
4. **Error de red**: Verificar firewall y configuración VPC
5. **Error de memoria**: Ajustar límites de memoria

### Contactos de Soporte
- Documentación: https://cloud.google.com/run/docs
- Soporte: https://cloud.google.com/support

---

**Fecha de creación**: $(date)
**Versión**: 1.0
**Autor**: Alexander - TeAlquilamos Bot 