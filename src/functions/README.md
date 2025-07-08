# 🚀 Sistema de Funciones - Arquitectura Modular

## 📁 Estructura de Carpetas

```
src/functions/
├── types/
│   └── function-types.ts          # Tipos compartidos
├── registry/
│   └── function-registry.ts       # Registro central
├── availability/
│   └── beds24-availability.ts     # Funciones de disponibilidad
├── escalation/
│   └── escalate-to-human.ts       # Funciones de escalamiento
├── booking/                       # Funciones de booking (futuras)
│   ├── create-booking.ts
│   ├── get-booking-details.ts
│   └── cancel-booking.ts
├── index.ts                       # Exportaciones principales
└── README.md                      # Esta documentación
```

---

## 🎯 Funciones Activas

### ✅ **Implementadas y Activas**

| Función | Categoría | Estado | Descripción |
|---------|-----------|--------|-------------|
| `check_availability` | `availability` | ✅ **Activa** | Consulta disponibilidad en Beds24 |
| `escalate_to_human` | `escalation` | ✅ **Activa** | Escalamiento a agente humano |

### 📋 **Documentadas (Pendientes de Implementación)**

| Función | Categoría | Estado | Descripción |
|---------|-----------|--------|-------------|
| `create_booking` | `booking` | 📋 **Documentada** | Crear reserva en Beds24 |
| `get_booking_details` | `booking` | 📋 **Documentada** | Consultar detalles de reserva |
| `cancel_booking` | `booking` | 📋 **Documentada** | Cancelar reserva existente |

### ❌ **Deshabilitadas**

| Función | Razón | Estado |
|---------|-------|--------|
| `update_client_labels` | No se usa en RAG | ❌ **Deshabilitada** |
| `get_available_labels` | No se usa en RAG | ❌ **Deshabilitada** |

---

## 🔧 Uso del Sistema

### **1. Importar Funciones**
```typescript
import { 
  executeFunction, 
  generateOpenAISchemas,
  getRegistryStats 
} from './functions/index.js';
```

### **2. Ejecutar Función**
```typescript
// Ejecutar función por nombre
const result = await executeFunction('check_availability', {
  startDate: '2025-07-15',
  endDate: '2025-07-18'
});
```

### **3. Obtener Esquemas para OpenAI**
```typescript
// Generar esquemas para OpenAI Assistant
const schemas = generateOpenAISchemas();
```

### **4. Estadísticas del Registro**
```typescript
// Obtener estadísticas
const stats = getRegistryStats();
console.log(`Funciones activas: ${stats.enabled}/${stats.total}`);
```

---

## 🏗️ Crear Nueva Función

### **1. Crear Handler**
```typescript
// src/functions/mi-categoria/mi-funcion.ts
import type { FunctionDefinition, FunctionResponse } from '../types/function-types.js';

export async function handleMiFuncion(args: any): Promise<FunctionResponse> {
  // Lógica de la función
  return {
    success: true,
    data: 'resultado'
  };
}

export const miFuncionDefinition: FunctionDefinition = {
  name: 'mi_funcion',
  description: 'Descripción de mi función',
  handler: handleMiFuncion,
  parameters: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Parámetro 1'
      }
    },
    required: ['param1'],
    additionalProperties: false
  },
  enabled: true,
  category: 'mi-categoria',
  version: '1.0.0'
};
```

### **2. Registrar Función**
```typescript
// src/functions/registry/function-registry.ts
import { miFuncionDefinition } from '../mi-categoria/mi-funcion.js';

export const FUNCTION_REGISTRY: Record<string, FunctionDefinition> = {
  // ... funciones existentes
  mi_funcion: miFuncionDefinition,
};
```

### **3. Exportar en Índice**
```typescript
// src/functions/index.ts
export * from './mi-categoria/mi-funcion.js';
```

---

## 📊 Ventajas de la Nueva Arquitectura

### **✅ Beneficios**

1. **🔧 Modularidad**: Cada función en su propio archivo
2. **📋 Registro Central**: Gestión centralizada de todas las funciones
3. **🎯 Tipado Fuerte**: TypeScript para mejor desarrollo
4. **🔄 Fácil Mantenimiento**: Estructura clara y organizada
5. **📈 Escalabilidad**: Fácil agregar nuevas funciones
6. **🧪 Testing**: Cada función puede ser probada independientemente

### **🚀 Mejoras vs Sistema Anterior**

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Estructura** | Todo en un archivo | Modular por categorías |
| **Registro** | Switch manual | Registro automático |
| **Tipado** | Mínimo | Fuerte con TypeScript |
| **Documentación** | Dispersa | Centralizada |
| **Testing** | Difícil | Fácil por función |
| **Escalabilidad** | Limitada | Alta |

---

## 🧪 Testing

### **Probar Función Individual**
```typescript
import { executeFunction } from './functions/index.js';

// Test de disponibilidad
const result = await executeFunction('check_availability', {
  startDate: '2025-07-15',
  endDate: '2025-07-18'
});

console.log('Resultado:', result);
```

### **Validar Registro**
```typescript
import { validateRegistry } from './functions/index.js';

const validation = validateRegistry();
if (!validation.valid) {
  console.error('Errores en registro:', validation.errors);
}
```

---

## 🔄 Migración Completada

### **Cambios Realizados**

1. ✅ **Estructura creada**: Carpetas organizadas por categoría
2. ✅ **Tipos definidos**: TypeScript para todas las funciones
3. ✅ **Registro central**: Sistema unificado de gestión
4. ✅ **Funciones migradas**: `check_availability` y `escalate_to_human`
5. ✅ **Handler actualizado**: Usa el nuevo registro
6. ✅ **Scripts actualizados**: Usan el nuevo sistema
7. ✅ **Documentación completa**: Funciones de booking documentadas

### **Funciones Sin Cambios**

- ✅ **check_availability**: Funciona igual, nueva estructura
- ✅ **escalate_to_human**: Funciona igual, nueva estructura
- ✅ **Compatibilidad**: Sin cambios en la API externa

---

## 📚 Documentación Relacionada

- 📋 [create_booking](../../docs/functions/booking/create_booking.md)
- 📋 [get_booking_details](../../docs/functions/booking/get_booking_details.md)
- 📋 [cancel_booking](../../docs/functions/booking/cancel_booking.md)
- 🏠 [README Principal](../../README.md)

---

**📅 Última actualización:** Julio 2025  
**🔗 Mantenido por:** Sistema de Bot WhatsApp con IA 