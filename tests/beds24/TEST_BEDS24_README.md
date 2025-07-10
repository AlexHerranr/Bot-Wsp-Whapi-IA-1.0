# 🧪 Test Beds24 - Documentación Simplificada

## 📋 Información General

Este documento describe el sistema simplificado de consultas a Beds24 después de la optimización de julio 2025.

**🎯 FILOSOFÍA ACTUAL:** Usar las fechas tal como vienen de Beds24, sin ajustes complejos de timezone.

---

## 🔍 ENDPOINT UTILIZADO

### **`GET /inventory/rooms/calendar`** ⭐ **ÚNICO ENDPOINT**
**Descripción:** Obtiene disponibilidad y precios con información completa

#### ✅ **Datos que obtenemos:**
- `propertyId` - ID de la propiedad
- `roomId` - ID de la habitación
- `from` / `to` - Rango de fechas
- `numAvail` - Número de unidades disponibles (0 = ocupado)
- `price1` - Precio base
- Información adicional según necesidad

#### 🔧 **Parámetros que usamos:**
```javascript
{
  startDate: "2025-07-15",
  endDate: "2025-07-17",
  includeNumAvail: true,        // Número de unidades disponibles
  includePrices: true,          // Precios
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
          "from": "2025-07-15",
          "to": "2025-07-15",
          "numAvail": 0,           // 0 = Ocupado
          "price1": 200000,        // Precio base
        }
      ]
    }
  ]
}
```

---

## 🎯 SISTEMA SIMPLIFICADO DE DISPONIBILIDAD

### **🔧 Lógica Actual (Simplificada):**

1. **Consulta directa** a Beds24 con fechas originales
2. **Procesamiento directo** de los datos sin mapeo complejo
3. **Clasificación simple** en opciones completas vs parciales
4. **Generación de splits** según reglas establecidas

### **📋 Reglas de Splits (Sin Cambios):**

| Opciones Completas | Alternativas Mostradas | Máximo Traslados |
|-------------------|----------------------|------------------|
| **0 completas** | Hasta 3 splits | 3 traslados |
| **1 completa** | Hasta 2 splits | 1 traslado |
| **2+ completas** | Hasta 1 split | 1 traslado |

### **⚡ Beneficios de la Simplificación:**

- ✅ **Código más simple** y mantenible
- ✅ **Menos puntos de falla** (sin lógica compleja de timezone)
- ✅ **Más confiable** (usa datos tal como vienen de Beds24)
- ✅ **Más rápido** (menos procesamiento)

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

---

## 📤 FORMATO DE SALIDA A OPENAI

### **🟢 Con Disponibilidad Completa:**
```
📅 **15/07/2025 - 17/07/2025 (2 noches)**

🥇 **Apartamentos Disponibles (1 opciones)**
✅ **1722 B** - $850.000
   📊 $425.000/noche

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
- `BEDS24_CLASSIFICATION` - Clasificación de opciones
- `BEDS24_SPLITS` - Generación de splits

### **Ubicación de Logs:**
```
logs/bot-session-YYYY-MM-DDTHH-MM-SS.log
```

---

## 🎯 PRÓXIMOS PASOS

1. **✅ Simplificación completada** (Julio 2025)
2. **Monitoreo** del comportamiento en producción
3. **Optimizaciones menores** según feedback
4. **Documentación de casos edge** si aparecen

---

## 📝 NOTAS IMPORTANTES

- **Créditos API:** Cada consulta consume créditos de Beds24
- **Zona horaria:** Sistema acepta limitación UTC de Beds24
- **Fechas:** Usar siempre formato YYYY-MM-DD
- **Logs:** Revisar logs para debugging detallado 