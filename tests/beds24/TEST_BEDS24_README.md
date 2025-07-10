# 🧪 Test Beds24 - Documentación Simplificada

## 📋 Información General

Este documento describe el sistema simplificado de consultas a Beds24 después de la optimización de julio 2025 y las **correcciones críticas de enero 2025**.

**🎯 FILOSOFÍA ACTUAL:** Usar las fechas tal como vienen de Beds24, sin ajustes complejos de timezone.

---

## 🚨 CORRECCIONES CRÍTICAS - ENERO 2025

### **🔧 FIX CRÍTICO: Procesamiento de Rangos de Fechas**

**❌ PROBLEMA ANTERIOR:**
- El sistema solo procesaba el primer día (`from`) de cada rango de Beds24
- Para una reserva del 14-15 julio (2 noches), solo procesaba el día 14
- Resultado: **50% de la disponibilidad se perdía**

**✅ SOLUCIÓN IMPLEMENTADA:**
```javascript
// ANTES (INCORRECTO)
const dateToProcess = calItem.from;

// DESPUÉS (CORRECTO)
for (let date = new Date(fromDate); date <= toDate; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    // Procesar cada fecha en el rango
}
```

### **⚡ OPTIMIZACIÓN: Endpoint Único**

**❌ ANTES:** 2 llamadas API
- `/properties` para obtener nombres
- `/calendar` para obtener disponibilidad

**✅ AHORA:** 1 llamada API
- Solo `/calendar` con nombres reales incluidos
- **50% menos llamadas API**
- **Tiempo de respuesta: ~921ms**

### **📊 IMPACTO DE LAS CORRECCIONES:**

#### **Ejemplo: Julio 14-16, 2025 (2 noches)**

**ANTES del fix:**
```
❌ Sin disponibilidad para 2 noches
💡 Considera fechas alternativas
```

**DESPUÉS del fix:**
```
🥇 Apartamentos Disponibles (2 opciones)
✅ Aparta-Estudio 2005-B - $340.000
   📊 $170.000/noche
✅ Apartamento 1820 - $420.000
   📊 $210.000/noche
```

---

## 🔍 ENDPOINT UTILIZADO

### **`GET /inventory/rooms/calendar`** ⭐ **ÚNICO ENDPOINT**
**Descripción:** Obtiene disponibilidad y precios con información completa

#### ✅ **Datos que obtenemos:**
- `propertyId` - ID de la propiedad
- `roomId` - ID de la habitación
- `from` / `to` - Rango de fechas (**AHORA PROCESADO COMPLETAMENTE**)
- `numAvail` - Número de unidades disponibles (0 = ocupado)
- `price1` - Precio base
- **`name`** - Nombre real del apartamento (ej: "Apartamento 2005-A")

#### 🔧 **Parámetros que usamos:**
```javascript
{
  startDate: "2025-07-15",
  endDate: "2025-07-17",
  includeNumAvail: true,        // Número de unidades disponibles
  includePrices: true,          // Precios
  includeMinStay: true,         // Estancia mínima
  includeMaxStay: true,         // Estancia máxima
  includeMultiplier: true,      // Multiplicadores
  includeOverride: true,        // Overrides
  includeLinkedPrices: true,    // Precios vinculados
  includeChannels: true         // Canales
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
      "name": "Apartamento 2005-A",    // ✅ Nombre real incluido
      "calendar": [
        {
          "from": "2025-07-15",
          "to": "2025-07-15",         // ✅ Rango procesado completamente
          "numAvail": 0,              // 0 = Ocupado
          "price1": 200000,           // Precio base
        }
      ]
    }
  ]
}
```

---

## 🎯 SISTEMA SIMPLIFICADO DE DISPONIBILIDAD

### **🔧 Lógica Actual (Corregida):**

1. **Consulta directa** a Beds24 con fechas originales
2. **Procesamiento COMPLETO** de rangos de fechas (from-to)
3. **Clasificación simple** en opciones completas vs parciales
4. **Generación de splits** según reglas establecidas

### **📋 Reglas de Splits (Sin Cambios):**

| Opciones Completas | Alternativas Mostradas | Máximo Traslados |
|-------------------|----------------------|------------------|
| **0 completas** | Hasta 3 splits | 3 traslados |
| **1 completa** | Hasta 2 splits | 1 traslado |
| **2+ completas** | Hasta 1 split | 1 traslado |

### **⚡ Beneficios de las Correcciones:**

- ✅ **Disponibilidad completa** (100% vs 50% anterior)
- ✅ **Menos llamadas API** (1 vs 2 anteriores)
- ✅ **Nombres reales** de apartamentos
- ✅ **Más rápido** (~921ms de respuesta)
- ✅ **Más confiable** (procesamiento correcto de rangos)

---

## 🧪 TESTS DISPONIBLES

