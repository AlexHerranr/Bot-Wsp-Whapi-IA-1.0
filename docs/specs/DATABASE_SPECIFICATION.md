# 📊 DOCUMENTACIÓN COMPLETA BD - ClientView

## 🏗️ Estructura de la Base de Datos

### Modelo ClientView (PostgreSQL)

```prisma
model ClientView {
  phoneNumber         String   @id                // PK única: 573001234567
  name                String?                     // Nombre real del usuario (WhatsApp API)
  userName            String?                     // Username/alias del usuario  
  label1              String?                     // Primera etiqueta del cliente
  label2              String?                     // Segunda etiqueta del cliente
  label3              String?                     // Tercera etiqueta del cliente
  chatId              String?  @unique            // ID único del chat (constraint único)
  lastActivity        DateTime @updatedAt         // Timestamp última actividad
  threadId            String?                     // ID del thread de OpenAI
  threadTokenCount    Int?     @default(0)        // 📊 NUEVO: Contador tokens del thread
  profileStatus       String?  @db.Text          // Estado CRM (Lead, Booked, etc.)
  proximaAccion       String?                     // Próxima acción CRM
  fechaProximaAccion  DateTime?                   // Fecha programada CRM
  prioridad           Int?     @default(2)        // Prioridad cliente (1-5)
}
```

---

## 📋 ESPECIFICACIÓN DETALLADA DE COLUMNAS

| Columna            | Tipo            | Frecuencia Actualización     | Fuente de Datos              | Lógica de Actualización               |
|--------------------|-----------------|------------------------------|------------------------------|---------------------------------------|
| **phoneNumber**    | String (PK)     | ✅ Una sola vez              | Webhook Whapi                | ID único usuario - NUNCA CAMBIA      |
| **name**           | String?         | 🔄 Solo si discrepancia      | API Whapi /chats/{chatId}    | Actualizar solo si diferente o vacío  |
| **userName**       | String?         | 🔄 Solo si discrepancia      | Webhook Whapi                | Actualizar solo si diferente o vacío  |
| **label1**         | String?         | 🎯 Al consultar thread       | API Whapi /chats/{chatId}    | Si vacío O discrepancia → actualizar inmediato |
| **label2**         | String?         | 🎯 Al consultar thread       | API Whapi /chats/{chatId}    | Si vacío O discrepancia → actualizar inmediato |
| **label3**         | String?         | 🎯 Al consultar thread       | API Whapi /chats/{chatId}    | Si vacío O discrepancia → actualizar inmediato |
| **chatId**         | String? @unique | ✅ Una sola vez              | Webhook Whapi                | Constraint único - NUNCA CAMBIA      |
| **lastActivity**   | DateTime        | ⏰ 10min DESPUÉS del mensaje | DelayedActivityService       | ✅ SISTEMA TIMER: Solo 1 write BD por conversación |
| **threadId**       | String?         | 🔄 Crear/reutilizar          | OpenAI API                   | Crear si no existe, reutilizar si existe |
| **threadTokenCount**| Int? @default(0)| 📊 DELAYED con lastActivity  | DelayedActivityService       | ✅ ACUMULA tokens de todos los runs del thread |
| **profileStatus**  | String?         | 📅 CRM Job (cada 15min)      | Análisis OpenAI + CRM        | Estado del cliente (Lead, Booked, etc.) |
| **proximaAccion**  | String?         | 📅 CRM Job (cada 15min)      | Análisis OpenAI + CRM        | Próxima acción a realizar             |
| **fechaProximaAccion** | DateTime?   | 📅 CRM Job (cada 15min)      | Análisis OpenAI + CRM        | Fecha programada para próxima acción  |
| **prioridad**      | Int? @default(2)| 📅 CRM Job (cada 15min)      | Análisis OpenAI + CRM        | Prioridad cliente (1-5, default: 2)   |

---

## ⏰ LÓGICAS DE ACTUALIZACIÓN POR FRECUENCIA

### 🔄 INMEDIATO (Cada mensaje)
- **userName** ← Webhook Whapi (solo si discrepancia)

### ⏰ DELAYED (10 minutos después del último mensaje)
- **lastActivity** ← DelayedActivityService (1 write BD por conversación)
- **threadTokenCount** ← DelayedActivityService (junto con lastActivity)

### 🎯 AL CONSULTAR THREAD (Optimizado para eficiencia)
- **name** ← API Whapi (solo si name === phoneNumber o vacío)
- **label1/2/3** ← API Whapi (si vacíos O discrepancia → actualizar inmediato)
- **threadId** ← OpenAI API (crear si no existe, reutilizar si existe)

### 📅 PROGRAMADO (Jobs automáticos)
- **CRM Analysis Job (cada 15min):**
  - profileStatus ← Análisis OpenAI de conversaciones
  - proximaAccion ← Análisis OpenAI + decisión CRM
  - fechaProximaAccion ← Análisis OpenAI + decisión CRM
  - prioridad ← Análisis OpenAI + decisión CRM

### 🚫 NUNCA CAMBIAN
- **phoneNumber** ← Webhook Whapi (PK, se establece una vez)
- **chatId** ← Webhook Whapi (constraint único, se establece una vez)

