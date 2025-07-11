#!/bin/bash
# test-improvements.sh - Script para verificar las mejoras implementadas

echo "🧪 Iniciando pruebas del bot mejorado..."
echo "================================================"

# Configurar proyecto y región
PROJECT_ID="gen-lang-client-0318357688"
SERVICE_NAME="bot-wsp-whapi-ia"
REGION="northamerica-northeast1"

# 1. Verificar estado del servicio
echo -e "\n1️⃣ Verificando estado del servicio..."
gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --format="value(status.url)"

# 2. Verificar logs sin warnings de normalización
echo -e "\n2️⃣ Verificando logs limpios (sin normalizaciones)..."
echo "Últimos 10 logs sin warnings de categorías:"
gcloud logging read \
    "resource.type=cloud_run_revision AND \
     resource.labels.service_name=$SERVICE_NAME AND \
     NOT textPayload:\"Category normalized\"" \
    --limit=10 \
    --format="table(timestamp,jsonPayload.category,jsonPayload.message)" \
    --project=$PROJECT_ID

# 3. Verificar runs de OpenAI
echo -e "\n3️⃣ Verificando runs de OpenAI..."
echo "Runs iniciados en los últimos 30 minutos:"
gcloud logging read \
    "resource.type=cloud_run_revision AND \
     resource.labels.service_name=$SERVICE_NAME AND \
     jsonPayload.category=\"OPENAI_RUN_STARTED\" AND \
     timestamp>=\"$(date -u -d '30 minutes ago' '+%Y-%m-%dT%H:%M:%S')Z\"" \
    --limit=10 \
    --format="table(timestamp,jsonPayload.details.runId,jsonPayload.details.userId)" \
    --project=$PROJECT_ID

# 4. Buscar conflictos de runs
echo -e "\n4️⃣ Buscando conflictos de runs..."
echo "Conflictos detectados:"
gcloud logging read \
    "resource.type=cloud_run_revision AND \
     resource.labels.service_name=$SERVICE_NAME AND \
     (jsonPayload.category=\"OPENAI_RUN_ACTIVE\" OR \
      jsonPayload.category=\"OPENAI_RUN_CANCEL\")" \
    --limit=5 \
    --format="table(timestamp,jsonPayload.category,jsonPayload.message)" \
    --project=$PROJECT_ID

# 5. Verificar respuestas exitosas
echo -e "\n5️⃣ Verificando respuestas exitosas..."
echo "Últimas respuestas completadas:"
gcloud logging read \
    "resource.type=cloud_run_revision AND \
     resource.labels.service_name=$SERVICE_NAME AND \
     jsonPayload.category=\"MESSAGE_COMPLETE\"" \
    --limit=5 \
    --format="table(timestamp,jsonPayload.details.userId,jsonPayload.details.messageCount,jsonPayload.details.processingTimeMs)" \
    --project=$PROJECT_ID

# 6. Verificar duplicados
echo -e "\n6️⃣ Verificando ausencia de duplicados..."
echo "Mensajes enviados en los últimos 10 minutos (debería ser 1 por usuario):"
gcloud logging read \
    "resource.type=cloud_run_revision AND \
     resource.labels.service_name=$SERVICE_NAME AND \
     jsonPayload.category=\"WHATSAPP_SEND\" AND \
     timestamp>=\"$(date -u -d '10 minutes ago' '+%Y-%m-%dT%H:%M:%S')Z\"" \
    --format="table(timestamp,jsonPayload.details.userId,jsonPayload.details.preview)" \
    --project=$PROJECT_ID | sort | uniq -c

# 7. Resumen de errores
echo -e "\n7️⃣ Resumen de errores (últimas 2 horas)..."
gcloud logging read \
    "resource.type=cloud_run_revision AND \
     resource.labels.service_name=$SERVICE_NAME AND \
     jsonPayload.level=\"ERROR\" AND \
     timestamp>=\"$(date -u -d '2 hours ago' '+%Y-%m-%dT%H:%M:%S')Z\"" \
    --limit=10 \
    --format="table(timestamp,jsonPayload.category,jsonPayload.details.error)" \
    --project=$PROJECT_ID

# 8. Métricas de performance
echo -e "\n8️⃣ Métricas de performance..."
echo "Tiempos de procesamiento promedio:"
gcloud logging read \
    "resource.type=cloud_run_revision AND \
     resource.labels.service_name=$SERVICE_NAME AND \
     jsonPayload.category=\"OPENAI_RUN_COMPLETED\" AND \
     timestamp>=\"$(date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M:%S')Z\"" \
    --format="value(jsonPayload.details.duration)" \
    --project=$PROJECT_ID | awk '{sum+=$1; count++} END {if(count>0) printf "Promedio: %.2f ms (%d muestras)\n", sum/count, count}'

echo -e "\n✅ Pruebas completadas!"
echo "================================================"

# Test manual opcional
echo -e "\n💡 Para hacer una prueba manual, ejecuta:"
echo "curl -X POST https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app/hook \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"messages\": [{\"from\": \"573003913251@s.whatsapp.net\", \"body\": \"Test message\", \"id\": \"test-$(date +%s)\"}]}'" 