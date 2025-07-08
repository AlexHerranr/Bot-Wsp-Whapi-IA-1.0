#!/bin/bash

# Script de diagnóstico rápido para Cloud Run
# Ejecutar: chmod +x diagnose-cloud-run.sh && ./diagnose-cloud-run.sh

echo "🔍 DIAGNÓSTICO CLOUD RUN - Bot WhatsApp"
echo "========================================"
echo ""

SERVICE_NAME="bot-wsp-whapi-ia"
REGION="northamerica-northeast1"

# 1. Verificar servicio
echo "1️⃣ INFORMACIÓN DEL SERVICIO:"
echo "-----------------------------"
gcloud run services describe $SERVICE_NAME --region $REGION --format="table(
    status.url,
    status.latestReadyRevisionName,
    status.conditions[0].type,
    status.conditions[0].status
)" 2>/dev/null || echo "❌ Servicio no encontrado"
echo ""

# 2. Obtener última revisión
echo "2️⃣ ÚLTIMA REVISIÓN:"
echo "-------------------"
LATEST_REV=$(gcloud run revisions list --service $SERVICE_NAME --region $REGION --limit 1 --format="value(metadata.name)" 2>/dev/null)
echo "Revisión: $LATEST_REV"
echo ""

# 3. Ver logs de error
echo "3️⃣ ÚLTIMOS LOGS DE ERROR:"
echo "-------------------------"
echo "Buscando errores de inicialización..."
gcloud run services logs read $SERVICE_NAME \
    --region $REGION \
    --limit 30 \
    --format="table(timestamp,severity,textPayload)" | grep -E "(ERROR|Error|error|Failed|failed|Cannot|Missing|ENOENT)" | head -20
echo ""

# 4. Logs de inicio
echo "4️⃣ LOGS DE INICIO DEL CONTENEDOR:"
echo "---------------------------------"
gcloud run services logs read $SERVICE_NAME \
    --region $REGION \
    --limit 50 | grep -E "(Starting|Listening|Server|PORT|8080|initialization)" | tail -10
echo ""

# 5. Variables de entorno
echo "5️⃣ VARIABLES DE ENTORNO CONFIGURADAS:"
echo "-------------------------------------"
gcloud run services describe $SERVICE_NAME \
    --region $REGION \
    --format="table(spec.template.spec.containers[0].env[*].name:label=VARIABLE,spec.template.spec.containers[0].env[*].value:label=VALOR)" 2>/dev/null
echo ""

# 6. Verificar archivos locales
echo "6️⃣ VERIFICACIÓN LOCAL:"
echo "----------------------"
echo -n "¿Existe dist/src/app.js? "
if [ -f "dist/src/app.js" ]; then
    echo "✅ SÍ"
    echo "Tamaño: $(ls -lh dist/src/app.js | awk '{print $5}')"
elif [ -f "dist/app.js" ]; then
    echo "⚠️  NO, pero existe dist/app.js"
    echo "ACCIÓN: Actualizar Dockerfile CMD a 'dist/app.js'"
else
    echo "❌ NO"
    echo "ACCIÓN: Ejecutar 'npm run build'"
fi
echo ""

# 7. Posibles soluciones
echo "7️⃣ DIAGNÓSTICO Y SOLUCIONES:"
echo "----------------------------"

# Buscar patrones específicos en logs
if gcloud run services logs read $SERVICE_NAME --region $REGION --limit 50 2>/dev/null | grep -q "Cannot find module"; then
    echo "❌ PROBLEMA: Módulo no encontrado"
    echo "   SOLUCIÓN: Verificar dependencias y rutas en Dockerfile"
elif gcloud run services logs read $SERVICE_NAME --region $REGION --limit 50 2>/dev/null | grep -q "ENOENT"; then
    echo "❌ PROBLEMA: Archivo no encontrado"
    echo "   SOLUCIÓN: Verificar rutas de archivos en dist/"
elif gcloud run services logs read $SERVICE_NAME --region $REGION --limit 50 2>/dev/null | grep -q "Missing.*variable"; then
    echo "❌ PROBLEMA: Variables de entorno faltantes"
    echo "   SOLUCIÓN: Configurar variables con gcloud run services update"
elif gcloud run services logs read $SERVICE_NAME --region $REGION --limit 50 2>/dev/null | grep -q "listen.*8080"; then
    echo "✅ El servidor intenta iniciar en puerto 8080"
    echo "❌ PROBLEMA: Timeout durante inicialización"
    echo "   SOLUCIÓN: Diferir inicialización pesada o aumentar timeout"
else
    echo "❓ No se detectaron errores específicos"
    echo "   ACCIÓN: Revisar logs manualmente"
fi

echo ""
echo "8️⃣ COMANDOS ÚTILES:"
echo "------------------"
echo "# Ver todos los logs:"
echo "gcloud run services logs tail $SERVICE_NAME --region $REGION"
echo ""
echo "# Desplegar con más recursos:"
echo "gcloud run deploy $SERVICE_NAME --region $REGION --memory 2Gi --cpu 2 --timeout 300 --min-instances 1"
echo ""
echo "# Actualizar variables de entorno:"
echo "gcloud run services update $SERVICE_NAME --region $REGION --set-env-vars=\"KEY=value\""
echo ""
echo "✨ Script completado" 