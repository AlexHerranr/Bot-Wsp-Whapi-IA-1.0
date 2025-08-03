# 🏢 Guía de Implementación CRM - Sistema Dual

## 📋 Resumen Ejecutivo

Se ha implementado un **sistema CRM dual** para el bot de WhatsApp de TeAlquilamos que permite análisis automático de conversaciones y seguimiento de clientes mediante dos enfoques:

- **Escenario A (Interno):** Todo dentro del bot (simple, autónomo)
- **Escenario B (N8N):** Flujo visual en N8N (escalable, no-code)

### ✅ Estado de Implementación: **COMPLETADO**

## 🎯 Características Implementadas

### 🤖 Análisis Automático de CRM
- **OpenAI Assistant dedicado** para análisis de conversaciones
- **4 campos clave** actualizados automáticamente:
  - `profileStatus`: Resumen del cliente (máx 300 chars)
  - `proximaAccion`: Acción sugerida específica
  - `fechaProximaAccion`: Fecha de la acción (YYYY-MM-DD)
  - `prioridad`: 1=Alta, 2=Media, 3=Baja

### 📅 Sistema de Tareas Diarias
- **Cron job interno** que se ejecuta diariamente a las 9:00 AM
- **Mensajes personalizados** generados con OpenAI
- **Limpieza automática** de acciones completadas

### 🔌 API para N8N
- **5 endpoints REST** para integración externa
- **Fallback automático** al sistema interno si N8N falla
- **Monitoreo y estado** del sistema

## 🗂️ Estructura de Archivos Implementada

```
src/
├── core/
│   ├── services/
│   │   └── simple-crm.service.ts        ✅ Servicio principal CRM
│   ├── jobs/
│   │   └── daily-actions.job.ts         ✅ Tareas diarias automáticas  
│   ├── routes/
│   │   └── crm.routes.ts               ✅ API endpoints para N8N
│   └── api/
│       └── webhook-processor.ts        ✅ Integración con webhooks
├── main.ts                             ✅ Inicialización CRM
└── prisma/
    ├── schema.prisma                   ✅ Campos CRM en BD
    └── migrations/
        └── 20250731_add_crm_fields/    ✅ Migración aplicada

tests/
├── integration/
│   └── crm-system.test.ts              ✅ Tests de integración
└── unit/
    └── crm-analysis.test.ts            ✅ Tests unitarios
```

## ⚙️ Configuración

### 🔧 Variables de Entorno (.env)

```bash
# 🏢 CRM SISTEMA DUAL
CRM_MODE=internal                        # 'internal' o 'n8n'
CRM_ANALYSIS_ENABLED=true               # Habilita análisis CRM
CRM_BACKUP_ENABLED=true                 # Fallback si N8N falla
CRM_ASSISTANT_ID=asst_XXXXXXXXXXXXXXXX  # ID del Assistant OpenAI
```

### 🗄️ Base de Datos

Los campos CRM se han agregado al modelo `ClientView`:

```prisma
model ClientView {
  // ... campos existentes ...
  
  // 🏢 CRM - AUTOMATIZADO
  profileStatus       String?   @db.Text  // Resumen del cliente
  proximaAccion       String?             // Acción sugerida
  fechaProximaAccion  DateTime?           // Fecha de la acción
  prioridad           Int?      @default(2)  // 1=Alta, 2=Media, 3=Baja
}
```

## 🚀 Uso del Sistema

### 📱 Modo Automático (Recomendado)

1. **Configurar variables de entorno:**
   ```bash
   CRM_MODE=internal
   CRM_ANALYSIS_ENABLED=true
   ```

2. **Crear OpenAI Assistant:**
   - Usar el prompt system proporcionado en la documentación
   - Guardar el `assistant_id` en `CRM_ASSISTANT_ID`

3. **Reiniciar el bot:**
   ```bash
   npm run dev
   ```

El sistema analizará automáticamente cada conversación y actualizará los campos CRM.

### 🎨 Modo N8N (Avanzado)

1. **Configurar variables:**
   ```bash
   CRM_MODE=n8n
   CRM_BACKUP_ENABLED=true
   ```

2. **Configurar workflows en N8N:**
   - **Workflow 1:** Análisis CRM (trigger: webhook)
   - **Workflow 2:** Acciones diarias (trigger: cron 9:00 AM)

3. **Usar endpoints API:**
   - `POST /api/crm/analyze-conversation`
   - `POST /api/crm/send-followup`
   - `GET /api/crm/today-actions`

## 📊 API Endpoints

### `POST /api/crm/send-followup`
Envía seguimiento personalizado a un cliente.

