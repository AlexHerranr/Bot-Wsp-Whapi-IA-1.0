# Documentación Técnica: Función check-availability

## Resumen Ejecutivo

La función `check-availability` es el núcleo del sistema de consulta de disponibilidad hotelera, integrando validaciones temporales, llamadas API a Beds24, enriquecimiento de datos con PostgreSQL y formato de respuesta optimizado para OpenAI.

## Arquitectura del Sistema

```
Cliente → OpenAI → check_availability() → [Beds24 API + PostgreSQL] → Respuesta Formateada
                         ↓
              ┌─────────────────────────┐
              │   Validaciones Previas  │
              │  - Fechas pasadas       │
              │  - Restricciones horario│
              │  - Número de adultos    │
              └─────────────────────────┘
                         ↓
              ┌─────────────────────────┐
              │    Beds24Client         │
              │  - API /offers          │
              │  - Reintentos con retry │
              │  - Filtrado disponibles │
              └─────────────────────────┘
                         ↓
              ┌─────────────────────────┐
              │  Enriquecimiento BD     │
              │  - Nombres reales       │
              │  - Cargos adicionales   │
              │  - Lookup optimizado    │
              └─────────────────────────┘
```

## Flujo de Ejecución Detallado

### 1. Validaciones de Entrada (Líneas 17-67)

#### 1.1 Validación de Fechas Pasadas
```typescript
// Obtiene fecha actual de Colombia (GMT-5)
const todayColombia = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
```
- **Propósito**: Evitar consultas API innecesarias para fechas pasadas
- **Zona Horaria**: America/Bogota (GMT-5) para consistencia local
- **Formato**: ISO 8601 (YYYY-MM-DD) para comparaciones precisas

#### 1.2 Restricción Horaria (Líneas 31-54)
```typescript
if (parseInt(colombiaHour) >= 19) { // 7:00 PM
    return `Indícale al huésped que: Desafortunadamente...`;
}
```
- **Corte**: 7:00 PM hora de Colombia
- **Razón**: Limitaciones operacionales del sistema Beds24
- **Alternativa**: Sugiere contacto telefónico directo

#### 1.3 Validación de Capacidad
```typescript
if (numAdults < 1) return `Nota interna: Número de adultos inválido`;
if (numAdults > 50) return `Nota interna: Grupo muy grande`;
```
- **Rango válido**: 1-50 adultos
- **Grupos grandes**: Derivación a coordinación telefónica

### 2. Integración con Beds24 API (Líneas 69-79)

#### 2.1 Inicialización del Cliente
```typescript
const beds24 = new Beds24Client();
const result = await beds24.searchAvailability({
    arrival: args.startDate,
    departure: args.endDate,
    numAdults: numAdults,
});
```

#### 2.2 Endpoint Utilizado
- **URL**: `/inventory/rooms/offers`
- **Método**: GET
- **Parámetros**:
  - `arrival`: Fecha de entrada (YYYY-MM-DD)
  - `departure`: Fecha de salida (YYYY-MM-DD)
  - `numAdults`: Número de adultos
  - `offerId`: 0 (valor fijo para consulta general)

### 3. Procesamiento en Beds24Client

#### 3.1 Manejo de Reintentos
```typescript
retryOptions: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffFactor: 2
}
```
- **Estrategia**: Exponential backoff
- **Reintentos**: Máximo 3 intentos
- **Delays**: 1s → 2s → 4s

#### 3.2 Filtrado de Disponibles (beds24-client.ts:279-310)
```typescript
.filter((room: any) => {
    return room.offers && room.offers.length > 0;
})
.map((room: any) => {
    const offer = room.offers[0];
    const totalPrice = offer.price || 0;
    const pricePerNight = totalNights > 0 ? Math.round(totalPrice / totalNights) : 0;
```
- **Criterio**: Solo habitaciones con ofertas activas
- **Cálculos**: Precio por noche = precio total / número de noches

#### 3.3 Enriquecimiento con Datos Locales (beds24-client.ts:349-403)
```typescript
const apartmentDetailsMap = await this.apartmentDataService.getApartmentDetails(roomIds);
```
- **Optimización**: Consulta batch con Map lookup O(1)
- **Datos agregados**: 
  - Nombre real del apartamento
  - Descripción de cargos adicionales
  - Montos de cargos adicionales
- **Fallback**: Valores por defecto si falla la BD

### 4. Formato de Respuesta (beds24-client.ts:406-456)

#### 4.1 Estructura de la Respuesta
```
Tenemos X Apto(s) Disponible(s),
entrando el DD y saliendo DD de MMMM de YYYY,
para (X noche(s)) para X persona(s).

*Nombre Apartamento*
- $X.XXX/noche × X = $X.XXX
- Cargo adicional: $X.XXX
- Total: $X.XXX

Disponibilidad Validada a las HH:MM AM/PM
```