---

## 🏗️ IMPLEMENTACIÓN TÉCNICA

### 📱 Fuentes de Datos

1. **Webhook Whapi** → phoneNumber, chatId, userName
2. **API Whapi /chats/{chatId}** → name, label1/2/3 (enriquecimiento)
3. **OpenAI API** → threadId (threads), tokens → DelayedActivityService
4. **DelayedActivityService** → lastActivity + threadTokenCount (delayed 10min)
5. **CRM Manual/OpenAI** → profileStatus, proximaAccion, fechaProximaAccion, prioridad

### 🛡️ Validaciones y Constraints

- **phoneNumber**: Primary Key única
- **chatId**: Constraint único (evita duplicados automáticamente)
- **threadTokenCount**: Default 0, solo registra (NO limpia automáticamente)
- **prioridad**: Default 2 (MEDIA)

### ⚙️ Servicios y Métodos Actualizados

```typescript
// 🆕 NUEVO SERVICIO: DelayedActivityService
class DelayedActivityService {
  // Programa update delayed (cancela anterior si existe)
  scheduleUpdate(userId: string, tokenCount?: number): void
  
  // ACUMULA tokens en memoria - suma al total existente (mantiene timer)
  updateTokenCount(userId: string, tokenCount: number): void
  
  // Ejecuta todos los updates pendientes (shutdown)
  flushAllUpdates(): Promise<void>
}

// MEJORADO: DatabaseService con acumulación de tokens
async updateThreadActivity(userId: string, tokenCount?: number): Promise<boolean>
// Comportamiento: lee threadTokenCount actual de BD + suma tokenCount nuevos

// MEJORADO: Solo actualiza si hay discrepancia
async upsertClient(clientData: {
  phoneNumber: string;
  userName: string;
  chatId: string;
  lastActivity: Date;  // NO se usa - se maneja por DelayedActivityService
})

// MEJORADO: Enriquecimiento inteligente con discrepancia
private async enrichUserFromWhapi(phoneNumber: string): Promise<void>
```

---

## 🔄 JOBS Y PROCESOS AUTOMÁTICOS

### 1. CRM Analysis Job (cada 15 minutos)
```typescript
// Ubicación: src/core/jobs/crm-analysis.job.ts
// Analiza clientes con 1+ horas de inactividad
// Actualiza: profileStatus, proximaAccion, fechaProximaAccion, prioridad
```

### 2. Daily Actions Job (9:00 AM)
```typescript
// Ubicación: src/core/jobs/daily-actions.job.ts  
// Ejecuta seguimientos programados para el día
// Usa Assistant de reservas (asst_SRqZsLGTOwLCXxOADo7beQuM)
```

### 3. DelayedActivityService (automático)
```typescript
// Sistema de timers en memoria para optimizar BD writes
// Ubicación: src/core/services/delayed-activity.service.ts
// Funcionalidad:
// - Memoria temporal: lastActivity + threadTokenCount 
// - Timer 10min por usuario (cancela anterior si hay nuevo mensaje)
// - 1 SOLA LLAMADA BD por conversación (después del delay)
// - Auto-flush en shutdown del sistema
```

---

## 🎯 REGLAS DE NEGOCIO IMPLEMENTADAS

### ✅ Username Logic
- Solo actualizar si hay discrepancia con BD
- Si no hay username en mensaje, dejar vacío (no forzar)

### ✅ Labels Logic (Optimizado)
- **Si NO hay labels en BD** → Se actualiza inmediatamente desde API Whapi
- **Si hay discrepancia** (BD ≠ Whapi) → Se actualiza inmediatamente  
- **Si son iguales** → No hace nada (eficiente)
- **Momento de verificación**: Al consultar thread (antes de procesar mensajes)
- **Máximo 3 labels por cliente**

### ⏰ LastActivity + Token Logic (DelayedActivityService)
- **SISTEMA OPTIMIZADO**: Timer de 10min en memoria por usuario
- **Eficiencia BD**: Solo 1 write por conversación (vs N writes antes)
- **Memoria temporal**: lastActivity + threadTokenCount juntos
- **Auto-cancelación**: Timer anterior se cancela si llega nuevo mensaje
- **Thread-safe**: Manejo seguro de timers concurrentes
- **Graceful shutdown**: Auto-flush de updates pendientes

### 🧵 Thread Logic (Ya implementado)
- Crear nuevo thread si no existe
- Reutilizar thread existente si está disponible  
- Validar existencia en OpenAI antes de usar
- Auto-renovación semanal (7 días) o por tokens (20k+)

### 📊 Token Tracking Logic (Integrado con DelayedActivityService)
- **Captura automática**: run.usage.total_tokens de OpenAI (tokens DEL RUN individual)
- **Acumulación en memoria**: DelayedActivityService suma tokens run por run 
- **Acumulación en BD**: updateThreadActivity lee total actual + suma nuevos tokens
- **BD optimizada**: Se escribe junto con lastActivity (1 sola query)
- **Sin cleanup**: Solo registro pasivo para análisis

