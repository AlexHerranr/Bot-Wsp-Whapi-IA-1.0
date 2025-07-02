# 🏨 Integración Beds24 - Disponibilidad en Tiempo Real

## 📋 Descripción

Esta integración permite consultar disponibilidad de habitaciones en **tiempo real** directamente desde Beds24, sin necesidad de webhooks intermedios como n8n. Los datos son siempre actuales ya que se consultan en cada petición.

## 🚀 Configuración

### 1. Obtener Token de Beds24

1. Inicia sesión en tu cuenta de Beds24
2. Ve a **Settings > Apps & Integrations > API**
3. Crea un **Long life token** con los siguientes permisos:
   - `read:inventory` (para disponibilidad)
   - `read:properties` (para información de propiedades)
   - `read:bookings` (opcional, para futuras funciones)

### 2. Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```env
# Token de larga duración de Beds24
BEDS24_TOKEN=tu_token_aqui

# URL de la API (opcional, por defecto usa v2)
BEDS24_API_URL=https://beds24.com/api/v2

# Timeout en milisegundos (opcional, por defecto 15000)
BEDS24_TIMEOUT=15000
```

## 🔧 Uso desde OpenAI

La función `check_availability` está disponible para el asistente de OpenAI:

### Función: check_availability

**Descripción:** Consulta disponibilidad en tiempo real de propiedades en Beds24

**Parámetros:**
- `startDate` (requerido): Fecha de inicio en formato YYYY-MM-DD
- `endDate` (requerido): Fecha de fin en formato YYYY-MM-DD  
- `propertyId` (opcional): ID específico de la propiedad
- `roomId` (opcional): ID específico de la habitación

### Ejemplos de Uso

```javascript
// Consultar todas las propiedades para fechas específicas
{
  "startDate": "2024-03-15",
  "endDate": "2024-03-18"
}

// Consultar una propiedad específica
{
  "startDate": "2024-03-15",
  "endDate": "2024-03-18",
  "propertyId": 12345
}

// Consultar una habitación específica
{
  "startDate": "2024-03-15",
  "endDate": "2024-03-18",
  "roomId": 67890
}
```

## 📊 Formato de Respuesta

La función devuelve información detallada sobre disponibilidad:

```
📅 **Disponibilidad para 15/03/2024 - 18/03/2024**

✅ **HABITACIONES DISPONIBLES (2)**
🏠 **Suite Premium** - Propiedad Villa Mar
   📊 3 de 3 días disponibles
   📅 Fechas: 2024-03-15, 2024-03-16, 2024-03-17
   💰 Desde $120

🏠 **Habitación Standard** - Propiedad Villa Mar
   📊 2 de 3 días disponibles
   📅 Fechas: 2024-03-15, 2024-03-17

❌ **NO DISPONIBLES (1)**
🏠 Habitación Deluxe - Propiedad Villa Mar

🔄 *Información actualizada en tiempo real desde Beds24*
```

## 🏗️ Arquitectura

```
Usuario WhatsApp → OpenAI → check_availability → Beds24 API → Respuesta tiempo real
```

### Ventajas vs n8n:

✅ **Menor latencia** - Sin saltos intermedios
✅ **Datos más actuales** - Consulta directa a Beds24
✅ **Mejor escalabilidad** - Sin límites de n8n
✅ **Menos dependencias** - Una integración menos
✅ **Control total** - Manejo directo de errores y timeouts

## 🔍 Debugging

### Logs Disponibles

El sistema genera logs detallados en diferentes categorías:

- `BEDS24_SERVICE`: Inicialización del servicio
- `BEDS24_API`: Requests y responses de la API
- `BEDS24_AVAILABILITY`: Consultas de disponibilidad
- `AVAILABILITY_HANDLER`: Procesamiento de funciones OpenAI

### Verificar Estado de la API

```typescript
import { checkBeds24Health } from './src/handlers/availability-handler';

const status = await checkBeds24Health();
console.log(status); // ✅ Conexión con Beds24 funcionando correctamente
```

### Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `Token is missing` | BEDS24_TOKEN no configurado | Agregar token al .env |
| `Unauthorized` | Token inválido o expirado | Regenerar token en Beds24 |
| `Timeout` | API lenta o no disponible | Verificar BEDS24_TIMEOUT |

## 📁 Estructura de Archivos

```
src/
├── config/
│   └── beds24.config.ts          # Configuración y validación
├── services/
│   └── beds24/
│       ├── beds24.types.ts       # Tipos TypeScript
│       └── beds24.service.ts     # Servicio principal
├── handlers/
│   ├── availability-handler.ts   # Handler para OpenAI
│   └── function-handler.ts       # Integración con sistema existente
```

## 🔧 Mantenimiento

### Renovación de Token

Los **long life tokens** no expiran mientras se usen regularmente, pero si no se usan por más de 90 días se desactivan automáticamente.

### Monitoreo

- Los logs técnicos se guardan en `logs/bot-YYYY-MM-DD.log`
- Los errores de API se registran con detalles completos
- Se puede verificar el estado con `checkBeds24Health()`

## 🚦 Estados de la Integración

| Estado | Descripción |
|--------|-------------|
| ✅ Funcionando | API responde correctamente |
| ⚠️ Problemas | API lenta o errores intermitentes |
| ❌ Error | Token inválido o API no disponible |

## 📈 Próximas Mejoras

- [ ] Soporte para precios dinámicos
- [ ] Cache inteligente por períodos específicos
- [ ] Webhooks de Beds24 para actualizaciones automáticas
- [ ] Integración con calendarios de reservas 