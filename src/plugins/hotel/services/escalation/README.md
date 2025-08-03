# 🚀 Sistema de Escalamiento Inteligente

Sistema mínimo y eficiente para escalar solo los casos que **REALMENTE** requieren intervención humana.

## 🎯 **Filosofía del Sistema**

- **El bot maneja todo lo que puede** automáticamente
- **Solo escala lo crítico** que requiere humano
- **Mensajes claros** con contexto completo
- **Configuración simple** y mantenible

---

## 📋 **Razones de Escalamiento (5 Esenciales)**

### **💰 payment_confirmation**
- **Cuándo**: Cliente envía comprobante de pago
- **Por qué**: Requiere verificación manual en cuenta bancaria
- **Acción**: Verificar pago y confirmar al cliente

### **⚠️ customer_complaint**
- **Cuándo**: Cliente tiene queja o problema serio
- **Por qué**: Requiere atención personal inmediata
- **Acción**: Contactar cliente para resolver

### **🔧 damage_report**
- **Cuándo**: Cliente reporta daños en apartamento
- **Por qué**: Requiere inspección física y medidas
- **Acción**: Inspeccionar apartamento y tomar acción

### **📍 arrival_notification**
- **Cuándo**: Cliente notifica hora de llegada
- **Por qué**: Coordinación necesaria con equipo de recepción
- **Acción**: Coordinar recepción y acceso

### **🚪 departure_notification**
- **Cuándo**: Cliente notifica hora de salida
- **Por qué**: Coordinación necesaria para checkout
- **Acción**: Coordinar revisión y checkout

---

## 🛠️ **Uso del Sistema**

### **Desde OpenAI (Function Calling)**
```typescript
// El asistente de OpenAI llama automáticamente
escalate_to_human("payment_confirmation", {
  userId: "573001234567",
  userName: "Juan Pérez", 
  chatId: "573001234567@s.whatsapp.net",
  context: { /* información adicional */ }
})
```

### **Desde Código (Manual)**
```typescript
import { EscalationServiceMinimal } from './escalation-minimal.service';

await EscalationServiceMinimal.escalateToHuman('customer_complaint', {
  userId: '573001234567',
  userName: 'Juan Pérez',
  chatId: '573001234567@s.whatsapp.net',
  reason: 'customer_complaint',
  context: { complaint: 'Apartamento sucio' }
});
```

---

## 📁 **Estructura de Archivos**

```
src/services/escalation/
├── README.md                           # Este archivo
├── escalation-minimal.config.ts        # Configuración (5 razones)
├── escalation-minimal.service.ts       # Servicio principal
└── tests/
    └── test-minimal-escalation.js      # Tests del sistema
```

---

## ⚙️ **Configuración**

### **Variables de Entorno Requeridas**
```env
WHAPI_TOKEN=tu_token_whapi
WHAPI_URL=https://gate.whapi.cloud
```

### **Contactos de Escalamiento**
```typescript
// En escalation-minimal.config.ts
PRINCIPAL: {
  id: '573003913251@s.whatsapp.net',  // Tu número
  name: 'Alexander',
  priority: 'high'
}
```

---

## 🧪 **Testing**

### **Ejecutar Tests**
```bash
npx tsx tests/escalation/test-minimal-escalation.js
```

### **Resultado Esperado**
- ✅ 5 mensajes enviados a WhatsApp
- ✅ Templates correctos para cada razón
- ✅ Contexto completo del cliente

---

## 🔄 **Integración con Function Handler**

El sistema se integra automáticamente con el function handler principal:

```typescript
// En function-handler.ts
case 'escalate_to_human':
  return await this.handleEscalateToHuman(args);
```

---

## 📈 **Expandir el Sistema**

### **Agregar Nueva Razón**
1. **Editar configuración**:
   ```typescript
   // escalation-minimal.config.ts
   'nueva_razon': {
     reason: 'nueva_razon',
     destination: ESCALATION_DESTINATIONS.PRINCIPAL,
     requiresImmediate: true,
     includeContext: true,
     template: 'NUEVA_RAZON'
   }
   ```

2. **Agregar template**:
   ```typescript
   // escalation-minimal.service.ts
   'nueva_razon': `🆕 *NUEVA RAZÓN*
   
   👤 Cliente: ${context.userName}
   📞 *Acción:* Descripción de la acción
   ⏰ ${timestamp}`
   ```

3. **Actualizar RAG** (opcional):
   - Documentar cuándo usar la nueva razón
   - Actualizar instrucciones del asistente

### **Agregar Nuevo Contacto**
```typescript
// escalation-minimal.config.ts
NUEVO_CONTACTO: {
  type: 'contact',
  id: '573XXXXXXXXX@s.whatsapp.net',
  name: 'Nombre Contacto',
  priority: 'medium'
}
```

---

## 🚫 **Lo que NO Escala**

El bot maneja automáticamente (sin escalamiento):
- ✅ Completar reservas
- ✅ Consultas de disponibilidad  
- ✅ Coordinación básica de horarios
- ✅ Preguntas frecuentes
- ✅ Cotizaciones
- ✅ Información general

---

## 📊 **Métricas y Monitoreo**

### **Logs del Sistema**
```bash
# Ver logs de escalamiento
grep "ESCALATION" logs/bot-*.log

# Contar escalamientos por razón
grep "Escalando por razón" logs/bot-*.log | sort | uniq -c
```

### **Indicadores de Éxito**
- **Tasa de escalamiento < 5%** de conversaciones totales
- **Tiempo de respuesta < 2 minutos** para escalamientos críticos
- **0 falsos positivos** (escalamientos innecesarios)

---

## 🔧 **Troubleshooting**

### **Mensaje no llega**
1. Verificar `WHAPI_TOKEN` configurado
2. Verificar número de destino válido
3. Revisar logs de error en consola

### **Template incorrecto**
1. Verificar razón en `ESCALATION_RULES`
2. Verificar template en `generateSpecificMessage`
3. Probar con test individual

### **Escalamiento no funciona**
1. Verificar function handler integrado
2. Verificar OpenAI puede llamar función
3. Revisar logs de function calling

---

## 📞 **Soporte**

Para problemas o mejoras del sistema de escalamiento:
- Revisar logs en `logs/bot-*.log`
- Ejecutar tests para verificar funcionamiento
- Consultar documentación del RAG

---

**🎯 Sistema diseñado para máxima eficiencia y mínimo ruido** 