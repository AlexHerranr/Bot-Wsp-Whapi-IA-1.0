# 🗄️ MIGRACIÓN COMPLETA A POSTGRESQL - ETAPA 5

## ✅ Estado Previo Validado
- **Arquitectura modular**: 100% funcional
- **Pruebas unitarias**: 100% exitosas  
- **Pruebas de integración**: 100% exitosas
- **Prueba de humo**: 100% exitosa
- **Sistema**: Completamente operacional

---

# 💾 Plan de Migración a Base de Datos

*Guía práctica para migrar de archivos JSON + memoria a PostgreSQL*

---

## 🎯 **OBJETIVO CLARO**

**Migrar**: Map/Set variables + JSON files → PostgreSQL  
**Tiempo**: 3-4 días (después de división modular)  
**Resultado**: Persistencia real, zero data loss, escalabilidad

---

## 📊 **QUÉ MIGRAR**

### **Datos Actuales en Memoria:**
```typescript
// ESTOS SE PIERDEN AL REINICIAR:
globalMessageBuffers     // ~50-100 usuarios activos
globalUserStates        // Estados por usuario  
contextCache           // Cache contexto (1h TTL)
chatInfoCache         // Info chats (5min TTL)
pendingImages         // Imágenes pendientes
activeProcessing      // Set usuarios procesando
typingLogTimestamps   // Timestamps typing
```

### **Datos Actuales en JSON:**
```json
// threads-data.json (~100-500 threads)
{
  "573001234567": {
    "threadId": "thread_abc123",
    "chatId": "573001234567@s.whatsapp.net", 
    "userName": "Juan Pérez"
  }
}

// guest-memory.json (~100-500 guests)
{
  "573001234567": {
    "name": "Juan Pérez",
    "labels": ["Potencial", "Consulta"],
    "lastInteraction": "2025-01-27"
  }
}
```

---

## 🗄️ **SCHEMA POSTGRESQL**

### **Schema Mínimo para Empezar:**
```sql
-- Usuarios principales
CREATE TABLE users (
    id VARCHAR(20) PRIMARY KEY,        -- Número WhatsApp
    name VARCHAR(255),
    chat_id VARCHAR(100) NOT NULL,
    thread_id VARCHAR(50) UNIQUE,
    labels JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW()
);

-- Threads OpenAI
CREATE TABLE threads (
    id VARCHAR(50) PRIMARY KEY,        -- OpenAI thread ID
    user_id VARCHAR(20) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Cache de contexto (reemplaza contextCache Map)
CREATE TABLE context_cache (
    user_id VARCHAR(20) PRIMARY KEY REFERENCES users(id),
    context_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- Estados de usuario (reemplaza globalUserStates Map)
CREATE TABLE user_states (
    user_id VARCHAR(20) PRIMARY KEY REFERENCES users(id),
    last_voice_input TIMESTAMP,
    preferences JSONB DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Buffers activos (reemplaza globalMessageBuffers Map)
CREATE TABLE message_buffers (
    user_id VARCHAR(20) PRIMARY KEY REFERENCES users(id),
    messages JSONB NOT NULL,           -- Array de mensajes
    first_message_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_users_thread_id ON users(thread_id);
CREATE INDEX idx_context_expires ON context_cache(expires_at);
CREATE INDEX idx_buffers_expires ON message_buffers(expires_at);
```

---

## 🚀 **PLAN DE MIGRACIÓN**

### **DÍA 1: SETUP DATABASE**
```bash
# 1. Crear PostgreSQL en Railway
# Railway Dashboard → Add Service → Database → PostgreSQL
# Copiar DATABASE_URL

# 2. Instalar dependencias
npm install pg @types/pg prisma @prisma/client

# 3. Configurar Prisma
npx prisma init
```

**Crear**: `prisma/schema.prisma`
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id
  name         String?
  chatId       String   @map("chat_id")
  threadId     String?  @unique @map("thread_id")
  labels       Json     @default("[]")
  createdAt    DateTime @default(now()) @map("created_at")
  lastActivity DateTime @default(now()) @map("last_activity")
  
  threads      Thread[]
  contextCache ContextCache?
  userState    UserState?
  messageBuffer MessageBuffer?
  
  @@map("users")
}

model Thread {
  id            String    @id
  userId        String    @map("user_id")
  createdAt     DateTime  @default(now()) @map("created_at")
  lastMessageAt DateTime? @map("last_message_at")
  isActive      Boolean   @default(true) @map("is_active")
  
  user User @relation(fields: [userId], references: [id])
  
  @@map("threads")
}

