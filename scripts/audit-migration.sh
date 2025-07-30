#!/bin/bash
echo "🔍 Auditoría de Migración..."

# Contar globales restantes en el archivo monolítico
GLOBALS_REMAINING=$(grep -cE "^(const|let)\s" src/app-unified.ts 2>/dev/null || echo 0)
echo "Globals restantes en app-unified.ts: $GLOBALS_REMAINING"

# Verificar si los archivos críticos existen
CRITICAL_FILES=(
  "src/shared/validation.ts"
  "src/core/utils/retry-utils.ts"
  "src/core/api/webhook-validator.ts"
)
for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ Archivo crítico encontrado: $file"
  else
    echo "❌ Archivo crítico FALTANTE: $file"
  fi
done

# Contar referencias a código obsoleto en todo el proyecto
OBSOLETES=$(grep -r "guestMemory\|userMessageBuffers\|manualTimers" src/ 2>/dev/null | wc -l)
echo "Referencias a código obsoleto: $OBSOLETES (objetivo: 0)"

echo "✅ Auditoría completada."