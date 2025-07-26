# Configuración del Sistema de Validación de Respuestas

## Parámetros de Configuración

### Variables de Timeout y Retry

```typescript
// En src/app-unified.ts
const RETRY_TIMEOUT = 300000; // 5 minutos entre retries por usuario
const maxRetryAttempts = 20;   // Máximo 20 intentos de polling
const pollingInterval = 1000;  // 1 segundo entre polls
```

### Patrones de Validación

```typescript
// En src/utils/response-validator.ts

// Apartamentos: detecta "Apartamento 1722-A", "Apartaestudio 2010-B"
const apartmentRegex = /(?:Apartamento|Apartaestudio|Apto\.?)\s+(\d{3,4}-[A-Z])/gi;

// Precios: detecta "$380,000", "$1,500,000 COP"
const priceRegex = /\$[\d,]+(?:,000)?(?:\s*COP)?/gi;
```

### Criterios de Retry

```typescript
// Errores que requieren retry (complejos)
hasComplexErrors = true cuando:
- Precios no coinciden con datos originales
- Múltiples discrepancias detectadas

// Errores con corrección automática (simples)
- Solo nombres de apartamentos incorrectos
```

## Personalización de Patrones

### Agregar Nuevos Tipos de Apartamentos

```typescript
// Modificar apartmentRegex para incluir "Suite", "Loft", etc.
const apartmentRegex = /(?:Apartamento|Apartaestudio|Apto\.?|Suite|Loft)\s+(\d{3,4}-[A-Z])/gi;
```

### Soporte para Múltiples Monedas

```typescript
// Modificar priceRegex para USD, EUR
const priceRegex = /[\$€][\d,]+(?:,000)?(?:\s*(?:COP|USD|EUR))?/gi;
```

### Personalizar Timeouts por Entorno

```typescript
// Configuración condicional por entorno
const RETRY_TIMEOUT = process.env.NODE_ENV === 'production' 
  ? 300000  // 5 min en producción
  : 60000;  // 1 min en desarrollo
```

## Variables de Entorno

### Activar/Desactivar Validación

```env
# .env
ENABLE_RESPONSE_VALIDATION=true
ENABLE_RETRY_SYSTEM=true
VALIDATION_LOG_LEVEL=detailed
```

### Configuración Avanzada

```env
# Timeouts personalizados
RETRY_TIMEOUT_MS=300000
MAX_RETRY_ATTEMPTS=20
POLLING_INTERVAL_MS=1000

# Tipos de validación
VALIDATE_APARTMENTS=true
VALIDATE_PRICES=true
VALIDATE_DATES=false
VALIDATE_DESCRIPTIONS=false
```

## Monitoreo y Logs

### Categorías de Logs

```typescript
// Logs principales a monitorear
'RESPONSE_VALIDATION'     // Correcciones simples
'RESPONSE_RETRY_ATTEMPT'  // Inicio de retry
'RESPONSE_RETRY_SUCCESS'  // Retry exitoso
'RESPONSE_RETRY_FAILED'   // Retry falló
'RESPONSE_RETRY_SKIPPED'  // Retry omitido por timeout
```

### Filtros de Monitoreo

```bash
# Railway logs - ver solo validaciones
railway logs --deployment | grep "RESPONSE_"

# Logs locales - errores de validación
tail -f logs/bot-session-*.log | grep "RESPONSE_VALIDATION\|apartment_name\|price"
```

## Ajustes de Rendimiento

### Optimización para Alto Volumen

```typescript
// Reducir overhead en conversaciones sin function calling
if (!originalToolOutputs.length) {
  return { correctedResponse: openaiResponse, discrepancies: [], hadErrors: false, needsRetry: false };
}

// Cache de patrones compilados (futuro)
const compiledPatterns = {
  apartment: new RegExp(apartmentRegex),
  price: new RegExp(priceRegex)
};
```

### Límites de Procesamiento

```typescript
// Evitar validación en mensajes muy largos
const MAX_RESPONSE_LENGTH = 2000;
if (openaiResponse.length > MAX_RESPONSE_LENGTH) {
  // Skip validation para respuestas extremadamente largas
}

// Límite de discrepancias a procesar
const MAX_DISCREPANCIES = 10;
```