### **Tests Principales:**
```bash
# Test general de disponibilidad
npx tsx tests/beds24/test-beds24.js general 2025-07-15 2025-07-17

# Test de verificación de splits
npx tsx tests/beds24/test-beds24.js splits 2025-07-15 2025-07-17

# Test de health check
npx tsx tests/beds24/test-beds24.js health
```

### **Tests de Análisis:**
```bash
# Ver datos RAW de Beds24
npx tsx tests/beds24/test-beds24.js raw 2025-07-15 2025-07-17

# Ver datos completamente crudos
npx tsx tests/beds24/test-beds24.js crude 2025-07-15 2025-07-17

# Test de rendimiento
npx tsx tests/beds24/test-beds24.js performance 2025-07-15 2025-07-17
```

### **🔍 Tests de Verificación de Correcciones:**
```bash
# Test específico para rangos de fechas
npx tsx tests/beds24/test-beds24.js raw 2025-07-14 2025-07-16

# Verificar procesamiento individual
npx tsx tests/beds24/test-beds24.js general 2025-07-14 2025-07-15
npx tsx tests/beds24/test-beds24.js general 2025-07-15 2025-07-16
```

---

## 📤 FORMATO DE SALIDA A OPENAI

### **🟢 Con Disponibilidad Completa:**
```
📅 **15/07/2025 - 17/07/2025 (2 noches)**

🥇 **Apartamentos Disponibles (2 opciones)**
✅ **Aparta-Estudio 2005-B** - $340.000
   📊 $170.000/noche
✅ **Apartamento 1820** - $420.000
   📊 $210.000/noche

🔄 *Beds24 - 9/7, 23:37*
```

### **🔴 Sin Disponibilidad:**
```
📅 **15/07/2025 - 17/07/2025 (2 noches)**

❌ **Sin disponibilidad para 2 noches**
💡 Considera fechas alternativas

🔄 *Beds24 - 9/7, 23:37*
```

### **🟡 Solo Alternativas con Traslado:**
```
📅 **15/07/2025 - 17/07/2025 (2 noches)**

❌ **No hay Disponibilidad Completa - Solo Parcial con Opción de Traslado**
💡 *Alternativas con cambio de apartamento (ofrecer solo como opción adicional al huésped)*

🔄 **Alternativa 1**: 1 traslado - $630.000
   🏠 1722 A: 15/07/2025 - $420.000
   🔄 1317: 16/07/2025 - $210.000

🔄 *Beds24 - 9/7, 23:37*
```

---

## 🚫 LIMITACIONES ACEPTADAS

### **Problema de Timezone:**
- **Realidad:** Beds24 usa UTC, Colombia usa UTC-5
- **Problema:** A las 11 PM en Colombia = 4 AM UTC del día siguiente
- **Consecuencia:** Beds24 puede no devolver datos para "hoy" muy tarde
- **Solución:** **ACEPTADA** - Es una limitación de la API, no intentamos "arreglarla"

### **Enfoque Adoptado:**
- ✅ **Transparencia:** Si no hay datos, informar claramente
- ✅ **Simplicidad:** No lógica compleja que pueda fallar
- ✅ **Confiabilidad:** Usar datos tal como vienen de Beds24
- ✅ **Alternativas:** Sugerir fechas alternativas cuando no hay disponibilidad

---

## 📊 LOGS Y DEBUGGING

### **Logs Generados:**
- `BEDS24_NIGHTS_CALCULATION` - Cálculo de noches
- `BEDS24_API_CALL` - Llamadas a API exitosas
- `BEDS24_PROCESSING` - Procesamiento de datos
- `BEDS24_DATE_RANGE_PROCESSING` - **NUEVO:** Procesamiento de rangos de fechas
- `BEDS24_CLASSIFICATION` - Clasificación de opciones
- `BEDS24_SPLITS` - Generación de splits

### **Ubicación de Logs:**
```
logs/bot-session-YYYY-MM-DDTHH-MM-SS.log
```

---

## 🎯 HISTORIAL DE CORRECCIONES

### **✅ Enero 2025 - Correcciones Críticas:**
1. **Fix procesamiento de rangos de fechas** - Ahora procesa from-to completamente
2. **Optimización endpoint único** - Solo `/calendar` con nombres reales
3. **Mejora de performance** - 50% menos llamadas API
4. **Documentación actualizada** - Casos de prueba verificados

### **✅ Julio 2025 - Simplificación:**
1. **Eliminación de lógica compleja** de timezone
2. **Código más mantenible** y confiable
3. **Reglas de splits** establecidas
4. **Sistema de logs** implementado

---

## 📝 NOTAS IMPORTANTES

- **Créditos API:** Cada consulta consume créditos de Beds24
- **Zona horaria:** Sistema acepta limitación UTC de Beds24
- **Fechas:** Usar siempre formato YYYY-MM-DD
- **Logs:** Revisar logs para debugging detallado
- **⚠️ CRÍTICO:** Las correcciones de enero 2025 son **OBLIGATORIAS** para funcionamiento correcto 