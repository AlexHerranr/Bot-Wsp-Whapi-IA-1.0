# 🗄️ Plan de Implementación PostgreSQL

## 📋 Resumen

Plan completo para migrar de archivos JSON a PostgreSQL en Railway, incluyendo cache de contexto temporal y base para futuras funcionalidades de marketing.

## 🎯 Objetivos

### **Inmediatos:**
- ✅ Migrar cache de contexto temporal a PostgreSQL
- ✅ Persistencia de datos en Railway (no se pierden al reiniciar)
- ✅ Unificar todos los datos de huéspedes en una base de datos

### **Futuros:**
- 📊 Base de datos de clientes históricos para marketing
- 📈 Análisis avanzado de interacciones
- 🎯 Campañas de re-engagement
- 📋 Reportes de conversión

## 🚀 Fases de Implementación

### **Fase 1: Configuración Inicial (1-2 días)**

#### **1.1 Configurar PostgreSQL en Railway**
```bash
# En Railway Dashboard:
1. Ir a tu proyecto Bot-Wsp-Whapi-IA
2. Add Service → Database → PostgreSQL
3. Copiar DATABASE_URL del servicio creado
4. Agregar como variable de entorno en el bot
```

#### **1.2 Instalar Dependencias**
```bash
npm install pg @types/pg
```

#### **1.3 Crear Estructura de Base de Datos**
```sql
-- Tabla principal de huéspedes activos
CREATE TABLE guest_profiles (
    phone_number TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    thread_id TEXT,
    user_name TEXT,
    contact_name TEXT,
    labels JSONB, -- Array de etiquetas
    first_interaction TIMESTAMP,
    last_interaction TIMESTAMP,
    last_context_update TIMESTAMP,
    context_cache TEXT,
    profile_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para clientes históricos (marketing futuro)
CREATE TABLE historical_clients (
    id SERIAL PRIMARY KEY,
    phone_number TEXT UNIQUE,
    user_name TEXT,
    contact_name TEXT,
    labels JSONB,
    total_interactions INTEGER DEFAULT 0,
    last_interaction TIMESTAMP,
    booking_status TEXT, -- 'booked', 'interested', 'inactive'
    marketing_consent BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_guest_profiles_last_activity ON guest_profiles(last_interaction);
CREATE INDEX idx_guest_profiles_labels ON guest_profiles USING GIN(labels);
CREATE INDEX idx_historical_clients_phone ON historical_clients(phone_number);
CREATE INDEX idx_historical_clients_status ON historical_clients(booking_status);
```

### **Fase 2: Implementación del Código (2-3 días)**

