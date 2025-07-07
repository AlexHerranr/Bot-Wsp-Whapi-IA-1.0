#!/bin/bash

# Script para configurar secretos en Google Cloud Secret Manager
# Autor: Alexander - TeAlquilamos Bot

set -e

echo "🔐 Configurando secretos para TeAlquilamos Bot..."

PROJECT_ID="gen-lang-client-0318357688"
SERVICE_NAME="bot-wsp-whapi-ia-1-0"
REGION="northamerica-south1"

# Verificar que gcloud esté instalado y configurado
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI no está instalado"
    exit 1
fi

# Configurar proyecto
gcloud config set project ${PROJECT_ID}

# Habilitar API de Secret Manager
echo "🔧 Habilitando API de Secret Manager..."
gcloud services enable secretmanager.googleapis.com

# Función para crear secreto
create_secret() {
    local secret_name=$1
    local secret_description=$2
    
    echo "📝 Configurando secreto: $secret_name"
    
    # Verificar si el secreto ya existe
    if gcloud secrets describe $secret_name &> /dev/null; then
        echo "   ⚠️  El secreto $secret_name ya existe"
        read -p "   ¿Deseas actualizarlo? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "   🔄 Actualizando secreto existente..."
        else
            echo "   ⏭️  Saltando $secret_name"
            return
        fi
    else
        echo "   ✨ Creando nuevo secreto..."
        gcloud secrets create $secret_name --description="$secret_description"
    fi
    
    # Solicitar valor del secreto
    echo "   🔑 Ingresa el valor para $secret_name:"
    read -s secret_value
    
    if [ -z "$secret_value" ]; then
        echo "   ❌ Valor vacío, saltando..."
        return
    fi
    
    # Agregar versión del secreto
    echo "$secret_value" | gcloud secrets versions add $secret_name --data-file=-
    echo "   ✅ Secreto $secret_name configurado correctamente"
}

# Crear secretos necesarios
echo ""
echo "📋 Configurando secretos necesarios para el bot..."
echo ""

create_secret "openai-api-key" "Clave API de OpenAI para el bot TeAlquilamos"
create_secret "whapi-token" "Token de autenticación para Whapi"
create_secret "assistant-id" "ID del asistente de OpenAI"

# Configurar permisos para Cloud Run
echo ""
echo "🔧 Configurando permisos para Cloud Run..."

# Obtener el número de proyecto
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Dar permisos al service account de Cloud Run para acceder a los secretos
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"

echo "✅ Permisos configurados para: ${SERVICE_ACCOUNT}"

# Crear archivo de configuración para deployment
echo ""
echo "📄 Creando archivo de configuración para deployment..."

cat > cloud-run-deploy.yaml << EOF
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: ${SERVICE_NAME}
  annotations:
    run.googleapis.com/ingress: all
    run.googleapis.com/execution-environment: gen2
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "1Gi"
        run.googleapis.com/cpu: "1"
        run.googleapis.com/timeout: "300"
    spec:
      containerConcurrency: 1000
      timeoutSeconds: 300
      containers:
      - image: ${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/bot-wsp-whapi-ia-1.0/${SERVICE_NAME}:latest
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "8080"
        - name: LOG_LEVEL
          value: "production"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openai-api-key
              key: latest
        - name: WHAPI_TOKEN
          valueFrom:
            secretKeyRef:
              name: whapi-token
              key: latest
        - name: ASSISTANT_ID
          valueFrom:
            secretKeyRef:
              name: assistant-id
              key: latest
        resources:
          limits:
            cpu: "1"
            memory: "1Gi"
          requests:
            cpu: "0.5"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
  traffic:
  - percent: 100
    latestRevision: true
EOF

echo "✅ Archivo cloud-run-deploy.yaml creado"

echo ""
echo "🎉 ¡Configuración de secretos completada!"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Ejecuta: ./deploy-cloud-run.sh"
echo "   2. O usa: gcloud run services replace cloud-run-deploy.yaml --region=${REGION}"
echo ""
echo "🔍 Para verificar los secretos:"
echo "   gcloud secrets list"
echo ""
echo "🔑 Para ver las versiones de un secreto:"
echo "   gcloud secrets versions list [SECRET_NAME]"
echo "" 