## Configuración del Dashboard

### Métricas Personalizadas

```typescript
// Agregar métricas específicas al dashboard
botDashboard.addValidationMetric({
  type: 'apartment_correction',
  count: corrections.length,
  timestamp: Date.now()
});
```

### Alertas Automáticas

```typescript
// Configurar alertas por alta frecuencia de errores
if (validation.discrepancies.length > 3) {
  botDashboard.triggerAlert('high_validation_errors', {
    userId: shortUserId,
    errorCount: validation.discrepancies.length
  });
}
```

## Testing y Debug

### Modo Debug

```typescript
// Habilitar logs detallados para debugging
const DEBUG_VALIDATION = process.env.DEBUG_VALIDATION === 'true';

if (DEBUG_VALIDATION) {
  console.log('Original outputs:', originalOutputs);
  console.log('OpenAI response:', openaiResponse);
  console.log('Validation result:', validation);
}
```

### Tests de Configuración

```javascript
// test-validation-config.js
const testConfigs = [
  {
    name: 'Multiple apartments',
    original: ['Apartamento 1722-A - $380k', 'Suite 2010-B - $450k'],
    response: 'Apartamento 1722-C y Suite 2010-A disponibles',
    expectedCorrections: 2
  }
];
```

## Configuración por Casos de Uso

### Hoteles vs Apartamentos

```typescript
// Patrones específicos por tipo de propiedad
const hotelPattern = /(?:Habitación|Room)\s+(\d{3,4})/gi;
const apartmentPattern = /(?:Apartamento|Apartaestudio)\s+(\d{3,4}-[A-Z])/gi;

// Selección dinámica basada en contexto
const usePattern = context.propertyType === 'hotel' ? hotelPattern : apartmentPattern;
```

### Temporadas y Precios Dinámicos

```typescript
// Validación de precios por temporada
const isHighSeason = isDateInRange(responseDate, HIGH_SEASON_DATES);
const expectedPriceRange = isHighSeason ? [300000, 800000] : [200000, 600000];

// Validar que precios estén en rango esperado
if (price < expectedPriceRange[0] || price > expectedPriceRange[1]) {
  addDiscrepancy('price_out_of_range', price, expectedPriceRange);
}
```

## Troubleshooting de Configuración

### Problemas Comunes

1. **Patrones no detectan apartamentos**:
   ```typescript
   // Verificar formato exacto en logs
   console.log('Testing regex:', apartmentRegex.test('Apartamento 1722-A'));
   ```

2. **Retry loops infinitos**:
   ```typescript
   // Verificar limpieza de userRetryState
   setInterval(() => {
     const now = Date.now();
     for (const [userId, state] of userRetryState.entries()) {
       if (now - state.lastRetryTime > RETRY_TIMEOUT) {
         userRetryState.delete(userId);
       }
     }
   }, 60000); // Limpiar cada minuto
   ```

3. **Validación muy estricta**:
   ```typescript
   // Agregar tolerancia para variaciones menores
   const priceMatches = (original, response) => {
     const diff = Math.abs(original - response);
     return diff < 10000; // Tolerancia de $10k
   };
   ```

### Logs de Diagnóstico

```bash
# Verificar configuración actual
grep -r "RETRY_TIMEOUT\|apartmentRegex" src/

# Ver estadísticas de validación
grep "RESPONSE_VALIDATION" logs/ | wc -l
grep "RESPONSE_RETRY" logs/ | wc -l
```

## Configuración de Producción Recomendada

```typescript
// Configuración optimizada para producción
const PRODUCTION_CONFIG = {
  RETRY_TIMEOUT: 300000,        // 5 minutos
  MAX_RETRY_ATTEMPTS: 15,       // Reducido para mejor rendimiento
  POLLING_INTERVAL: 1500,       // 1.5s para reducir carga
  VALIDATE_APARTMENTS: true,
  VALIDATE_PRICES: true,
  VALIDATE_DATES: false,        // Deshabilitado por ahora
  VALIDATE_DESCRIPTIONS: false, // Deshabilitado por ahora
  LOG_LEVEL: 'production'       // Solo logs críticos
};
```