#### 4.2 Ordenamiento
- **Criterio**: Precio total ascendente
- **Propósito**: Mostrar opciones más económicas primero

### 5. Métricas y Logging

#### 5.1 Performance Tracking (Líneas 81-102)
```typescript
const duration = Date.now() - startTime;
const apartmentCount = (result.match(/🏠/g) || []).length;
const hasFixedCharges = result.includes('$') && result.includes('Total:');

logFunctionPerformance(
    'system',
    'check_availability',
    duration,
    apiTime,  // ~70% del tiempo total
    dbTime,   // ~20% del tiempo total
    1,        // calls
    0         // errors
);
```

#### 5.2 Métricas Capturadas
- **Duración total**: Tiempo de ejecución completo
- **Tiempo API**: Estimado 70% del total
- **Tiempo BD**: Estimado 20% del total
- **Conteo apartamentos**: Extraído del texto de respuesta
- **Validación formato**: Verificación de estructura de precios

#### 5.3 Log Técnico Compacto (Línea 102)
```typescript
logInfo('HOTEL_AVAILABILITY', `${args.startDate}_${args.endDate}_${numAdults}adl | ${apartmentCount}apts | ${duration}ms | BD:${hasFixedCharges?'OK':'MISS'} | Ages:${hasAgeInfo?'OK':'MISS'} | ${result.length}chars`);
```

**Formato**: `fecha_inicio_fecha_fin_XadlXapts | XmsXaptsXms | BD:STATUS | Ages:STATUS | Xchars`

### 6. Manejo de Errores

#### 6.1 Errores de Red (Líneas 125-127)
```typescript
if (error.message && (error.message.includes('network') || 
    error.message.includes('timeout') || 
    error.message.includes('ECONNRESET'))) {
    return 'Error de conexión al verificar disponibilidad...';
}
```

#### 6.2 Logging de Errores
```typescript
logFunctionPerformance(
    'system',
    'check_availability',
    duration,
    0, // apiTime - no completado
    0, // dbTime - no completado
    1, // calls
    1  // errors
);
```

## Optimizaciones Implementadas

### 1. Consulta Batch de Apartamentos
- **Problema**: N+1 queries a PostgreSQL
- **Solución**: Map lookup con getApartmentDetails(roomIds[])
- **Mejora**: O(N) → O(1) per lookup

### 2. Formato de Fechas Optimizado
- **Entrada**: YYYY-MM-DD
- **Salida**: DD/MM/YYYY para legibilidad humana
- **Procesamiento**: Split + reordenamiento simple

### 3. Caching de Cliente
- **Patrón**: Singleton por instancia de función
- **Beneficio**: Reutilización de conexiones HTTP

## Consideraciones de Seguridad

### 1. Validación de Entrada
- Sanitización de fechas con formato ISO
- Límites numéricos en número de adultos
- Validación de zona horaria

### 2. Manejo de Tokens
- Tokens en variables de entorno
- Headers seguros para autenticación
- Fallback graceful si faltan credenciales

## Dependencias Críticas

### 1. Servicios Externos
- **Beds24 API**: /inventory/rooms/offers endpoint
- **PostgreSQL**: Tabla de apartamentos para enriquecimiento

### 2. Módulos Internos
- `beds24-client.ts`: Cliente API principal
- `apartment-data.service.ts`: Servicio de datos locales
- `logging/integrations.ts`: Sistema de métricas
- `retry-utils.ts`: Manejo de reintentos

## Casos de Uso Principales

### 1. Consulta Estándar
- Fechas futuras válidas
- 1-6 adultos
- Horario operacional (antes 7PM)

### 2. Casos Límite
- Consulta para "hoy" después de 7PM
- Fechas pasadas (error de usuario)
- Grupos grandes (>50 personas)
- Sin disponibilidad para fechas solicitadas

### 3. Escenarios de Error
- API Beds24 no disponible
- Base de datos PostgreSQL no disponible
- Token de autenticación inválido
- Timeout de red

## Métricas de Performance Esperadas

### 1. Tiempos Objetivo
- **Total**: < 3000ms
- **API Beds24**: < 2000ms
- **PostgreSQL**: < 500ms
- **Procesamiento**: < 500ms

### 2. Disponibilidad
- **SLA**: 99.5% uptime
- **Reintentos**: Máximo 3 por llamada
- **Timeout**: 15 segundos por intento

## Schema de OpenAI (schema.json)

### Configuración de Function Calling

El schema define la interfaz entre OpenAI y la función `check_availability`, garantizando validaciones automáticas y documentación clara para el modelo.

