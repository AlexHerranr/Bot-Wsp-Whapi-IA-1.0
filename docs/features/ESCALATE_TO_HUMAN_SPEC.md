# 📞 ESPECIFICACIÓN TÉCNICA: escalate_to_human()

*Fecha: 2025-07-02*
*Estado: PROPUESTA TÉCNICA - LISTO PARA IMPLEMENTACIÓN*

---

## 🎯 OBJETIVO

Implementar función de escalamiento automático que permita al bot transferir conversaciones complejas a agentes humanos específicos vía WhatsApp, manteniendo contexto completo y especialización por área.

---

## 🏗️ ARQUITECTURA TÉCNICA

### **1. FUNCIÓN PRINCIPAL**
```typescript
// src/handlers/function-handler.ts
export const handleEscalateToHuman = async (reason: string, context: string) => {
  try {
    const targetAgent = getAgentByReason(reason);
    const message = formatEscalationMessage(reason, context);
    
    const result = await sendWhatsAppNotification(targetAgent, message);
    
    logInfo('ESCALATE_TO_HUMAN', `Escalamiento exitoso: ${reason}`, {
      targetAgent,
      reason,
      context: context.substring(0, 100)
    });
    
    return {
      success: true,
      escalated_to: targetAgent,
      reason: reason,
      message: "Conectando con agente especializado..."
    };
    
  } catch (error) {
    logError('ESCALATE_TO_HUMAN', `Error en escalamiento: ${error.message}`, { reason, error });
    return {
      success: false,
      error: error.message,
      message: "Disculpa, hay un problema técnico. Intenta de nuevo en un momento."
    };
  }
};
```

### **2. MAPEO DE AGENTES**
```typescript
// src/config/agents.config.ts
export const AGENT_CONTACTS = {
  RESERVAS: process.env.AGENT_RESERVAS || "573001234567",
  SOPORTE: process.env.AGENT_SOPORTE || "573007654321", 
  SUPERVISOR: process.env.AGENT_SUPERVISOR || "573009876543"
};

export const getAgentByReason = (reason: string): string => {
  const mapping = {
    "complete_booking": AGENT_CONTACTS.RESERVAS,
    "no_availability": AGENT_CONTACTS.RESERVAS,
    "modify_booking": AGENT_CONTACTS.RESERVAS,
    "technical_issue": AGENT_CONTACTS.SOPORTE,
    "complaint": AGENT_CONTACTS.SUPERVISOR,
    "complex_request": AGENT_CONTACTS.RESERVAS
  };
  
  return mapping[reason] || AGENT_CONTACTS.SUPERVISOR;
};
```

### **3. FORMATEO DE MENSAJES**
```typescript
// src/utils/escalation-formatter.ts
export const formatEscalationMessage = (reason: string, context: string): string => {
  const timestamp = new Date().toLocaleString('es-CO');
  const contextObj = tryParseContext(context);
  
  const templates = {
    "complete_booking": `
🟢 [RESERVA LISTA] - ${timestamp}
Cliente: ${contextObj.client}
Apartamento: ${contextObj.apartment}
Fechas: ${contextObj.dates}
Total: ${contextObj.total}
Estado: Cliente confirmó interés

Contexto completo: ${context}
    `,
    
    "no_availability": `
🔴 [SIN DISPONIBILIDAD] - ${timestamp}
Cliente: ${contextObj.client}
Fechas solicitadas: ${contextObj.dates}
Huéspedes: ${contextObj.guests}
Estado: Beds24 sin opciones

Buscar alternativas o terceros.
Contexto: ${context}
    `,
    
    "technical_issue": `
⚠️ [PROBLEMA TÉCNICO] - ${timestamp}
Cliente: ${contextObj.client}
Error: ${contextObj.error}
Sistema: ${contextObj.system || 'Bot principal'}

Revisar logs y dar seguimiento.
Contexto: ${context}
    `
  };
  
  return templates[reason] || `
📋 [ESCALAMIENTO] - ${timestamp}
Razón: ${reason}
Contexto: ${context}
  `;
};
```

