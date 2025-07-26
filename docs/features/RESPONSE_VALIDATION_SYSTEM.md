# Sistema de Validación de Respuestas Post-Generación

## Descripción General

El sistema de validación post-generación detecta y corrige automáticamente errores en las respuestas de OpenAI, específicamente discrepancias entre los datos originales de BEDS24 y la respuesta final generada por el modelo de IA.

## Problema Resuelto

**Antes**: OpenAI podía alterar datos críticos al generar respuestas naturales:
- Cambiar `Apartamento 1722-A` por `Apartaestudio 1722-B`
- Modificar precios de `$380,000` a `$420,000`
- Agregar descripciones no verificadas ("piso 17", "vista al mar")

**Después**: El sistema detecta y corrige automáticamente estos errores antes de enviar la respuesta al usuario.

## Componentes del Sistema

### 1. Validador de Respuestas (`src/utils/response-validator.ts`)

**Funcionalidad**:
- Extrae apartamentos y precios usando expresiones regulares simples
- Compara datos originales de BEDS24 vs respuesta de OpenAI
- Clasifica errores como simples (corrección automática) o complejos (retry)

**Patrones de detección**:
```javascript
// Apartamentos: "Apartamento 1722-A", "Apartaestudio 2010-B"
/(?:Apartamento|Apartaestudio|Apto\.?)\s+(\d{3,4}-[A-Z])/gi

// Precios: "$380,000", "$1,500,000 COP"
/\$[\d,]+(?:,000)?(?:\s*COP)?/gi
```

### 2. Sistema de Retry con Feedback Interno

**Tipos de respuesta**:
- **Errores simples** (solo nombres): Corrección automática sin retry
- **Errores complejos** (precios): Retry con feedback interno a OpenAI

**Proceso de retry**:
1. Detecta error complejo (precio incorrecto)
2. Agrega mensaje correctivo al thread de OpenAI
3. Re-ejecuta run con instrucciones adicionales
4. Valida nueva respuesta
5. Fallback a corrección manual si retry falla

### 3. Prevención de Loops

**Mecanismo**:
- Máximo 1 retry por usuario cada 5 minutos
- Estructura `userRetryState` con timestamp y contador
- Logs detallados de intentos y resultados

## Implementación Técnica

### Integración en el Flujo Principal

**Ubicación**: `src/app-unified.ts` líneas ~2834-2957

**Flujo**:
```typescript
// 1. Obtener respuesta de OpenAI después de function calling
const responseText = content.text.value;

// 2. Validar respuesta contra datos originales
const validation = validateAndCorrectResponse(responseText, originalOutputs);

// 3. Decidir estrategia según tipo de error
if (validation.needsRetry) {
    // Retry con feedback interno
} else if (validation.hadErrors) {
    // Corrección automática
}

// 4. Enviar respuesta corregida
return finalResponse;
```

### Categorías de Logs

**Validación básica**:
- `RESPONSE_VALIDATION`: Correcciones simples aplicadas
- `RESPONSE_RETRY_ATTEMPT`: Inicio de retry por errores complejos

**Proceso de retry**:
- `RESPONSE_RETRY_SUCCESS`: Retry completado con mejora
- `RESPONSE_RETRY_FAILED`: Retry falló, usando corrección manual
- `RESPONSE_RETRY_SKIPPED`: Retry omitido para evitar loops

## Ejemplos de Funcionamiento

### Caso 1: Error Simple - Solo Nombre de Apartamento

**Input original BEDS24**:
```
🏠 Apartamento 1722-A - $380,000 total
```

**Respuesta incorrecta OpenAI**:
```
Tenemos disponible el Apartamento 1722-B por $380,000 total
```

**Resultado**:
- ✅ Detecta: `1722-B` ≠ `1722-A`
- ✅ Corrige automáticamente: `1722-B` → `1722-A`
- ✅ No retry: Error simple
- ✅ Log: `RESPONSE_VALIDATION`

### Caso 2: Error Complejo - Precio Incorrecto

**Input original BEDS24**:
```
🏠 Apartamento 1722-A - $380,000 total
```

**Respuesta incorrecta OpenAI**:
```
Tenemos disponible el Apartamento 1722-A por $420,000 total
```

**Resultado**:
- ✅ Detecta: `$420,000` ≠ `$380,000`
- ✅ Inicia retry con feedback interno
- ✅ Mensaje correctivo a OpenAI con datos originales
- ✅ Nueva respuesta corregida o fallback manual
- ✅ Log: `RESPONSE_RETRY_ATTEMPT` → `RESPONSE_RETRY_SUCCESS`

### Caso 3: Múltiples Apartamentos

**Input original BEDS24**:
```
🏠 Apartamento 1722-A - $380,000
🏠 Apartamento 1850-C - $450,000  
🏠 Apartaestudio 2010-B - $320,000
```

