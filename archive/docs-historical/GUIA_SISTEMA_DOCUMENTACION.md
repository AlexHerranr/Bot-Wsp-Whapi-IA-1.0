# 📚 GUÍA DEL SISTEMA DE DOCUMENTACIÓN AUTOMÁTICA

*Fecha: 2025-07-04*
*Sistema implementado y funcional*

## 🎯 ¿Qué es este sistema?

Un sistema **semi-automático** para mantener la documentación actualizada cuando haces cambios en el código. Te ayuda a **no olvidar** actualizar la documentación y facilita las **actualizaciones masivas**.

## 🚀 ¿Cómo funciona?

### 1. **Agregar Tags al Código**
Cuando hagas cambios importantes, agrega comentarios especiales:

```typescript
// @docs: features/NUEVA_FUNCIONALIDAD.md
// @change: "Implementada validación de fechas"
// @date: 2025-07-04
export function nuevaFuncion() {
    // Tu código aquí
}
```

### 2. **Detectar Pendientes**
Ejecuta el comando para ver qué documentación necesita actualización:

```bash
npm run check-docs
```

### 3. **Actualizar Documentación**
- Actualiza manualmente archivo por archivo
- O pide actualización masiva al asistente

## 📝 FORMATOS DE TAGS

### **Formato Básico (Mínimo)**
```typescript
// @docs: archivo.md
```

### **Formato Completo (Recomendado)**
```typescript
// @docs: features/CONTEXTO_HISTORIAL.md
// @change: "Agregada funcionalidad de historial"
// @date: 2025-07-04
```

### **Múltiples Archivos**
```typescript
// @docs: features/BEDS24_INTEGRATION.md
// @docs: progress/PROGRESO-BOT.md
// @change: "Optimización de formato de respuesta"
// @date: 2025-07-04
```

## 🎯 **CASOS DE USO COMUNES**

### **1. Nueva Funcionalidad**
```typescript
// @docs: features/NUEVA_FEATURE.md
// @docs: progress/PROGRESO-BOT.md
// @change: "Implementada nueva funcionalidad X"
// @date: 2025-07-04
export function nuevaFeature() {
    // ...
}
```

### **2. Corrección de Bug**
```typescript
// @docs: features/BEDS24_INTEGRATION.md
// @change: "Corregido error en validación de fechas"
// @date: 2025-07-04
function validateDate() {
    // Fix aplicado
}
```

### **3. Optimización**
```typescript
// @docs: progress/PROGRESO-BOT.md
// @change: "Optimizado rendimiento de consultas"
// @date: 2025-07-04
async function optimizedQuery() {
    // Código optimizado
}
```

## 📁 **MAPEO DE ARCHIVOS**

El sistema incluye un mapeo automático en `docs/DOCUMENTATION_MAP.json`:

```json
{
  "src/app.ts": [
    "docs/progress/PROGRESO-BOT.md",
    "docs/progress/ROADMAP.md"
  ],
  "src/utils/whapi/chatHistory.ts": [
    "docs/features/CONTEXTO_HISTORIAL_CONVERSACION.md",
    "docs/progress/PROGRESO-BOT.md"
  ]
}
```

## 🔧 **COMANDOS DISPONIBLES**

### **Detectar Documentación Pendiente**
```bash
npm run check-docs
```

**Salida de ejemplo:**
```
📋 DOCUMENTACIÓN PENDIENTE:

📄 src/app.ts
   🏷️  progress/PROGRESO-BOT.md
      💬 Sistema de contexto histórico implementado
      📅 2025-07-04
      📍 Línea 1
```

## 🔄 **FLUJO DE TRABAJO RECOMENDADO**

### **Durante el Desarrollo:**
1. **Haces cambios** en el código
2. **Agregas tag** `@docs` si es cambio importante
3. **Continúas** desarrollando

### **Cada Semana/Sprint:**
1. **Ejecutas** `npm run check-docs`
2. **Ves** qué documentación está pendiente
3. **Decides**: ¿actualizar manual o pedir ayuda al asistente?

### **Actualización Masiva:**
1. **Acumulas** varios tags durante la semana
2. **Pides al asistente**: "Actualiza toda la documentación pendiente"
3. **El asistente** actualiza todos los archivos marcados
4. **Eliminas** los tags una vez actualizado

## 📊 **VENTAJAS DEL SISTEMA**

### ✅ **Para Ti:**
- **No olvidas** actualizar documentación
- **Acumulas** cambios y actualizas en lotes
- **Mantienes** historial de cambios
- **Delegas** actualizaciones masivas

### ✅ **Para el Proyecto:**
- **Documentación** siempre actualizada
- **Trazabilidad** de cambios
- **Colaboración** más fácil
- **Onboarding** simplificado

## 🎯 **MEJORES PRÁCTICAS**

### **✅ Cuándo Agregar Tags**
- Nueva funcionalidad implementada
- Bug importante corregido
- Cambio en comportamiento existente
- Optimización significativa
- Cambio en API o interfaces

### **❌ Cuándo NO Agregar Tags**
- Cambios menores de formato
- Correcciones de typos
- Refactoring interno sin cambio de comportamiento
- Cambios en comentarios solamente

### **🔄 Mantenimiento**
- **Semanal**: Ejecutar `check-docs`
- **Mensual**: Actualización masiva con asistente
- **Release**: Asegurar documentación actualizada

## 🚀 **EJEMPLO COMPLETO**

### **1. Implementas nueva funcionalidad:**
```typescript
// @docs: features/NOTIFICACIONES.md
// @docs: progress/PROGRESO-BOT.md
// @change: "Sistema de notificaciones push implementado"
// @date: 2025-07-04
export class NotificationService {
    async sendPushNotification(message: string) {
        // Nueva funcionalidad
    }
}
```

### **2. Al final de la semana:**
```bash
npm run check-docs
# Ve que hay 5 archivos con documentación pendiente
```

### **3. Pides actualización:**
```
"Asistente, actualiza toda la documentación pendiente según los tags"
```

### **4. Eliminas tags:**
```typescript
// Tags eliminados después de actualización
export class NotificationService {
    async sendPushNotification(message: string) {
        // Funcionalidad documentada
    }
}
```

## 🎯 **PRÓXIMOS PASOS**

1. **Prueba** el sistema con algunos tags
2. **Ejecuta** `npm run check-docs` para verificar
3. **Acumula** tags durante una semana
4. **Pide** actualización masiva al asistente
5. **Adopta** como parte de tu flujo de trabajo

---

**Este sistema te ahorra tiempo y garantiza que la documentación esté siempre actualizada sin interrumpir tu flujo de desarrollo.** 