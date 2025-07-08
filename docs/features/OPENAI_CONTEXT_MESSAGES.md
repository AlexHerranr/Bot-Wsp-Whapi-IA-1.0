# 🤖 Mensajes de Contexto para OpenAI - Sistema de Disponibilidad

## 📋 Descripción

Este documento describe los mensajes contextualizados que el sistema envía a OpenAI para que entienda correctamente la situación de disponibilidad y maneje las expectativas del huésped de manera apropiada.

---

## 🎯 Propósito del Contexto

### **Problema Resuelto:**
Sin contexto, OpenAI no distingue entre:
- ✅ Disponibilidad ideal (apartamento completo)
- 🔄 Alternativas con traslado (no ideales)
- ❌ Sin disponibilidad

### **Solución Implementada:**
Mensajes específicos que guían a OpenAI sobre:
- 🎯 **Qué tipo de disponibilidad existe**
- 📝 **Cómo presentarla al huésped**
- 🔄 **Cuándo ofrecer alternativas**

---

## 📤 Formatos de Mensaje por Escenario

### **🔴 Escenario 1: Sin Disponibilidad Completa**

**Cuándo:** `completeOptions.length === 0 && splitOptions.length > 0`

**Mensaje enviado:**
```
❌ **No hay Disponibilidad Completa - Solo Parcial con Opción de Traslado**
💡 *Alternativas con cambio de apartamento (ofrecer solo como opción adicional al huésped)*

🔄 **Alternativa 1**: 1 traslado - $630.000
   🏠 1722 A: 2025-07-09 a 2025-07-10 - $420.000
   🔄 1317: 2025-07-11 - $210.000
```

**Comportamiento esperado de OpenAI:**
- ✅ Explicar que NO hay disponibilidad ideal
- ✅ Presentar traslados como "alternativas adicionales"
- ✅ Enfatizar que no es lo regular
- ✅ Dar opción al huésped de considerar otras fechas

---

### **🟢 Escenario 2: Con Disponibilidad Completa**

**Cuándo:** `completeOptions.length > 0`

**Mensaje enviado:**
```
🥇 **Apartamentos Disponibles (1 opciones)**
✅ **1722 B** - $850.000
   📊 $170.000/noche

🔄 **Opciones Adicionales con Traslado**
💡 *Alternativas económicas con cambio de apartamento (opcional para el huésped)*
```

**Comportamiento esperado de OpenAI:**
- ✅ Priorizar opciones completas
- ✅ Presentar traslados como "opciones adicionales económicas"
- ✅ Enfatizar que las opciones completas son lo ideal
- ✅ Mencionar traslados solo como alternativa económica

---

### **⚫ Escenario 3: Sin Disponibilidad**

**Cuándo:** `completeOptions.length === 0 && splitOptions.length === 0`

**Mensaje enviado:**
```
❌ **Sin disponibilidad para 4 noches**
💡 Considera fechas alternativas
```

**Comportamiento esperado de OpenAI:**
- ✅ Informar claramente que no hay disponibilidad
- ✅ Sugerir fechas alternativas
- ✅ Ofrecer ayuda para encontrar otras opciones
- ✅ Mantener tono profesional y servicial

---

## 🔧 Implementación Técnica

### **Ubicación del código:**
```javascript
// src/handlers/integrations/beds24-availability.ts
function formatOptimizedResponse(result: OptimizedResult, startDate: string, endDate: string): string
```

### **Lógica de decisión:**
```javascript
if (splitOptions.length > 0) {
    if (completeOptions.length === 0) {
        // Escenario 1: Sin disponibilidad completa
        response += `❌ **No hay Disponibilidad Completa - Solo Parcial con Opción de Traslado**\n`;
        response += `💡 *Alternativas con cambio de apartamento (ofrecer solo como opción adicional al huésped)*\n\n`;
    } else {
        // Escenario 2: Con disponibilidad completa
        response += `🔄 **Opciones Adicionales con Traslado**\n`;
        response += `💡 *Alternativas económicas con cambio de apartamento (opcional para el huésped)*\n\n`;
    }
}
```

---

## 📊 Impacto en la Experiencia del Usuario

### **Antes (sin contexto):**
- 🔄 OpenAI presentaba traslados como opciones normales
- ❌ No distinguía entre ideal vs alternativa
- 😕 Huésped no entendía por qué había traslados

### **Después (con contexto):**
- ✅ OpenAI explica la situación claramente
- ✅ Prioriza opciones ideales
- ✅ Presenta traslados como alternativas adicionales
- 😊 Huésped entiende las opciones disponibles

---

## 🧪 Testing y Validación

### **Comandos de prueba:**
```bash
# Escenario sin disponibilidad completa
npx tsx tests/beds24/test-beds24.js format 2025-07-09 2025-07-11

# Escenario con disponibilidad completa
npx tsx tests/beds24/test-beds24.js format 2025-07-17 2025-07-21

# Escenario sin disponibilidad
npx tsx tests/beds24/test-beds24.js format 2025-07-09 2025-07-12
```

### **Métricas de validación:**
- ✅ Mensaje correcto según escenario
- ✅ Contexto apropiado para OpenAI
- ✅ Instrucciones claras sobre presentación
- ✅ Longitud de mensaje optimizada (~168 tokens)

---

## 🔄 Mantenimiento

### **Actualizaciones futuras:**
- 📝 Ajustar mensajes según feedback de usuarios
- 🎯 Optimizar tokens para reducir costos
- 🔧 Agregar más contexto si es necesario
- 📊 Monitorear efectividad en conversaciones reales

### **Consideraciones:**
- 💰 **Tokens**: Mensajes más largos = más costo
- 🎯 **Claridad**: Balance entre contexto y brevedad
- 🔄 **Consistencia**: Mantener formato uniforme
- 📈 **Efectividad**: Medir impacto en satisfacción del cliente

---

**📅 Última actualización:** Julio 2025 - Versión 1.0
**🔗 Relacionado:** [Sistema de Splits](../SPLITS_SYSTEM.md) | [Beds24 Integration](../../integrations/beds24/README.md) 