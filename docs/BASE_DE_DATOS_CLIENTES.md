# 📊 BASE DE DATOS CLIENTES - GUÍA COMPLETA

## 🎯 OVERVIEW DEL SISTEMA

El **ClientView** es una vista unificada que consolida todos los metadatos de clientes de WhatsApp en una sola tabla SQL, organizados por prioridad visual y optimizada para CRM.

---

## 🏗️ ARQUITECTURA ACTUAL

### **Base de Datos**: SQLite + Prisma ORM
```bash
📁 prisma/
  └── schema.prisma    # Esquema principal
📁 scripts/
  └── *.ts            # Scripts de gestión de datos
```

### **Visualización**: Prisma Studio
```bash
# Abrir interfaz web de la base de datos
npx prisma studio
# Acceso: http://localhost:5555
```

---

## 📋 ESTRUCTURA ClientView

### **🔥 PRIORIDAD VISUAL 1: IDENTIFICACIÓN BÁSICA**
```sql
phoneNumber    String @id     -- FUENTE: webhook message.from | ACTUALIZA: Cada mensaje
name           String?        -- FUENTE: WHAPI getChatInfo().name | ACTUALIZA: syncWhapiLabels()
userName       String?        -- FUENTE: threads.json.userName | ACTUALIZA: Al crear thread
```

### **🔥 PRIORIDAD VISUAL 2: CRM - LO MÁS IMPORTANTE**
```sql
perfilStatus   String?        -- FUENTE: Calculado por bot IA | ACTUALIZA: Cada interacción
proximaAccion  String?        -- FUENTE: Calculado por bot IA | ACTUALIZA: Cada interacción  
prioridad      String         -- FUENTE: Calculado (ALTA/MEDIA/BAJA) | ACTUALIZA: Cada interacción
```

### **🔥 PRIORIDAD VISUAL 3: ETIQUETAS**
```sql
label1         String?        -- FUENTE: WHAPI getChatInfo().labels[0] | ACTUALIZA: syncWhapiLabels()
label2         String?        -- FUENTE: WHAPI getChatInfo().labels[1] | ACTUALIZA: syncWhapiLabels()
label3         String?        -- FUENTE: WHAPI getChatInfo().labels[2] | ACTUALIZA: syncWhapiLabels()
```

### **🔥 PRIORIDAD VISUAL 4: CONTACTO**
```sql
chatId         String?        -- FUENTE: threads.json.chatId | ACTUALIZA: Al crear thread
```

### **🔥 PRIORIDAD VISUAL 5: ACTIVIDAD RECIENTE**
```sql
lastMessageRole String?       -- FUENTE: Prisma message.role | ACTUALIZA: Cada mensaje
lastMessageAt   DateTime?     -- FUENTE: Prisma message.createdAt | ACTUALIZA: Cada mensaje
lastActivity    DateTime      -- FUENTE: threads.json.lastActivity | ACTUALIZA: Cada interacción (@updatedAt)
```

### **🔥 PRIORIDAD VISUAL 6: THREAD TÉCNICO**
```sql
threadId       String?        -- FUENTE: OpenAI threads.json.threadId | ACTUALIZA: Al crear/cambiar thread
```

---

## 🔄 FLUJO DE DATOS COMPLETO

### **1. WEBHOOK RECEPCIONARIO** (`webhook-processor.ts`)
```typescript
// Webhook WHAPI recibe mensaje
webhook: {
  message: {
    from: "573003913251",           // → phoneNumber
    from_name: "Sr Alex",           // → userName (inicial)  
    chat_id: "573003913251@s.whatsapp.net", // → chatId
    text: { body: "Hola" }
  }
}
```

### **2. PROCESAMIENTO CORE** (`bot.ts:86-129`)
```typescript
// Buffer → Procesamiento → Base de datos
processBufferCallback() {
  // Crear/actualizar usuario
  await databaseService.getOrCreateUser(userId, userName);
  
  // Crear/obtener thread
  thread = await databaseService.getThread(userId);
  
  // Guardar mensajes (user + assistant)
  await databaseService.saveMessage(threadId, 'user', content);
  await databaseService.saveMessage(threadId, 'assistant', response);
}
```