#### **2.1 Crear Clase de Base de Datos**
```typescript
// src/utils/database/GuestDatabase.ts
import { Pool } from 'pg';
import { enhancedLog } from '../core/index.js';

export class GuestDatabase {
    private pool: Pool;
    
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
    }
    
    // Obtener contexto con cache
    async getContext(userId: string): Promise<string> {
        try {
            const result = await this.pool.query(
                `SELECT context_cache, last_context_update 
                 FROM guest_profiles 
                 WHERE phone_number = $1`,
                [userId]
            );
            
            if (result.rows[0] && this.isContextValid(result.rows[0].last_context_update)) {
                enhancedLog('info', 'CONTEXT_CACHE_HIT', 'Contexto desde PostgreSQL', {
                    userId,
                    cacheAge: this.getCacheAge(result.rows[0].last_context_update)
                });
                return result.rows[0].context_cache;
            }
            
            // Generar nuevo contexto
            const context = await this.generateContext(userId);
            await this.updateContext(userId, context);
            return context;
            
        } catch (error) {
            enhancedLog('error', 'DATABASE_ERROR', 'Error obteniendo contexto', {
                userId,
                error: error.message
            });
            return '';
        }
    }
    
    // Actualizar perfil
    async updateProfile(userId: string, data: any): Promise<void> {
        try {
            await this.pool.query(
                `INSERT INTO guest_profiles (phone_number, chat_id, user_name, labels, profile_data, updated_at)
                 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                 ON CONFLICT (phone_number) 
                 DO UPDATE SET 
                    user_name = EXCLUDED.user_name,
                    labels = EXCLUDED.labels,
                    profile_data = EXCLUDED.profile_data,
                    updated_at = CURRENT_TIMESTAMP`,
                [userId, data.chatId, data.userName, JSON.stringify(data.labels), JSON.stringify(data.profileData)]
            );
            
            enhancedLog('info', 'DATABASE_UPDATE', 'Perfil actualizado en PostgreSQL', {
                userId,
                hasLabels: !!data.labels?.length
            });
            
        } catch (error) {
            enhancedLog('error', 'DATABASE_ERROR', 'Error actualizando perfil', {
                userId,
                error: error.message
            });
        }
    }
    
    // Verificar si el contexto es válido (5 minutos TTL)
    private isContextValid(lastUpdate: string): boolean {
        const lastUpdateTime = new Date(lastUpdate).getTime();
        const now = Date.now();
        const TTL = 5 * 60 * 1000; // 5 minutos
        return (now - lastUpdateTime) < TTL;
    }
    
    // Obtener edad del cache en segundos
    private getCacheAge(lastUpdate: string): number {
        const lastUpdateTime = new Date(lastUpdate).getTime();
        const now = Date.now();
        return Math.round((now - lastUpdateTime) / 1000);
    }
    
    // Generar nuevo contexto (migrar lógica actual)
    private async generateContext(userId: string): Promise<string> {
        // Migrar lógica de getRelevantContext aquí
        // Obtener perfil, chat info, generar contexto corto
        return '[Contexto generado]';
    }
    
    // Actualizar contexto en base de datos
    private async updateContext(userId: string, context: string): Promise<void> {
        await this.pool.query(
            `UPDATE guest_profiles 
             SET context_cache = $1, last_context_update = CURRENT_TIMESTAMP
             WHERE phone_number = $2`,
            [context, userId]
        );
    }
}
```

#### **2.2 Migrar Código Actual**
```typescript
// src/app-unified.ts - Modificar getRelevantContext
import { GuestDatabase } from './utils/database/GuestDatabase.js';

// Inicializar base de datos
const guestDatabase = new GuestDatabase();

// Reemplazar función actual
async function getRelevantContext(userId: string, requestId?: string): Promise<string> {
    return await guestDatabase.getContext(userId);
}
```

### **Fase 3: Migración de Datos (1 día)**

#### **3.1 Script de Migración**
```typescript
// scripts/migrate-to-postgresql.ts
import { GuestDatabase } from '../src/utils/database/GuestDatabase.js';
import * as fs from 'fs';
import * as path from 'path';

async function migrateData() {
    const db = new GuestDatabase();
    
    // Migrar threads.json
    const threadsPath = path.join(process.cwd(), 'tmp', 'threads.json');
    if (fs.existsSync(threadsPath)) {
        const threads = JSON.parse(fs.readFileSync(threadsPath, 'utf-8'));
        
        for (const [userId, threadData] of Object.entries(threads)) {
            await db.updateProfile(userId, {
                chatId: threadData.chatId,
                userName: threadData.userName,
                labels: threadData.labels || [],
                profileData: threadData
            });
        }
    }
    
    // Migrar guest_profiles.json
    const profilesPath = path.join(process.cwd(), 'tmp', 'guest_profiles.json');
    if (fs.existsSync(profilesPath)) {
        const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
        
        for (const [userId, profileData] of Object.entries(profiles)) {
            await db.updateProfile(userId, {
                chatId: `${userId}@s.whatsapp.net`,
                userName: profileData.name,
                labels: profileData.whapiLabels?.map((l: any) => l.name) || [],
                profileData: profileData
            });
        }
    }
}

migrateData().then(() => {
    console.log('✅ Migración completada');
    process.exit(0);
}).catch(error => {
    console.error('❌ Error en migración:', error);
    process.exit(1);
});
```

### **Fase 4: Testing y Optimización (1 día)**

#### **4.1 Tests de Funcionalidad**
```typescript
// tests/database/test-guest-database.ts
import { GuestDatabase } from '../../src/utils/database/GuestDatabase.js';

async function testDatabase() {
    const db = new GuestDatabase();
    
    // Test 1: Obtener contexto
    const context1 = await db.getContext('573003913251');
    console.log('Contexto 1:', context1);
    
    // Test 2: Cache hit
    const context2 = await db.getContext('573003913251');
    console.log('Contexto 2 (cache):', context2);
    
    // Test 3: Actualizar perfil
    await db.updateProfile('573003913251', {
        chatId: '573003913251@s.whatsapp.net',
        userName: 'Alexander Test',
        labels: ['Test Label'],
        profileData: { name: 'Alexander Test' }
    });
}

testDatabase();
```