#### Estructura del Schema

```json
{
  "name": "check_availability",
  "description": "Consulta disponibilidad y tarifas completas...",
  "strict": true,
  "parameters": {
    "type": "object",
    "properties": { ... },
    "required": [...],
    "additionalProperties": false
  }
}
```

#### Análisis Detallado de Parámetros

##### 1. startDate (Fecha de Entrada)
```json
{
  "type": "string",
  "description": "Fecha de entrada (check-in) en formato YYYY-MM-DD...",
  "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
}
```
- **Validación**: Regex estricto para formato ISO 8601
- **Propósito**: Evitar errores de formato antes de llegar a la función
- **Nota**: La validación de fechas pasadas se hace en la función, no en el schema

##### 2. endDate (Fecha de Salida) 
```json
{
  "type": "string",
  "description": "Fecha de salida (check-out) en formato YYYY-MM-DD...",
  "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
}
```
- **Constraint Lógico**: Debe ser posterior a startDate (validado en función)
- **Formato**: Mismo patrón regex que startDate para consistencia

##### 3. numAdults (Número de Adultos)
```json
{
  "type": "integer",
  "description": "Número total de huéspedes adultos...",
  "minimum": 1,
  "maximum": 50
}
```
- **Rango válido**: 1-50 adultos
- **Regla de negocio**: Niños >5 años cuentan como adultos
- **Validación automática**: OpenAI rechaza valores fuera del rango

#### Configuraciones Importantes

##### 1. Strict Mode
```json
"strict": true
```
- **Beneficio**: Validación estricta de tipos y formatos
- **Comportamiento**: OpenAI rechaza llamadas que no cumplan exactamente el schema
- **Seguridad**: Previene inyección de parámetros no esperados

##### 2. Required Fields
```json
"required": ["startDate", "endDate", "numAdults"]
```
- **Todos obligatorios**: La función no puede ejecutarse sin estos 3 parámetros
- **UX**: Fuerza al modelo a solicitar información faltante al usuario

##### 3. Additional Properties
```json
"additionalProperties": false
```
- **Restricción**: No permite parámetros extra no definidos en el schema
- **Seguridad**: Previene pasar datos inesperados a la función

#### Descripción para el Modelo

La descripción del schema actúa como documentación interna para OpenAI:

```
"Consulta disponibilidad y tarifas completas (incluye precios por noche, extras, totales). 
Usar SIEMPRE que tengas fechas específicas y número de personas confirmados por el cliente."
```

**Elementos clave:**
- **"SIEMPRE que tengas fechas específicas"**: Previene llamadas prematuras
- **"confirmados por el cliente"**: Asegura que los datos sean válidos
- **"tarifas completas"**: Comunica qué tipo de información se obtendrá

#### Flujo de Validación Completo

```
Usuario → OpenAI → Schema Validation → Function Execution → Response
          ↓
    ┌─────────────────┐
    │ Schema.json     │
    │ - Tipos         │
    │ - Formatos      │
    │ - Rangos        │
    │ - Required      │
    └─────────────────┘
          ↓ (Si pasa)
    ┌─────────────────┐
    │ check-availability.ts │
    │ - Fechas pasadas│
    │ - Horario 7PM   │
    │ - Lógica negocio│
    └─────────────────┘
```

#### Casos de Uso del Schema

##### 1. Prevención de Errores Comunes
- **Formato incorrecto**: "2024/12/25" → Rechazado por pattern
- **Tipo incorrecto**: "cinco adultos" → Rechazado por type: integer
- **Fuera de rango**: 100 adultos → Rechazado por maximum: 50

##### 2. Optimización de Performance
- **Pre-validación**: Errores detectados antes de ejecutar función
- **Menor latencia**: No hay llamadas API innecesarias
- **Menos logging**: Reduce ruido en logs de errores

##### 3. Mejora de UX
- **Mensajes claros**: OpenAI puede explicar qué parámetro falta
- **Guía al usuario**: Descripciones ayudan al modelo a solicitar info correcta
- **Consistencia**: Formato uniforme de fechas y números

#### Mantenimiento del Schema

##### Sincronización con Función
- **Rangos numéricos**: maximum: 50 debe coincidir con validación en función
- **Patrones**: Regex debe ser compatible con parsing en TypeScript
- **Descripciones**: Mantener actualizadas con cambios de lógica de negocio

##### Versionado
- **Cambios breaking**: Modificar pattern o required fields requiere testing
- **Cambios seguros**: Actualizar description o agregar validaciones opcionales
- **Rollback**: Schema debe ser compatible con versiones anteriores de la función

---

*Documentación generada para la versión actual del sistema check-availability*
*Última actualización: Análisis completo incluyendo schema.json de OpenAI Function Calling*