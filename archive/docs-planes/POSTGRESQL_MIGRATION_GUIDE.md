# 🚀 Guía de Migración a PostgreSQL

## 📋 Resumen

Guía paso a paso para migrar de archivos JSON a PostgreSQL en Railway, manteniendo toda la funcionalidad actual y preparando para futuras funcionalidades de marketing.

## 🎯 Objetivos de la Migración

### **Problemas Actuales:**
- ❌ Datos se pierden en cada reinicio de Railway
- ❌ Cache en memoria no persiste
- ❌ Archivos JSON separados (threads.json, guest_profiles.json)
- ❌ No hay análisis de datos históricos

### **Soluciones con PostgreSQL:**
- ✅ Datos persistentes (nunca se pierden)
- ✅ Cache eficiente con TTL
- ✅ Base de datos unificada
- ✅ Análisis SQL completo
- ✅ Base para marketing futuro

## 🛠️ Paso 1: Configurar PostgreSQL en Railway

### **1.1 Crear Base de Datos**
```bash
# En Railway Dashboard:
1. Ir a tu proyecto Bot-Wsp-Whapi-IA
2. Click en "Add Service"
3. Seleccionar "Database" → "PostgreSQL"
4. Esperar a que se cree el servicio
```

### **1.2 Obtener DATABASE_URL**
```bash
# En el servicio PostgreSQL creado:
1. Click en "Connect"
2. Copiar "Postgres Connection URL"
3. Formato: postgresql://user:password@host:port/database
```

### **1.3 Configurar Variable de Entorno**
```bash
# En el servicio del bot:
1. Ir a "Variables" tab
2. Agregar nueva variable:
   - Name: DATABASE_URL
   - Value: [pegar la URL copiada]
3. Click "Add"
```

## 📦 Paso 2: Instalar Dependencias

### **2.1 Instalar pg**
```bash
npm install pg @types/pg
```

### **2.2 Verificar package.json**
```json
{
  "dependencies": {
    "pg": "^8.11.3",
    "@types/pg": "^8.10.9"
  }
}
```

## 🗄️ Paso 3: Crear Estructura de Base de Datos

### **3.1 Script de Creación de Tablas**
```sql
-- Crear tabla principal de huéspedes
CREATE TABLE guest_profiles (
    phone_number TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    thread_id TEXT,
    user_name TEXT,
    contact_name TEXT,
    labels JSONB,
    first_interaction TIMESTAMP,
    last_interaction TIMESTAMP,
    last_context_update TIMESTAMP,
    context_cache TEXT,
    profile_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla para clientes históricos (marketing futuro)
CREATE TABLE historical_clients (
    id SERIAL PRIMARY KEY,
    phone_number TEXT UNIQUE,
    user_name TEXT,
    contact_name TEXT,
    labels JSONB,
    total_interactions INTEGER DEFAULT 0,
    last_interaction TIMESTAMP,
    booking_status TEXT,
    marketing_consent BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP
);

-- Crear índices para performance
CREATE INDEX idx_guest_profiles_last_activity ON guest_profiles(last_interaction);
CREATE INDEX idx_guest_profiles_labels ON guest_profiles USING GIN(labels);
CREATE INDEX idx_historical_clients_phone ON historical_clients(phone_number);
CREATE INDEX idx_historical_clients_status ON historical_clients(booking_status);
```

### **3.2 Ejecutar Script**
```bash
# Conectar a PostgreSQL y ejecutar:
psql [DATABASE_URL] -f create_tables.sql
```

## 🔧 Paso 4: Crear Clase de Base de Datos

### **4.1 Crear archivo GuestDatabase.ts**
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
        // TODO: Migrar lógica de getRelevantContext aquí
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

## 🔄 Paso 5: Migrar Código Actual

### **5.1 Modificar app-unified.ts**
```typescript
// src/app-unified.ts
import { GuestDatabase } from './utils/database/GuestDatabase.js';

// Inicializar base de datos (al inicio del archivo)
const guestDatabase = new GuestDatabase();

// Reemplazar función getRelevantContext
async function getRelevantContext(userId: string, requestId?: string): Promise<string> {
    return await guestDatabase.getContext(userId);
}
```

### **5.2 Eliminar Cache en Memoria**
```typescript
// Eliminar estas líneas de app-unified.ts:
// const contextCache = new Map<string, { context: string, timestamp: number }>();
// const CONTEXT_CACHE_TTL = 5 * 60 * 1000;
```

## 📊 Paso 6: Script de Migración de Datos

### **6.1 Crear Script de Migración**
```typescript
// scripts/migrate-to-postgresql.ts
import { GuestDatabase } from '../src/utils/database/GuestDatabase.js';
import * as fs from 'fs';
import * as path from 'path';

async function migrateData() {
    console.log('🚀 Iniciando migración a PostgreSQL...');
    
    const db = new GuestDatabase();
    
    // Migrar threads.json
    const threadsPath = path.join(process.cwd(), 'tmp', 'threads.json');
    if (fs.existsSync(threadsPath)) {
        console.log('📁 Migrando threads.json...');
        const threads = JSON.parse(fs.readFileSync(threadsPath, 'utf-8'));
        
        for (const [userId, threadData] of Object.entries(threads)) {
            await db.updateProfile(userId, {
                chatId: threadData.chatId,
                userName: threadData.userName,
                labels: threadData.labels || [],
                profileData: threadData
            });
        }
        console.log(`✅ Migrados ${Object.keys(threads).length} threads`);
    }
    
    // Migrar guest_profiles.json
    const profilesPath = path.join(process.cwd(), 'tmp', 'guest_profiles.json');
    if (fs.existsSync(profilesPath)) {
        console.log('📁 Migrando guest_profiles.json...');
        const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
        
        for (const [userId, profileData] of Object.entries(profiles)) {
            await db.updateProfile(userId, {
                chatId: `${userId}@s.whatsapp.net`,
                userName: profileData.name,
                labels: profileData.whapiLabels?.map((l: any) => l.name) || [],
                profileData: profileData
            });
        }
        console.log(`✅ Migrados ${Object.keys(profiles).length} perfiles`);
    }
    
    console.log('🎉 Migración completada exitosamente');
}

migrateData().then(() => {
    console.log('✅ Proceso finalizado');
    process.exit(0);
}).catch(error => {
    console.error('❌ Error en migración:', error);
    process.exit(1);
});
```