**Respuesta incorrecta OpenAI**:
```
Opciones: Apartamento 1722-B ($380,000), Apartamento 1850-D ($450,000), Apartaestudio 2010-A ($320,000)
```

**Resultado**:
- ✅ Detecta y corrige: `1722-B` → `1722-A`
- ✅ Detecta y corrige: `1850-D` → `1850-C`
- ✅ Detecta y corrige: `2010-A` → `2010-B`
- ✅ Procesamiento individual de cada apartamento

## Configuración y Monitoreo

### Variables de Control

```typescript
// Timeout entre retries por usuario
const RETRY_TIMEOUT = 300000; // 5 minutos

// Límite de intentos de polling para retry
const maxRetryAttempts = 20;

// Intervalo de polling
const pollingInterval = 1000; // 1 segundo
```

### Dashboard Web

**URL**: `https://bot-wsp-whapi-ia-10-production.up.railway.app/dashboard`

**Métricas visibles**:
- Logs de validación en tiempo real
- Correcciones automáticas aplicadas
- Intentos de retry y resultados
- Errores detectados por tipo

### Logs de Producción

**Filtros recomendados**:
```bash
# Ver solo validaciones
railway logs --deployment | grep "RESPONSE_VALIDATION\|RESPONSE_RETRY"

# Ver correcciones de apartamentos
railway logs --deployment | grep "apartment_name"

# Ver errores de precios
railway logs --deployment | grep "price.*no encontrado"
```

## Rendimiento y Overhead

### Impacto en Latencia

**Validación básica**: ~5ms adicionales
**Retry con feedback**: ~2-5 segundos adicionales
**Sin errores**: Impacto mínimo (~1ms)

### Casos de Uso Recomendados

✅ **Usar para**:
- Consultas de disponibilidad con function calling
- Respuestas que incluyen datos específicos de BEDS24
- Cualquier respuesta con números de apartamentos o precios

❌ **No usar para**:
- Conversaciones generales sin datos específicos
- Respuestas que no provienen de function calling
- Mensajes de saludo o despedida

## Extensibilidad Futura

### Validaciones Adicionales Planificadas

1. **Fechas**: Validar rangos de fechas (26/07/2025 - 28/07/2025)
2. **Descripciones**: Detectar alucinaciones ("piso 17", "vista al mar")
3. **Enlaces**: Verificar URLs de fotos y WhatsApp
4. **Servicios**: Validar menciones de servicios no disponibles

### Configuración Dinámica

```typescript
// Estructura para configuración futura
interface ValidationConfig {
  validateApartments: boolean;
  validatePrices: boolean;
  validateDates: boolean;
  validateDescriptions: boolean;
  retryEnabled: boolean;
  retryTimeout: number;
}
```

## Troubleshooting

### Problemas Comunes

**1. Retry loops infinitos**:
- Verificar `userRetryState` en logs
- Confirmar timeout de 5 minutos
- Revisar `RESPONSE_RETRY_SKIPPED`

**2. Correcciones no aplicadas**:
- Verificar patrones regex en validador
- Confirmar formato de datos BEDS24
- Revisar logs `RESPONSE_VALIDATION`

**3. Latencia alta**:
- Monitorear `RESPONSE_RETRY_ATTEMPT`
- Verificar polling timeout (20 intentos max)
- Considerar ajustar `maxRetryAttempts`

### Logs de Debug

```bash
# Habilitar logs detallados (desarrollo)
export ENABLE_DETAILED_LOGS=true

# Ver validación paso a paso
grep "validateAndCorrectResponse\|originalOutputs" logs/
```

## Mantenimiento

### Actualizaciones de Patrones

**Para nuevos formatos de apartamentos**:
```typescript
// Modificar en src/utils/response-validator.ts
const apartmentRegex = /(?:Apartamento|Apartaestudio|Apto\.?|Suite)\s+(\d{3,4}-[A-Z])/gi;
```

**Para nuevos formatos de precios**:
```typescript
// Agregar soporte para dólares
const priceRegex = /[\$][\d,]+(?:,000)?(?:\s*(?:COP|USD))?/gi;
```

### Monitoreo de Efectividad

**Métricas clave**:
- Ratio de correcciones automáticas vs retry
- Tiempo promedio de retry
- Tasa de éxito de retry (respuesta mejorada)
- Frecuencia de errores por tipo

**Query ejemplo**:
```sql
-- Para análisis futuro con base de datos
SELECT 
  validation_type,
  COUNT(*) as occurrences,
  AVG(retry_duration) as avg_retry_time
FROM validation_logs 
WHERE date >= NOW() - INTERVAL 7 DAY
GROUP BY validation_type;
```