```json
{
  "phoneNumber": "573001234567",
  "profileStatus": "Cliente interesado en hotel boutique",
  "proximaAccion": "enviar opciones disponibles",
  "userName": "Juan Pérez"
}
```

### `POST /api/crm/analyze-conversation`
Analiza conversación y actualiza CRM.

```json
{
  "phoneNumber": "573001234567"
}
```

### `GET /api/crm/today-actions`
Obtiene clientes con acciones programadas para hoy.

### `POST /api/crm/execute-daily-actions`
Ejecuta manualmente las tareas diarias (testing).

### `GET /api/crm/status`
Estado del sistema CRM.

## 🧪 Testing

### Ejecutar Tests
```bash
# Tests unitarios
npm test tests/unit/crm-analysis.test.ts

# Tests de integración
npm test tests/integration/crm-system.test.ts

# Todos los tests CRM
npm test -- --testPathPattern=crm
```

### Prueba Manual
```bash
# Estado del sistema
curl http://localhost:3008/api/crm/status

# Ejecutar acciones diarias
curl -X POST http://localhost:3008/api/crm/execute-daily-actions
```

## 🔄 Flujo de Funcionamiento

### 1. Análisis Automático
```
Webhook Message → WebhookProcessor → SimpleCRMService → OpenAI Assistant → Database Update
```

### 2. Tareas Diarias
```
Cron 9:00 AM → DailyActionsJob → Query DB → Generate Message → Send WhatsApp → Cleanup
```

### 3. Modo N8N
```
N8N Workflow → API Endpoints → Bot Actions → Database Update
```

## 🛠️ Prompt del OpenAI Assistant

```
Eres un asistente CRM para una empresa de turismo hotelero. Analiza la conversación proporcionada y responde SOLO con JSON válido (sin texto adicional):

{
  "profileStatus": "Resumen breve del cliente y lo que se ha hablado (máx 300 caracteres, enfócate en reservas, intereses y status actual)",
  "proximaAccion": "Acción específica a realizar con el cliente (ej: 'enviar opciones de hoteles boutique en Cartagena')",
  "fechaProximaAccion": "YYYY-MM-DD (fecha sugerida para la acción, basada en la conversación; usa hoy si es urgente)",
  "prioridad": 1-3  // 1=Alta (urgente, reserva inminente), 2=Media (seguimiento normal), 3=Baja (mantenimiento)
}

Contexto: Empresa TeAlquilamos (hoteles en Colombia). Prioriza reservas, check-in/out y oportunidades de venta. Si no hay info suficiente, usa defaults razonables.
```

## 📈 Monitoreo y Logs

### Logs del Sistema
```bash
✅ CRM actualizado para 573001234567
🕘 Ejecutando acciones CRM internas...
📋 Procesando 3 clientes con acciones programadas
✅ Seguimiento enviado a 573001234567
```

### Monitoreo de Estado
- **Database Connection:** PostgreSQL con fallback a memoria
- **OpenAI API:** Retry automático en errores
- **WHAPI Integration:** Manejo de errores y timeouts
- **Daily Job Status:** Running/Stopped

## ⚠️ Consideraciones

### Costos OpenAI
- **~500 tokens por análisis** (optimizado para 10 mensajes recientes)
- **Estimado:** $0.01-0.02 USD por cliente analizado

### Performance
- **Análisis asíncrono:** No bloquea el webhook principal
- **Rate limiting:** Pausa de 1s entre clientes en daily actions
- **Memory fallback:** Sistema continúa funcionando sin BD

### Seguridad
- **Validación de payloads** con Zod
- **Manejo de errores** sin exponer información sensible
- **Cleanup automático** de threads OpenAI

## 🔄 Escalabilidad

### Para Más Funcionalidades CRM
1. **Agregar campos** al modelo `ClientView`
2. **Extender el prompt** del OpenAI Assistant  
3. **Crear nuevos endpoints** en `crm.routes.ts`
4. **Agregar tests correspondientes**

### Para Más Integraciones
1. **Crear nuevos servicios** en `src/core/services/`
2. **Registrar en DI container** en `main.ts`
3. **Exponer via API** si necesario

## 🎉 Próximos Pasos

1. **Crear el OpenAI Assistant** específico para CRM
2. **Configurar `CRM_ASSISTANT_ID`** en `.env`
3. **Testear con clientes reales** en modo desarrollo
4. **Monitorear logs y performance**
5. **Considerar N8N workflows** para casos avanzados

El sistema está **listo para producción** y se puede alternar entre modos según las necesidades del negocio.