---

## 🔧 INTEGRACIÓN CON FUNCTION CALLING

### **1. REGISTRO EN OPENAI ASSISTANT**
```json
{
  "type": "function",
  "function": {
    "name": "escalate_to_human",
    "description": "Escala conversación a agente humano especializado cuando el bot no puede resolver la consulta",
    "parameters": {
      "type": "object",
      "properties": {
        "reason": {
          "type": "string",
          "enum": [
            "complete_booking",
            "no_availability", 
            "modify_booking",
            "technical_issue",
            "complaint",
            "complex_request"
          ],
          "description": "Razón del escalamiento para dirigir al agente correcto"
        },
        "context": {
          "type": "string",
          "description": "Contexto completo de la conversación para transferir al agente"
        }
      },
      "required": ["reason", "context"],
      "additionalProperties": false
    },
    "strict": true
  }
}
```

### **2. INTEGRACIÓN EN function-handler.ts**
```typescript
// src/handlers/function-handler.ts
export class FunctionHandler {
  async handleFunction(functionName: string, args: any): Promise<any> {
    switch (functionName) {
      case 'check_availability':
        return await this.handleCheckAvailability(args);
      
      case 'escalate_to_human':  // ✅ NUEVA FUNCIÓN
        return await this.handleEscalateToHuman(args);
        
      default:
        throw new Error(`Función no reconocida: ${functionName}`);
    }
  }
  
  private async handleEscalateToHuman(args: any): Promise<any> {
    const { reason, context } = args;
    return await handleEscalateToHuman(reason, context);
  }
}
```

---

## 📱 INTEGRACIÓN CON WHAPI

### **1. ENVÍO DE NOTIFICACIÓN**
```typescript
// src/utils/whapi-escalation.ts
export const sendWhatsAppNotification = async (targetContact: string, message: string) => {
  const chatId = targetContact.includes('@') ? targetContact : `${targetContact}@s.whatsapp.net`;
  
  const payload = {
    to: chatId,
    body: message
  };
  
  const response = await fetch(`${process.env.WHAPI_API_URL}/messages/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`Error enviando notificación: ${response.status}`);
  }
  
  const result = await response.json();
  
  logInfo('WHAPI_ESCALATION', 'Notificación enviada exitosamente', {
    targetContact,
    messageId: result.id,
    messageLength: message.length
  });
  
  return result;
};
```

---

## 🛠️ CONFIGURACIÓN REQUERIDA

### **1. VARIABLES DE ENTORNO (.env)**
```bash
# Agentes de escalamiento
AGENT_RESERVAS=573001234567      # Agente de reservas principal
AGENT_SOPORTE=573007654321       # Soporte técnico
AGENT_SUPERVISOR=573009876543    # Supervisor para casos complejos
```

### **2. PROMPT DEL ASSISTANT (Actualización)**
```markdown
FUNCIÓN NUEVA: escalate_to_human()

Usa esta función cuando:
- Cliente dice "quiero reservar" o confirma interés en apartamento
- check_availability() no retorna opciones y cliente insiste
- Error técnico impide responder apropiadamente  
- Consulta muy compleja fuera del ámbito del bot
- Cliente solicita hablar con humano

EJEMPLOS DE USO:
- escalate_to_human("complete_booking", "Cliente Alexander quiere reservar 2005B del 2-6 julio por $510.000")
- escalate_to_human("no_availability", "Fechas 2-6 julio para 2 personas, sin opciones en Beds24")
- escalate_to_human("technical_issue", "Error en check_availability() para Alexander")