### **3. ENRICHMENT DE METADATA** (`syncWhapiLabels()`)
```typescript
// Solo para threads antiguos (evitar sobrecarga API)
const chatInfo = await whapiLabels.getChatInfo(chatId);
// Obtiene: name, labels[], isContact, etc.
```

---

## ⚡ FRECUENCIAS DE ACTUALIZACIÓN

### **🟢 TIEMPO REAL (Webhook-driven)**
- `phoneNumber`, `lastMessageRole`, `lastMessageAt`, `lastActivity`
- **Frecuencia**: Cada mensaje recibido
- **Sobrecarga**: ❌ No genera llamadas API adicionales

### **🟡 CREACIÓN DE THREADS**
- `chatId`, `userName`, `threadId`
- **Frecuencia**: Solo al crear nuevos threads
- **Sobrecarga**: ❌ No genera llamadas API adicionales

### **🟠 PROCESAMIENTO IA**
- `perfilStatus`, `proximaAccion`, `prioridad`
- **Frecuencia**: Durante interacciones del bot
- **Sobrecarga**: ❌ Usa threads existentes de OpenAI

### **🔴 ENRIQUECIMIENTO BATCH** (Evita sobrecarga)
- `name`, `label1`, `label2`, `label3`
- **Frecuencia**: Solo threads antiguos sin metadata
- **API Calls**: `GET /chats/{chatId}` - máximo 1 por thread
- **Límite**: Procesamiento controlado para evitar rate limiting

---

## 🖥️ COMANDOS PRISMA - TERMINAL

### **Visualización Web**
```bash
npx prisma studio
# Abre http://localhost:5555 - interfaz gráfica completa
```

### **Consultas desde Terminal**
```bash
# Ver todos los clientes
npx prisma db seed --preview-feature

# Estadísticas rápidas
npx ts-node scripts/check-db.ts

# Ver datos específicos
npx ts-node scripts/client-unified-view.ts
```

### **Gestión del Schema**
```bash
# Aplicar cambios al schema
npx prisma generate
npx prisma db push

# Resetear BD (CUIDADO - borra datos)
npx prisma db push --force-reset --accept-data-loss
```

### **Migración de Datos**
```bash
# Migrar datos desde JSON a SQL
npx ts-node scripts/migrate-data.ts

# Poblar con datos de prueba
npx ts-node scripts/populate-organized-client-view.ts
```

---

## 🚀 PREVENCIÓN DE SOBRECARGA API

### **❌ ANTIPATRÓN - Llamar API en cada mensaje**
```typescript
// MAL - sobrecarga WHAPI
messages.forEach(async msg => {
  const info = await whapiApi.getChatInfo(msg.chat_id); // 😱 Rate limit!
});
```

### **✅ PATRÓN ÓPTIMO - Enriquecimiento controlado**
```typescript
// BIEN - solo threads sin metadata
const threadsWithoutMetadata = await getThreadsNeedingEnrichment();
for (const thread of threadsWithoutMetadata) {
  const info = await whapiApi.getChatInfo(thread.chatId);
  await updateThreadMetadata(thread.id, info);
  await sleep(1000); // Rate limiting respetuoso
}
```

### **Estrategia Anti-sobrecarga**
1. **Cache local**: Metadata se guarda en BD, no se re-consulta
2. **Batch processing**: Solo threads antiguos sin metadata
3. **Rate limiting**: Delays entre llamadas API
4. **Priorización**: Datos críticos en tiempo real, complementarios en batch

---

## 📊 MONITORING Y ESTADÍSTICAS

### **Script de Verificación**
```bash
npx ts-node scripts/check-db.ts
```

