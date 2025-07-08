# 🧪 Test Beds24 - Documentación de Endpoints de Disponibilidad

## 📋 Información General

Este documento describe los endpoints de disponibilidad de Beds24 y qué datos podemos obtener de cada uno para optimizar nuestras consultas.

---

## 🔍 ENDPOINTS DE DISPONIBILIDAD DISPONIBLES

### 1. **`GET /inventory/rooms/availability`**
**Descripción:** Obtiene el estado de disponibilidad básico de las fechas

#### ✅ **Datos disponibles:**
- `roomId` - ID de la habitación
- `propertyId` - ID de la propiedad  
- `name` - Nombre de la habitación
- `availability` - Disponibilidad por fecha (true/false)

#### 📝 **Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "roomId": 12345,
      "propertyId": 1317,
      "name": "Apartamento 1317",
      "availability": {
        "2025-07-08": true,
        "2025-07-09": false,
        "2025-07-10": true
      }
    }
  ]
}
```

#### ❌ **Limitaciones:**
- Sin información de precios
- Sin restricciones de noches (minStay/maxStay)
- Sin información de canales de reserva
- Sin número de unidades disponibles

---

### 2. **`GET /inventory/rooms/calendar`** ⭐ **RECOMENDADO**
**Descripción:** Obtiene valores por día del calendario con información completa

#### ✅ **Datos disponibles:**
- `propertyId` - ID de la propiedad
- `roomId` - ID de la habitación
- `from` / `to` - Rango de fechas
- `numAvail` - Número de unidades disponibles (0 = ocupado)
- `minStay` - Mínimo de noches requerido *(con `includeMinStay: true`)*
- `maxStay` - Máximo de noches permitido *(con `includeMaxStay: true`)*
- `price1` a `price16` - Precios por configuración *(con `includePrices: true`)*
- `channels` - Información de canales de reserva *(con `includeChannels: true`)*
- `override` - Sobrescrituras especiales *(con `includeOverride: true`)*

#### 🔧 **Parámetros importantes:**
```javascript
{
  startDate: "2025-07-08",
  endDate: "2025-07-12",
  includeNumAvail: true,        // Número de unidades disponibles
  includeMinStay: true,         // Mínimo de noches
  includeMaxStay: true,         // Máximo de noches
  includePrices: true,          // Precios
  includeChannels: true,        // Info de canales
  includeOverride: true         // Sobrescrituras
}
```

#### 📝 **Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "propertyId": 1317,
      "roomId": 12345,
      "calendar": [
        {
          "from": "2025-07-08",
          "to": "2025-07-08",
          "numAvail": 0,           // 0 = Ocupado
          "minStay": 3,            // Mínimo 3 noches
          "maxStay": 14,           // Máximo 14 noches
          "price1": 200000,        // Precio base
          "override": "none",      // Sin sobrescrituras
          "channels": {
            "booking": { "maxBookings": 0 },
            "airbnb": { "maxBookings": 0 },
            "expedia": { "maxBookings": 0 },
            "vrbo": { "maxBookings": 0 }
          }
        }
      ]
    }
  ]
}
```

---

## 🎯 COMPARACIÓN Y RECOMENDACIONES

### **Endpoint `/availability` vs `/calendar`**

| Característica | `/availability` | `/calendar` |
|---------------|-----------------|-------------|
| Disponibilidad básica | ✅ | ✅ |
| Precios | ❌ | ✅ |
| Restricciones de noches | ❌ | ✅ |
| Info de canales | ❌ | ✅ |
| Número de unidades | ❌ | ✅ |
| Sobrescrituras | ❌ | ✅ |

### **🏆 RECOMENDACIÓN:**
**Usar solo `/inventory/rooms/calendar`** porque:
- Proporciona **toda la información** de `/availability` y más
- Permite mostrar **razones específicas** de no disponibilidad
- Incluye **restricciones de estadía** (minStay/maxStay)
- Muestra **información de canales** de reserva

---

## 💡 CASOS DE USO PRÁCTICOS

### **Caso 1: Consulta básica de disponibilidad**
```javascript
// Solo verificar disponibilidad y precios
{
  includeNumAvail: true,
  includePrices: true
}
```

### **Caso 2: Información completa para el usuario**
```javascript
// Mostrar razones específicas de no disponibilidad
{
  includeNumAvail: true,
  includeMinStay: true,
  includeMaxStay: true,
  includePrices: true,
  includeChannels: true
}
```

### **Caso 3: Validación de restricciones**
```javascript
// Verificar si la estadía cumple con minStay/maxStay
{
  includeMinStay: true,
  includeMaxStay: true
}
```

---

## 🚀 IMPLEMENTACIÓN ACTUAL