### **6.2 Ejecutar Migración**
```bash
# Compilar TypeScript
npx tsc scripts/migrate-to-postgresql.ts

# Ejecutar migración
node scripts/migrate-to-postgresql.js
```

## 🧪 Paso 7: Testing

### **7.1 Test Básico**
```typescript
// tests/database/test-guest-database.ts
import { GuestDatabase } from '../../src/utils/database/GuestDatabase.js';

async function testDatabase() {
    console.log('🧪 Iniciando tests de base de datos...');
    
    const db = new GuestDatabase();
    
    // Test 1: Obtener contexto
    console.log('Test 1: Obtener contexto...');
    const context1 = await db.getContext('573003913251');
    console.log('Contexto 1:', context1);
    
    // Test 2: Cache hit
    console.log('Test 2: Verificar cache...');
    const context2 = await db.getContext('573003913251');
    console.log('Contexto 2 (cache):', context2);
    
    // Test 3: Actualizar perfil
    console.log('Test 3: Actualizar perfil...');
    await db.updateProfile('573003913251', {
        chatId: '573003913251@s.whatsapp.net',
        userName: 'Alexander Test',
        labels: ['Test Label'],
        profileData: { name: 'Alexander Test' }
    });
    
    console.log('✅ Todos los tests completados');
}

testDatabase().catch(console.error);
```

### **7.2 Ejecutar Tests**
```bash
npx tsc tests/database/test-guest-database.ts
node tests/database/test-guest-database.js
```

## 🚀 Paso 8: Deploy a Railway

### **8.1 Commit y Push**
```bash
git add .
git commit -m "feat: migración a PostgreSQL para persistencia de datos"
git push
```

### **8.2 Verificar en Railway**
```bash
# En Railway Dashboard:
1. Verificar que el deploy fue exitoso
2. Revisar logs del bot
3. Verificar conexión a PostgreSQL
4. Probar funcionalidad del bot
```

## 📈 Paso 9: Monitoreo y Optimización

### **9.1 Consultas de Monitoreo**
```sql
-- Verificar datos migrados
SELECT COUNT(*) as total_profiles FROM guest_profiles;

-- Verificar cache hits
SELECT 
    COUNT(*) as total_requests,
    COUNT(CASE WHEN last_context_update > CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN 1 END) as cache_hits
FROM guest_profiles;

-- Performance de consultas
SELECT 
    phone_number,
    last_interaction,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_interaction)) as inactivity_seconds
FROM guest_profiles 
ORDER BY last_interaction DESC 
LIMIT 10;
```

### **9.2 Métricas de Performance**
- **Cache hit rate**: % de veces que se usa cache
- **Query performance**: Tiempo de respuesta de consultas
- **Memory usage**: Uso de memoria vs archivos JSON
- **Error rate**: Errores de base de datos

## 🔄 Paso 10: Limpieza

### **10.1 Eliminar Archivos JSON (después de verificar)**
```bash
# Hacer backup antes
cp tmp/threads.json tmp/threads.json.backup
cp tmp/guest_profiles.json tmp/guest_profiles.json.backup

# Eliminar después de verificar que todo funciona
rm tmp/threads.json
rm tmp/guest_profiles.json
```

### **10.2 Eliminar Cache en Memoria**
```typescript
// Eliminar de app-unified.ts:
// const contextCache = new Map<string, { context: string, timestamp: number }>();
// const CONTEXT_CACHE_TTL = 5 * 60 * 1000;
```

## 🎯 Beneficios Obtenidos

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

## 🚨 Troubleshooting

### **Error: Connection refused**
```bash
# Verificar DATABASE_URL en Railway
# Verificar que PostgreSQL esté activo
```

### **Error: Table does not exist**
```bash
# Ejecutar script de creación de tablas
psql [DATABASE_URL] -f create_tables.sql
```

### **Error: Permission denied**
```bash
# Verificar permisos de la base de datos
# Verificar que el usuario tenga acceso
```

### **Performance lenta**
```bash
# Verificar índices
# Optimizar consultas
# Monitorear uso de conexiones
```

## 📝 Checklist Final

- [ ] PostgreSQL configurado en Railway
- [ ] DATABASE_URL configurado
- [ ] Dependencias instaladas
- [ ] Tablas creadas
- [ ] GuestDatabase implementado
- [ ] Código migrado
- [ ] Datos migrados
- [ ] Tests ejecutados
- [ ] Deploy exitoso
- [ ] Funcionalidad verificada
- [ ] Archivos JSON eliminados
- [ ] Documentación actualizada

¡Migración completada! 🎉 