DESPUÉS del escalamiento, SIEMPRE responder al cliente:
"Perfecto, te estoy conectando con mi colega especialista que podrá ayudarte inmediatamente."
```

---

## 📊 CASOS DE USO DETALLADOS

### **CASO 1: Cliente Listo para Reservar**
```
[USER] "Me gusta el apartamento 2005B, quiero reservarlo"
[BOT] Detecta intención de reserva
[FUNCTION] escalate_to_human("complete_booking", "Cliente Alexander quiere reservar 2005B del 2-6 julio por $510.000. Mostró interés después de ver opciones disponibles.")
[WHAPI] → Notificación a AGENT_RESERVAS
[BOT] "Perfecto, te estoy conectando con mi colega especialista..."
[AGENTE] Recibe contexto completo y contacta cliente
```

### **CASO 2: Sin Disponibilidad**
```
[USER] "Que tienes desde hoy 2 Jul al 6 para 2 personas"
[BOT] check_availability() → Sin opciones
[BOT] "No hay disponibilidad para esas fechas específicas"
[USER] "Necesito sí o sí esas fechas"
[FUNCTION] escalate_to_human("no_availability", "Fechas 2-6 julio para 2 personas, Beds24 sin opciones, cliente insiste en fechas específicas")
[WHAPI] → Notificación a AGENT_RESERVAS  
[BOT] "Déjame conectarte con mi colega que puede buscar alternativas..."
```

### **CASO 3: Error Técnico**
```
[USER] "Disponibilidad del 10 al 15 julio"
[BOT] check_availability() → Timeout/Error 500
[FUNCTION] escalate_to_human("technical_issue", "Error en check_availability() para fechas 10-15 julio, sistema Beds24 no responde")
[WHAPI] → Notificación a AGENT_SOPORTE
[BOT] "Hay un problema técnico temporal, te conecto con soporte..."
```

---

## 📈 MÉTRICAS Y LOGGING

### **1. LOGS ESTRUCTURADOS**
```typescript
// Logs de escalamiento
logInfo('ESCALATE_START', `Iniciando escalamiento: ${reason}`, { client, reason });
logSuccess('ESCALATE_SUCCESS', `Escalamiento completado: ${reason}`, { targetAgent, messageId });
logError('ESCALATE_ERROR', `Error en escalamiento: ${error}`, { reason, client, error });

// Logs de notificación
logInfo('WHAPI_ESCALATION', 'Enviando notificación a agente', { targetAgent, reason });
logSuccess('WHAPI_ESCALATION', 'Notificación entregada', { messageId, targetAgent });
```

### **2. MÉTRICAS ESPERADAS**
- **Escalamientos por día**: Tracking de volumen
- **Razones más comunes**: Optimización del bot
- **Tiempo de respuesta agente**: Post-escalamiento
- **Conversiones**: Escalamientos → Reservas completadas

---

## ⏱️ PLAN DE IMPLEMENTACIÓN

### **FASE 1 (Semana 1):**
- ✅ Implementar función básica escalate_to_human
- ✅ Configurar mapeo de agentes
- ✅ Registrar en OpenAI Assistant
- ✅ Pruebas internas básicas

### **FASE 2 (Semana 2):**
- ✅ Formatear mensajes de escalamiento
- ✅ Integrar con Whapi para notificaciones
- ✅ Logging y error handling completo
- ✅ Pruebas con agentes reales

### **FASE 3 (Opcional):**
- 📊 Dashboard de escalamientos
- 📈 Métricas y analytics
- 🔄 Feedback loop para optimización

---

## 🎯 CRITERIOS DE ÉXITO

### **Funcionales:**
- ✅ Bot escala correctamente según razón
- ✅ Agentes reciben notificación inmediata
- ✅ Contexto completo se transfiere
- ✅ Cliente recibe respuesta natural

### **Técnicos:**
- ✅ Success rate > 95% en envío de notificaciones
- ✅ Tiempo de escalamiento < 2 segundos
- ✅ Error handling robusto
- ✅ Logging completo para debugging

### **Negocio:**
- ✅ Reducción de consultas sin respuesta
- ✅ Mejora en conversión bot → reserva
- ✅ Especialización efectiva de agentes
- ✅ Experiencia fluida cliente

---

*Esta especificación completa el ciclo de atención automatizada, convirtiendo al bot en un pre-calificador inteligente que escala apropiadamente cuando necesario.* 