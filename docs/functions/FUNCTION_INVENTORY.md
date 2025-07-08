# 📋 Inventario Completo de Funciones OpenAI

## 🔍 Estado Actual de Funciones

### **✅ Funciones Activas (2)**

| Función | Ubicación | Estado | Descripción |
|---------|-----------|--------|-------------|
| `check_availability` | `src/functions/availability/beds24-availability.ts` | ✅ **Activa** | Consulta disponibilidad en tiempo real de Beds24 |
| `escalate_to_human` | `src/functions/escalation/escalate-to-human.ts` | ✅ **Activa** | Escalamiento a agente humano |

### **❌ Funciones Deshabilitadas (2)**

| Función | Ubicación | Estado | Razón |
|---------|-----------|--------|-------|
| `update_client_labels` | `src/handlers/function-handler.ts` | ❌ **Deshabilitada** | No se usa en RAG |
| `get_available_labels` | `src/handlers/function-handler.ts` | ❌ **Deshabilitada** | No se usa en RAG |

### **📋 Funciones Mencionadas en Documentación**

| Función | Ubicación | Estado | Notas |
|---------|-----------|--------|-------|
| `create_booking` | `docs/features/ASSISTANT_CONFIG.md` | 📝 **Documentada** | Solo en documentación, no implementada |

---

## 📂 Estructura Actual (Reorganizada)

```
src/functions/                    # 🆕 Nueva estructura modular
├── types/
│   └── function-types.ts         # Tipos compartidos
├── registry/
│   └── function-registry.ts      # Registro central
├── availability/
│   └── beds24-availability.ts    # Función check_availability
├── escalation/
│   └── escalate-to-human.ts      # Función escalate_to_human
├── booking/                      # Funciones futuras (documentadas)
│   ├── create-booking.ts
│   ├── get-booking-details.ts
│   └── cancel-booking.ts
├── index.ts                      # Exportaciones principales
└── README.md                     # Documentación
```

### **🔧 Cómo funciona ahora:**

1. **OpenAI** llama función → `APP REFERENCIA.ts`
2. **APP** → `FunctionHandler.handleFunction(name, args)`
3. **FunctionHandler** → `executeFunction(name, args)` (registro central)
4. **Registro** → Busca función y ejecuta handler específico
5. **Función específica** → Procesa y retorna resultado

---

## 🎯 Propuesta de Organización Mejorada

### **📁 Nueva Estructura Propuesta:**

```
src/functions/                    # Nueva carpeta para funciones
├── index.ts                      # Registro central de funciones
├── availability/
│   ├── beds24-availability.ts    # Función check_availability
│   └── beds24-availability.test.ts
├── booking/
│   ├── create-booking.ts         # Nueva función create_booking
│   └── create-booking.test.ts
├── escalation/
│   ├── escalate-to-human.ts      # Función escalate_to_human
│   └── escalate-to-human.test.ts
├── labels/
│   ├── update-client-labels.ts   # Función deshabilitada
│   └── get-available-labels.ts   # Función deshabilitada
└── types/
    └── function-types.ts         # Tipos compartidos
```

### **📋 Registro Central (`src/functions/index.ts`):**

```typescript
export interface FunctionDefinition {
  name: string;
  description: string;
  handler: (args: any) => Promise<any>;
  parameters: object;
  enabled: boolean;
  category: string;
  version: string;
}

export const AVAILABLE_FUNCTIONS: FunctionDefinition[] = [
  {
    name: 'check_availability',
    description: 'Consulta disponibilidad en tiempo real de Beds24',
    handler: checkAvailabilityHandler,
    parameters: { /* schema */ },
    enabled: true,
    category: 'availability',
    version: '1.0.0'
  },
  {
    name: 'escalate_to_human',
    description: 'Escalamiento a agente humano',
    handler: escalateToHumanHandler,
    parameters: { /* schema */ },
    enabled: true,
    category: 'escalation',
    version: '1.0.0'
  }
];
```

---

## 🔧 Beneficios de la Nueva Organización

### **✅ Ventajas:**

1. **📂 Organización Clara**: Cada función en su carpeta específica
2. **🧪 Testing**: Tests unitarios por función
3. **📋 Registro Central**: Control total de funciones activas/inactivas
4. **🔄 Escalabilidad**: Fácil agregar nuevas funciones
5. **📚 Documentación**: Cada función con su documentación
6. **🎯 Categorización**: Funciones agrupadas por propósito
7. **⚡ Performance**: Lazy loading de funciones

### **🔧 Migración Gradual:**

1. **Fase 1**: Crear nueva estructura sin romper la actual
2. **Fase 2**: Migrar funciones una por una
3. **Fase 3**: Actualizar FunctionHandler para usar registro
4. **Fase 4**: Eliminar código legacy

---

## 📊 Funciones Futuras Identificadas

### **🎯 Funciones Prioritarias:**

| Función | Categoría | Prioridad | Descripción |
|---------|-----------|-----------|-------------|
| `create_booking` | booking | 🔴 **Alta** | Crear reserva en Beds24 |
| `get_booking_details` | booking | 🟡 **Media** | Obtener detalles de reserva |
| `cancel_booking` | booking | 🟡 **Media** | Cancelar reserva |
| `send_notification` | communication | 🟢 **Baja** | Enviar notificaciones |
| `update_guest_info` | guests | 🟢 **Baja** | Actualizar información de huésped |

### **🔧 Funciones de Utilidad:**

| Función | Categoría | Prioridad | Descripción |
|---------|-----------|-----------|-------------|
| `validate_dates` | validation | 🟡 **Media** | Validar fechas de reserva |
| `calculate_price` | pricing | 🟡 **Media** | Calcular precios dinámicos |
| `check_restrictions` | validation | 🟢 **Baja** | Verificar restricciones |
| `get_weather` | external | 🟢 **Baja** | Información meteorológica |

---

## 🚀 Scripts de Gestión Propuestos

### **📋 Comandos para Funciones:**

```bash
# Crear nueva función
npm run function:create booking/create-booking

# Habilitar/deshabilitar función
npm run function:toggle check_availability

# Listar funciones
npm run function:list

# Probar función
npm run function:test check_availability

# Actualizar esquemas en OpenAI
npm run function:sync-openai
```

---

## 📚 Documentación por Función

### **📁 Estructura de Documentación:**

```
docs/functions/
├── README.md                     # Índice general
├── availability/
│   ├── check_availability.md     # Documentación completa
│   └── beds24-integration.md     # Detalles técnicos
├── booking/
│   └── create_booking.md         # Especificaciones
├── escalation/
│   └── escalate_to_human.md      # Flujo de escalamiento
└── templates/
    └── function-template.md      # Plantilla para nuevas funciones
```

---

## 🎯 Próximos Pasos

### **🔧 Implementación Inmediata:**

1. **Crear estructura de carpetas**
2. **Mover función `check_availability`**
3. **Crear registro central**
4. **Actualizar FunctionHandler**
5. **Documentar nueva función a implementar**

### **📋 ¿Qué función implementamos primero?**

Opciones identificadas:
- 🎯 `create_booking` - Crear reservas
- 🔍 `get_booking_details` - Consultar reservas
- 💰 `calculate_price` - Cálculo de precios
- 📧 `send_notification` - Notificaciones

---

**📅 Última actualización:** Julio 2025  
**🔗 Relacionado:** [Function Handler](../handlers/FUNCTION_HANDLER.md) | [OpenAI Integration](../integrations/OPENAI_INTEGRATION.md) 