Nuestro sistema actualmente usa **ambos endpoints en paralelo**:
1. `/availability` - Para disponibilidad básica
2. `/calendar` - Para precios y información adicional

### **🔧 OPTIMIZACIÓN PROPUESTA:**
- Eliminar consulta a `/availability`
- Usar solo `/calendar` con todos los parámetros necesarios
- Reducir latencia y uso de créditos API

---

## 🔄 SISTEMA INTELIGENTE DE SPLITS Y ALTERNATIVAS

### **🎯 Nueva Lógica de Alternativas con Traslado**

El sistema ahora implementa una lógica inteligente para mostrar alternativas con traslado basada en la disponibilidad completa:

#### **📋 Reglas de Splits:**

| Opciones Completas | Alternativas Mostradas | Máximo Traslados | Propósito |
|-------------------|----------------------|------------------|-----------|
| **0 completas** | Hasta 3 splits | 3 traslados | Cubrir necesidad cuando no hay opciones ideales |
| **1 completa** | Hasta 2 splits | 1 traslado | Ofrecer alternativas adicionales |
| **2+ completas** | Hasta 1 split | 1 traslado | Mostrar alternativa económica |

#### **🧠 Estrategias de Optimización:**

1. **🏆 Maximizar Noches Consecutivas**: Busca la menor cantidad de traslados
2. **💰 Minimizar Precio Total**: Encuentra la combinación más económica  
3. **🎯 Diversificar Propiedades**: Ofrece opciones con diferentes apartamentos

#### **⚡ Beneficios del Sistema:**

- ✅ **Prioriza opciones sin traslados** cuando están disponibles
- ✅ **Limita traslados** para mantener comodidad del huésped
- ✅ **Ofrece alternativas económicas** cuando hay múltiples opciones
- ✅ **Maximiza ocupación** utilizando disponibilidad parcial

### **🧪 Test de Verificación de Splits:**

```bash
npx tsx tests/beds24/test-beds24.js splits 2025-07-09 2025-07-11
```

Este test específico verifica:
- ✅ Aplicación correcta de reglas según opciones completas disponibles
- ✅ Límites de traslados respetados
- ✅ Calidad de alternativas generadas
- ✅ Cobertura completa del rango de fechas solicitado

### **📤 Formato de Salida a OpenAI:**

El sistema envía mensajes contextualizados a OpenAI para que entienda la situación:

#### **🔴 Sin Disponibilidad Completa:**
```
❌ **No hay Disponibilidad Completa - Solo Parcial con Opción de Traslado**
💡 *Alternativas con cambio de apartamento (ofrecer solo como opción adicional al huésped)*

🔄 **Alternativa 1**: 1 traslado - $630.000
   🏠 1722 A: 2025-07-09 a 2025-07-10 - $420.000
   🔄 1317: 2025-07-11 - $210.000
```

#### **🟢 Con Disponibilidad Completa:**
```
🥇 **Apartamentos Disponibles (1 opciones)**
✅ **1722 B** - $850.000
   📊 $170.000/noche

🔄 **Opciones Adicionales con Traslado**
💡 *Alternativas económicas con cambio de apartamento (opcional para el huésped)*
```

#### **⚫ Sin Disponibilidad:**
```
❌ **Sin disponibilidad para 4 noches**
💡 Considera fechas alternativas
```

**Propósito del contexto:**
- ✅ OpenAI entiende cuándo NO hay disponibilidad ideal
- ✅ Sabe cómo presentar alternativas (como opción adicional)
- ✅ Maneja expectativas del huésped correctamente
- ✅ Prioriza opciones completas cuando existen

---

## 📊 INFORMACIÓN DE CANALES DISPONIBLES

El endpoint `/calendar` con `includeChannels: true` proporciona información de **25+ canales**:

- **Booking.com** (`booking`)
- **Airbnb** (`airbnb`)
- **Expedia** (`expedia`)
- **VRBO** (`vrbo`)
- **Agoda** (`agoda`)
- **Despegar** (`despegar`)
- **TripAdvisor** (`tripadvisorrentals`)
- Y muchos más...

---

## 🎯 PRÓXIMOS PASOS

1. **Implementar consulta única** a `/calendar`
2. **Agregar validación** de `minStay`/`maxStay`
3. **Mostrar información específica** de canales
4. **Optimizar respuestas** para el usuario final

---

## 📝 NOTAS IMPORTANTES

- **Créditos API:** Cada consulta consume créditos, usar `/calendar` únicamente es más eficiente
- **Restricciones:** `minStay` y `maxStay` se obtienen del calendario o de la configuración de la habitación
- **Canales:** La información de canales ayuda a entender por qué una fecha no está disponible
- **numAvail:** Valor 0 = ocupado, 1+ = disponible (número de unidades) 