**Output esperado**:
```
📊 Base de Datos - Estado Actual:
├─ 👥 Usuarios: 12 activos
├─ 💬 Threads: 8 conversaciones
├─ 📝 Mensajes: 47 total
├─ 🏷️ Con etiquetas: 5 clientes
├─ 🔄 Última actividad: hace 2 minutos
└─ ✅ Estado: Saludable
```

---

## 🎯 CASOS DE USO PRINCIPALES

### **1. Ver Todos los Clientes**
```bash
npx prisma studio
# Ir a: ClientView table → Ver todos los registros
```

### **2. Buscar Cliente Específico**
```sql
-- En Prisma Studio o DB client
SELECT * FROM ClientView WHERE phoneNumber = '573003913251';
```

### **3. Clientes por Prioridad**
```sql
SELECT phoneNumber, name, perfilStatus, prioridad 
FROM ClientView 
WHERE prioridad = 'ALTA' 
ORDER BY lastActivity DESC;
```

### **4. Análisis de Etiquetas**
```sql
SELECT label1, COUNT(*) as cantidad
FROM ClientView 
WHERE label1 IS NOT NULL
GROUP BY label1;
```

---

## 🔧 TROUBLESHOOTING

### **Error: No se ven los datos**
```bash
# 1. Verificar conexión
npx prisma db push

# 2. Regenerar cliente
npx prisma generate

# 3. Verificar datos
npx ts-node scripts/check-db.ts
```

### **Error: Schema conflicts**
```bash
# Reset completo (BORRA DATOS)
npx prisma db push --force-reset --accept-data-loss
npx ts-node scripts/populate-organized-client-view.ts
```

### **Error: Puerto 5555 ocupado**
```bash
# Cambiar puerto
npx prisma studio --port 5556
```

---

## 📈 PRÓXIMOS PASOS

### **Migración a PostgreSQL**
1. Instalar PostgreSQL server
2. Actualizar `DATABASE_URL` en `.env`
3. Cambiar provider en `prisma/schema.prisma`
4. Ejecutar `npx prisma migrate dev`

### **Automatización Completa**
- Sincronización automática de metadata
- Dashboard web integrado
- Exportación a Google Sheets
- Alertas de clientes de alta prioridad

---

## 🚀 PRÓXIMA ACTUALIZACIÓN: MIGRACIÓN A POSTGRESQL

### **📍 Estado Actual (Desarrollo)**
- **Base de datos**: SQLite local (`prisma/tealquilamos_bot.db`)
- **Entorno**: Desarrollo y pruebas locales
- **Limitaciones**: No persiste en Railway, no soporta N8N simultáneo

### **🎯 Próxima Migración Planificada**
**CUANDO**: Después de probar que el bot despliega correctamente en Railway con todas sus características

**MIGRACIÓN A**:
- **PostgreSQL en Railway** ($5/mes)
- **Persistencia garantizada** en despliegues
- **Soporte para integraciones externas** (N8N, dashboards)
- **Conexiones simultáneas** sin limitaciones

### **🔄 Plan de Migración PostgreSQL**
1. **Validar despliegue completo** del bot en Railway
2. **Crear base de datos PostgreSQL** en Railway
3. **Actualizar schema.prisma**:
   ```prisma
   datasource db {
     provider = "postgresql"  // Cambiar de "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
4. **Migrar datos existentes** con scripts automatizados
5. **Configurar variables de entorno** para producción vs desarrollo
6. **Habilitar integraciones N8N** y flujos externos

### **💡 Beneficios Post-Migración**
- ✅ **Persistencia real** en Railway (no se borra en despliegues)
- ✅ **Integraciones N8N** sin conflictos de conexión
- ✅ **Escalabilidad** para múltiples usuarios simultáneos
- ✅ **Respaldos automáticos** y recuperación de datos
- ✅ **Dashboard web** con acceso concurrente
- ✅ **APIs externas** pueden conectarse sin limitaciones

---

*📅 Actualizado: ${new Date().toISOString()}*  
*🔄 Estado: Sistema SQLite funcional - PostgreSQL planificado post-validación Railway*