model ContextCache {
  userId      String   @id @map("user_id")
  contextText String   @map("context_text")
  createdAt   DateTime @default(now()) @map("created_at")
  expiresAt   DateTime @map("expires_at")
  
  user User @relation(fields: [userId], references: [id])
  
  @@map("context_cache")
}

model UserState {
  userId          String    @id @map("user_id")
  lastVoiceInput  DateTime? @map("last_voice_input")
  preferences     Json      @default("{}")
  updatedAt       DateTime  @default(now()) @map("updated_at")
  
  user User @relation(fields: [userId], references: [id])
  
  @@map("user_states")
}

model MessageBuffer {
  userId          String   @id @map("user_id")
  messages        Json     @default("[]")
  firstMessageAt  DateTime @map("first_message_at")
  expiresAt       DateTime @map("expires_at")
  createdAt       DateTime @default(now()) @map("created_at")
  
  user User @relation(fields: [userId], references: [id])
  
  @@map("message_buffers")
}
```

```bash
# Generar cliente y crear tablas
npx prisma generate
npx prisma db push
```

**✅ Checkpoint Día 1**: PostgreSQL conectado, tablas creadas

---

### **DÍA 2: CREAR SERVICIOS DB**

**Crear**: `src/base/utils/database.service.ts`
```typescript
import { PrismaClient } from '@prisma/client';

export class DatabaseService {
  private prisma = new PrismaClient();
  
  // MIGRAR threadPersistence.saveThread()
  async saveThread(userId: string, threadId: string, chatId: string, userName?: string) {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: { 
        threadId,
        name: userName,
        lastActivity: new Date()
      },
      create: {
        id: userId,
        chatId,
        threadId,
        name: userName
      }
    });
    
    await this.prisma.thread.upsert({
      where: { id: threadId },
      update: { lastMessageAt: new Date() },
      create: {
        id: threadId,
        userId,
        lastMessageAt: new Date()
      }
    });
  }
  
  // MIGRAR threadPersistence.getThread()
  async getThread(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { threads: { where: { isActive: true }, take: 1 } }
    });
    return user?.threads[0]?.id;
  }
  
  // MIGRAR contextCache.set()
  async saveContext(userId: string, contextText: string, ttlMs: number = 3600000) {
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.prisma.contextCache.upsert({
      where: { userId },
      update: { contextText, expiresAt, createdAt: new Date() },
      create: { userId, contextText, expiresAt }
    });
  }
  
  // MIGRAR contextCache.get()
  async getContext(userId: string): Promise<string | null> {
    const cache = await this.prisma.contextCache.findUnique({
      where: { 
        userId,
        expiresAt: { gt: new Date() }
      }
    });
    return cache?.contextText || null;
  }
  
  // MIGRAR globalUserStates.set()
  async saveUserState(userId: string, state: any) {
    await this.prisma.userState.upsert({
      where: { userId },
      update: { 
        lastVoiceInput: state.lastVoiceInput,
        preferences: state.preferences || {},
        updatedAt: new Date()
      },
      create: {
        userId,
        lastVoiceInput: state.lastVoiceInput,
        preferences: state.preferences || {}
      }
    });
  }
  
  // MIGRAR globalUserStates.get()
  async getUserState(userId: string) {
    return this.prisma.userState.findUnique({
      where: { userId }
    });
  }
  
  // MIGRAR globalMessageBuffers.set()
  async saveMessageBuffer(userId: string, messages: any[], expiresAt: Date) {
    await this.prisma.messageBuffer.upsert({
      where: { userId },
      update: { 
        messages: messages as any,
        firstMessageAt: new Date(),
        expiresAt
      },
      create: {
        userId,
        messages: messages as any,
        firstMessageAt: new Date(),
        expiresAt
      }
    });
  }
  
  // MIGRAR globalMessageBuffers.get()
  async getMessageBuffer(userId: string) {
    const buffer = await this.prisma.messageBuffer.findUnique({
      where: { 
        userId,
        expiresAt: { gt: new Date() }
      }
    });
    return buffer?.messages as any[];
  }
  
  // Cleanup automático
  async cleanup() {
    const now = new Date();
    await this.prisma.contextCache.deleteMany({
      where: { expiresAt: { lt: now } }
    });
    await this.prisma.messageBuffer.deleteMany({
      where: { expiresAt: { lt: now } }
    });
  }
}

export const dbService = new DatabaseService();
```

**✅ Checkpoint Día 2**: Servicios DB creados, métodos implementados

---

### **DÍA 3: MIGRAR CÓDIGO**

**Actualizar**: `src/base/utils/persistence/index.ts`
```typescript
import { dbService } from '../database.service.js';