#### **4.2 Métricas de Performance**
```sql
-- Consultas para monitorear performance
SELECT 
    COUNT(*) as total_profiles,
    AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_interaction))) as avg_inactivity_seconds
FROM guest_profiles;

-- Cache hit rate
SELECT 
    COUNT(*) as total_requests,
    COUNT(CASE WHEN last_context_update > CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN 1 END) as cache_hits
FROM guest_profiles;
```

## 🎯 Funcionalidades Futuras (Marketing)

### **1. Clientes Históricos**
```sql
-- Mover clientes inactivos a tabla histórica
INSERT INTO historical_clients (phone_number, user_name, labels, booking_status)
SELECT phone_number, user_name, labels, 'inactive'
FROM guest_profiles 
WHERE last_interaction < NOW() - INTERVAL '30 days';
```

### **2. Análisis de Marketing**
```sql
-- Clientes interesados en cotizaciones
SELECT phone_number, user_name, labels
FROM historical_clients 
WHERE labels @> '["cotización"]'::jsonb 
AND booking_status = 'interested';

-- Clientes que reservaron
SELECT phone_number, user_name, total_interactions
FROM historical_clients 
WHERE booking_status = 'booked'
ORDER BY total_interactions DESC;
```

### **3. Campañas de Re-engagement**
```sql
-- Clientes para re-engagement
SELECT phone_number, user_name, last_interaction
FROM historical_clients 
WHERE last_interaction < NOW() - INTERVAL '90 days'
AND marketing_consent = true;
```

## 📊 Beneficios Esperados

### **Inmediatos:**
- ✅ **Datos persistentes** (nunca se pierden en Railway)
- ✅ **Cache eficiente** (consultas SQL rápidas)
- ✅ **Unificación** (un solo lugar para todos los datos)
- ✅ **Backup automático** (Railway lo maneja)

### **Futuros:**
- 📊 **Análisis avanzado** (SQL completo)
- 🎯 **Marketing automatizado** (campañas basadas en datos)
- 📈 **Métricas de conversión** (booking rate, etc.)
- 🔄 **Re-engagement** (clientes inactivos)

## 🚨 Consideraciones Importantes

### **1. Variables de Entorno**
```bash
# Agregar en Railway
DATABASE_URL=postgresql://user:password@host:port/database
```

### **2. Backup de Datos Actuales**
```bash
# Antes de migrar, hacer backup
cp tmp/threads.json tmp/threads.json.backup
cp tmp/guest_profiles.json tmp/guest_profiles.json.backup
```

### **3. Rollback Plan**
- Mantener archivos JSON como fallback
- Script de rollback a JSON si hay problemas
- Testing exhaustivo antes de deploy

## 📝 Checklist de Implementación

### **Día 1:**
- [ ] Configurar PostgreSQL en Railway
- [ ] Instalar dependencias pg
- [ ] Crear tablas en PostgreSQL
- [ ] Crear clase GuestDatabase básica

### **Día 2:**
- [ ] Implementar métodos de cache
- [ ] Migrar lógica de contexto
- [ ] Crear script de migración
- [ ] Testing básico

### **Día 3:**
- [ ] Migrar datos existentes
- [ ] Testing completo
- [ ] Deploy a Railway
- [ ] Monitoreo inicial

### **Día 4:**
- [ ] Optimización de performance
- [ ] Métricas y monitoreo
- [ ] Documentación final
- [ ] Limpieza de archivos JSON

## 🔗 Archivos a Crear/Modificar

### **Nuevos Archivos:**
- `src/utils/database/GuestDatabase.ts`
- `scripts/migrate-to-postgresql.ts`
- `tests/database/test-guest-database.ts`

### **Archivos a Modificar:**
- `src/app-unified.ts` (getRelevantContext)
- `package.json` (dependencias)
- `railway.toml` (variables de entorno)

### **Archivos a Eliminar (después de migración):**
- `tmp/threads.json`
- `tmp/guest_profiles.json`
- Cache en memoria de contexto temporal 