#### 🔄 Flujo de Acumulación de Tokens
```typescript
// 1. OpenAI devuelve tokens del run individual
const runTokens = run.usage?.total_tokens || 0; // ej: 150 tokens

// 2. DelayedActivityService ACUMULA en memoria
pending.tokenCount = (pending.tokenCount || 0) + runTokens; // ej: 0 + 150 = 150

// 3. Siguiente run acumula
pending.tokenCount = (pending.tokenCount || 0) + 200; // ej: 150 + 200 = 350

// 4. BD ACUMULA desde valor actual al ejecutar delayed update
const currentTokens = current?.threadTokenCount || 0; // ej: 500 (BD)
updateData.threadTokenCount = currentTokens + tokenCount; // ej: 500 + 350 = 850
```

#### ✅ CORRECCIÓN IMPLEMENTADA (2025-01-04)
**Problema original**: Los tokens se REEMPLAZABAN en lugar de acumularse
- `DelayedActivityService.updateTokenCount()`: ❌ `pending.tokenCount = tokenCount` 
- `DatabaseService.updateThreadActivity()`: ❌ `threadTokenCount = tokenCount`

**Solución implementada**: Acumulación correcta en ambos niveles
- `DelayedActivityService.updateTokenCount()`: ✅ `pending.tokenCount = (pending.tokenCount || 0) + tokenCount`
- `DatabaseService.updateThreadActivity()`: ✅ `threadTokenCount = currentTokens + tokenCount`

**Resultado**: Cada thread acumula correctamente todos los tokens de sus runs individuales

#### 🎯 OPTIMIZACIÓN DE LABELS (2025-01-04)
**Problema original**: Labels no se actualizaban inmediatamente tras cambios en Whapi

**Solución implementada**: Verificación inteligente en `database.service.ts:getThread()`
- **Ubicación**: `database.service.ts` línea 192-212
- **Momento**: Al consultar thread (antes de procesar mensajes)
- **Lógica**: `shouldEnrichUser()` verifica si faltan labels o hay discrepancias
- **Eficiencia**: Solo hace API call cuando realmente va a procesar, no en cada mensaje

```typescript
// FLUJO OPTIMIZADO:
1. Mensaje llega → webhook (sin API calls)
2. Buffer agrupa → bot.ts consulta thread  
3. getThread() → shouldEnrichUser() → enrichUserFromWhapi()
4. Compara BD vs Whapi → actualiza solo si diferente
5. Usa labels actualizados para contexto
```

**Resultado**: Labels se actualizan automáticamente sin impacto en performance

---

## 🚀 OPTIMIZACIONES IMPLEMENTADAS

1. **🏆 DelayedActivityService**: 1 write BD por conversación (vs N writes antes)
2. **⚡ Sistema Timer**: Memoria temporal + auto-cancelación de timers
3. **🎯 Writes evitados**: Solo actualizar si hay discrepancia real
4. **🧠 Enriquecimiento inteligente**: API calls solo cuando necesario  
5. **📊 Token tracking optimizado**: Memoria → BD junto con lastActivity
6. **🎯 Labels en consulta thread**: Verificación eficiente solo al procesar mensajes
6. **🧵 Thread reutilización**: Evita crear threads innecesarios
7. **📅 CRM batch processing**: Jobs programados, no en tiempo real
8. **🔄 Graceful shutdown**: Auto-flush de updates pendientes

---

## 📍 UBICACIONES EN EL CÓDIGO

### Database & Models
- `prisma/schema.prisma` - Esquema BD actualizado
- `src/core/services/database.service.ts` - Lógicas de actualización
- `src/core/services/thread-persistence.service.ts` - Gestión threads

### CRM System (Hotel-specific)
- `src/core/jobs/crm-analysis.job.ts` - Análisis automático cada 15min
- `src/core/jobs/daily-actions.job.ts` - Seguimientos diarios 9AM
- `src/core/services/simple-crm.service.ts` - Lógica CRM
- `src/core/routes/crm.routes.ts` - API endpoints CRM

### Webhook Processing
- `src/core/api/webhook-processor.ts` - Procesa mensajes Whapi
- `src/core/bot.ts` - Orquestador principal con lógica threads+tokens

---

## 🔧 COMANDOS ÚTILES

### Database Migration
```bash
npx prisma generate
npx prisma db push
```

### Testing CRM
```bash
curl -X POST http://localhost:3010/api/crm/execute-daily-actions
curl -X GET http://localhost:3010/api/crm/status
```

### Monitoring
```bash
curl -X GET http://localhost:3010/health
```

---

## ⚠️ NOTAS IMPORTANTES

1. **threadTokenCount**: Solo registro, NO auto-cleanup (por diseño)
2. **lastActivity**: Delay de 10 minutos implementado (optimización)  
3. **CRM functions**: Ubicadas en carpetas hotel-specific (como solicitado)
4. **Thread reuse**: Validación OpenAI antes de reutilizar
5. **Discrepancy-only updates**: Evita writes innecesarios a BD

---

**🎯 RESULTADO**: Sistema optimizado que mantiene datos actualizados sin writes innecesarios, con tracking completo de tokens y lógica CRM automatizada.