// REEMPLAZAR threadPersistence
export const threadPersistence = {
  async saveThread(userId: string, threadId: string, chatId: string, userName?: string) {
    return dbService.saveThread(userId, threadId, chatId, userName);
  },
  
  async getThread(userId: string) {
    return dbService.getThread(userId);
  },
  
  // Mantener métodos existentes para compatibilidad
  async loadAllThreads() {
    // Implementation if needed
  }
};

// REEMPLAZAR contextCache Map
export const contextCache = {
  async set(userId: string, context: string, ttl?: number) {
    return dbService.saveContext(userId, context, ttl);
  },
  
  async get(userId: string) {
    return dbService.getContext(userId);
  },
  
  async delete(userId: string) {
    // Implementation if needed
  }
};
```

**Actualizar**: En `app-unified.ts` (o módulos ya divididos)
```typescript
// REEMPLAZAR:
// const globalUserStates = new Map<string, UserState>();
// POR:
const globalUserStates = {
  async set(userId: string, state: any) {
    return dbService.saveUserState(userId, state);
  },
  
  async get(userId: string) {
    return dbService.getUserState(userId);
  }
};

// REEMPLAZAR:
// const globalMessageBuffers = new Map<string, any>();
// POR:
const globalMessageBuffers = {
  async set(userId: string, messages: any[], expiresAt: Date) {
    return dbService.saveMessageBuffer(userId, messages, expiresAt);
  },
  
  async get(userId: string) {
    return dbService.getMessageBuffer(userId);
  }
};
```

**✅ Checkpoint Día 3**: Código migrado, usando DB en lugar de Maps

---

### **DÍA 4: TESTING Y DEPLOY**

```bash
# 1. Testing local
npm run dev

# Verificar:
# - Bot responde a mensajes
# - Threads se guardan en DB
# - Context persiste entre mensajes
# - Buffers funcionan
# - No hay memory leaks

# 2. Migrar datos existentes (si hay)
# Script para migrar threads-data.json a PostgreSQL
node scripts/migrate-existing-data.js

# 3. Deploy a producción
git add .
git commit -m "feat: migrate to PostgreSQL"
git push

# 4. Verificar en Railway
# - DB tiene datos
# - Bot funciona
# - No hay errores
```

**Crear**: `scripts/migrate-existing-data.js`
```javascript
// Script para migrar datos existentes de JSON a DB
const fs = require('fs');
const { dbService } = require('../dist/base/utils/database.service.js');

async function migrateData() {
  try {
    // Migrar threads
    if (fs.existsSync('threads-data.json')) {
      const threads = JSON.parse(fs.readFileSync('threads-data.json'));
      for (const [userId, data] of Object.entries(threads)) {
        await dbService.saveThread(userId, data.threadId, data.chatId, data.userName);
      }
      console.log('Threads migrated successfully');
    }
    
    // Migrar guest memory
    if (fs.existsSync('guest-memory.json')) {
      const guests = JSON.parse(fs.readFileSync('guest-memory.json'));
      for (const [userId, data] of Object.entries(guests)) {
        await dbService.saveUserState(userId, data);
      }
      console.log('Guest memory migrated successfully');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrateData();
```

**✅ Checkpoint Final**: DB en producción, datos migrados, sistema funcionando

---

## 📊 **VALIDACIÓN DE ÉXITO**

### **Funcionalidad:**
- [ ] Bot responde a mensajes normalmente
- [ ] Threads persisten entre restarts
- [ ] Context cache funciona
- [ ] Buffers de mensajes funcionan
- [ ] No hay pérdida de datos

### **Performance:**
- [ ] Queries < 100ms promedio
- [ ] Memory usage estable
- [ ] No degradación respuesta
- [ ] Cleanup automático funciona

### **Datos:**
- [ ] Zero data loss en migración
- [ ] Backup de datos anterior
- [ ] Rollback funcional si es necesario

---

## 🆘 **PLAN DE ROLLBACK**

Si algo falla:
```bash
# 1. Rollback inmediato
git revert [commit-hash]
npm run deploy

# 2. Restaurar archivos JSON
cp backups/threads-data.json ./
cp backups/guest-memory.json ./

# 3. Volver a Maps en memoria
# Comentar código DB, descomentar Maps originales
```

**Criterio de rollback**: Si data loss > 0 o downtime > 10 minutos

---

**Esta migración debe hacerse DESPUÉS de la división modular para reducir riesgos.**