# 🚀 Plan de Migración a PostgreSQL para Persistencia de Datos en TeAlquilamos Bot

## 📋 Resumen

Tu idea de migrar los datos de clientes (perfiles, threads, contextos y etiquetas) de cachés en memoria y archivos JSON a una base de datos PostgreSQL es **excelente**. Es una buena evolución para el proyecto porque resuelve problemas clave como la pérdida de datos en reinicios de Railway (donde los contenedores son efímeros), mejora la escalabilidad, facilita análisis futuros (ej. marketing) y unifica todo en un lugar seguro y persistente. No es mala idea en absoluto; de hecho, es un paso natural para un bot en producción. Las desventajas mínimas (como un poco más de latencia en consultas iniciales) se compensan con cachés inteligentes y optimizaciones.

El plan actual que proporcionaste es sólido, pero lo simplificaré aquí desde cero: menos código repetido, enfoque en lo esencial, integración gradual para evitar romper el bot, y pruebas en cada etapa. Usaremos PostgreSQL en Railway (gratuito para uso básico), la librería `pg` para Node.js, y mantendremos compatibilidad con el código existente. Tiempo estimado: 3-5 días, trabajando paso a paso.

## 🎯 Objetivos

- **Persistir datos**: Threads, perfiles de huéspedes, contextos y etiquetas se guardan en BD, no en memoria/archivos que se pierden.
- **Mantener funcionalidad**: El bot sigue trabajando igual, pero ahora con BD como backend.
- **Facilitar evolución**: Base para marketing (ej. clientes históricos, campañas).
- **Simple y seguro**: Migración gradual, con backups y rollback fácil.

## 🛠️ Etapas del Plan

### Etapa 1: Preparación y Configuración (1 día)
   - **Objetivo**: Configurar la BD y herramientas sin tocar el código principal.
   
   - **Paso 1.1: Crear PostgreSQL en Railway**
     - En el dashboard de Railway, ve a tu proyecto "Bot-Wsp-Whapi-IA".
     - Agrega un nuevo servicio: "New" > "Database" > "PostgreSQL".
     - Espera a que se cree. Copia la `DATABASE_URL` (formato: `postgresql://user:pass@host:port/db`).
     - En las variables de entorno del servicio del bot, agrega `DATABASE_URL` con el valor copiado.

   - **Paso 1.2: Instalar dependencias**
     - Ejecuta: `npm install pg @types/pg`.
     - Verifica en `package.json` que se agregue bajo "dependencies": `"pg": "^8.11.3", "@types/pg": "^8.10.9"`.

   - **Paso 1.3: Crear tablas en la BD**
     - Conecta a la BD usando una herramienta como pgAdmin o el comando `psql [DATABASE_URL]`.
     - Ejecuta este SQL simple para crear tablas esenciales:
       ```sql
       -- Tabla para perfiles de huéspedes (unifica threads y guest_profiles)
       CREATE TABLE guest_profiles (
           phone_number TEXT PRIMARY KEY,  -- Ej. '573123456789'
           chat_id TEXT NOT NULL,
           thread_id TEXT,
           user_name TEXT,
           labels JSONB,  -- Array de etiquetas como ['cotizacion', 'vip']
           context_cache TEXT,  -- Cache temporal de contexto
           last_context_update TIMESTAMP,  -- Para TTL
           profile_data JSONB,  -- Datos extra como JSON
           last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );

       -- Tabla para clientes históricos (para marketing futuro)
       CREATE TABLE historical_clients (
           id SERIAL PRIMARY KEY,
           phone_number TEXT UNIQUE,
           user_name TEXT,
           labels JSONB,
           total_interactions INTEGER DEFAULT 0,
           last_interaction TIMESTAMP,
           booking_status TEXT,  -- Ej. 'interested', 'booked'
           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );

       -- Índices para velocidad
       CREATE INDEX idx_guest_last_interaction ON guest_profiles(last_interaction);
       CREATE INDEX idx_guest_labels ON guest_profiles USING GIN(labels);
       ```
     - Prueba: Ejecuta `SELECT * FROM guest_profiles;` para verificar.

   - **Pruebas**: Conecta manualmente con `psql` y confirma que puedes insertar un registro de prueba: `INSERT INTO guest_profiles (phone_number, chat_id) VALUES ('test123', 'test@whatsapp');`.

### Etapa 2: Crear Clase de BD y Migrar Lógica Básica (1 día)
   - **Objetivo**: Una clase simple para interactuar con la BD, reemplazando cachés en memoria.

   - **Paso 2.1: Crear archivo GuestDatabase.ts**
     - En `src/utils/database/GuestDatabase.ts`, agrega:
       ```typescript
       import { Pool } from 'pg';

       export class GuestDatabase {
           private pool: Pool;

           constructor() {
               this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
           }

           // Obtener o generar contexto (reemplaza cache en memoria)
           async getContext(phoneNumber: string): Promise<string> {
               const result = await this.pool.query(
                   'SELECT context_cache, last_context_update FROM guest_profiles WHERE phone_number = $1',
                   [phoneNumber]
               );
               const row = result.rows[0];
               if (row && Date.now() - new Date(row.last_context_update).getTime() < 5 * 60 * 1000) {  // TTL 5 min
                   return row.context_cache || '';
               }
               // Generar nuevo contexto (migra tu lógica actual de getRelevantContext aquí)
               const newContext = '[Contexto generado basado en historial]';  // Reemplaza con tu código real
               await this.updateContext(phoneNumber, newContext);
               return newContext;
           }

           async updateContext(phoneNumber: string, context: string): Promise<void> {
               await this.pool.query(
                   'UPDATE guest_profiles SET context_cache = $1, last_context_update = CURRENT_TIMESTAMP WHERE phone_number = $2',
                   [context, phoneNumber]
               );
           }

           // Guardar/actualizar perfil (unifica threads y guest_profiles)
           async updateProfile(phoneNumber: string, data: { chat_id: string; thread_id?: string; user_name?: string; labels?: string[]; profile_data?: any; }) {
               await this.pool.query(
                   `INSERT INTO guest_profiles (phone_number, chat_id, thread_id, user_name, labels, profile_data, last_interaction)
                    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
                    ON CONFLICT (phone_number) DO UPDATE SET
                       chat_id = EXCLUDED.chat_id, thread_id = EXCLUDED.thread_id, user_name = EXCLUDED.user_name,
                       labels = EXCLUDED.labels, profile_data = EXCLUDED.profile_data, last_interaction = CURRENT_TIMESTAMP`,
                   [phoneNumber, data.chat_id, data.thread_id, data.user_name, JSON.stringify(data.labels || []), JSON.stringify(data.profile_data || {})]
               );
           }

           // Para marketing: Mover a históricos (ejecutar periódicamente)
           async archiveInactive(): Promise<void> {
               await this.pool.query(
                   `INSERT INTO historical_clients (phone_number, user_name, labels, last_interaction)
                    SELECT phone_number, user_name, labels, last_interaction FROM guest_profiles
                    WHERE last_interaction < CURRENT_TIMESTAMP - INTERVAL '30 days'
                    ON CONFLICT (phone_number) DO UPDATE SET labels = EXCLUDED.labels, last_interaction = EXCLUDED.last_interaction`
               );
               // Opcional: Borrar de guest_profiles después
           }
       }
       ```

   - **Paso 2.2: Integrar en app-unified.ts**
     - Importa: `import { GuestDatabase } from './utils/database/GuestDatabase.js';`
     - Inicializa: `const guestDB = new GuestDatabase();`
     - Reemplaza llamadas a cachés (ej. `contextCache.get()`) con `guestDB.getContext(userId);`
     - En funciones como `threadPersistence.setThread()`, agrega `guestDB.updateProfile(shortUserId, { chat_id: chatId, thread_id: threadId, user_name: userName });`
     - Elimina mapas como `contextCache` y código de archivos JSON.

   - **Pruebas**: Crea un script de test simple: Ejecuta `guestDB.updateProfile('test123', { chat_id: 'test' });` y verifica en la BD.

### Etapa 3: Migración de Datos Existentes (1 día)
   - **Objetivo**: Transferir datos de JSON a BD sin perder nada.

   - **Paso 3.1: Backup actual**
     - Copia `tmp/threads.json` y `tmp/guest_profiles.json` a un backup.

   - **Paso 3.2: Script de migración**
     - Crea `scripts/migrate.ts`:
       ```typescript
       import { GuestDatabase } from '../src/utils/database/GuestDatabase.js';
       import fs from 'fs';

       const db = new GuestDatabase();
       const threads = JSON.parse(fs.readFileSync('tmp/threads.json', 'utf-8'));
       for (const [userId, data] of Object.entries(threads)) {
           db.updateProfile(userId, { chat_id: data.chatId, thread_id: data.threadId, user_name: data.userName, labels: data.labels });
       }
       // Similar para guest_profiles.json
       console.log('Migración completa');
       ```
     - Ejecuta: `node scripts/migrate.js`.

   - **Pruebas**: Verifica en la BD que los datos migrados coincidan (ej. `SELECT COUNT(*) FROM guest_profiles;`).

### Etapa 4: Testing, Deploy y Monitoreo (1-2 días)
   - **Objetivo**: Asegurar que funcione y optimizar.

   - **Paso 4.1: Tests locales**
     - Prueba el bot: Envía mensajes, verifica que threads y contextos se guarden en BD.
     - Agrega logs: En `GuestDatabase`, usa `console.log` para cache hits/misses.

   - **Paso 4.2: Deploy a Railway**
     - Commit: `git add . && git commit -m "Migración a PostgreSQL" && git push`.
     - Monitorea logs en Railway para errores de conexión.

   - **Paso 4.3: Optimización y marketing inicial**
     - Agrega un cron (setInterval) para archivar inactivos: `setInterval(() => guestDB.archiveInactive(), 24 * 60 * 60 * 1000);`.
     - Prueba queries: Ej. `SELECT * FROM historical_clients WHERE booking_status = 'interested';`.

   - **Pruebas**: Simula 10 interacciones, verifica persistencia post-reinicio.

## 🚨 Consideraciones y Rollback
- **Costos**: PostgreSQL en Railway es gratis hasta ~500MB.
- **Errores comunes**: Verifica `DATABASE_URL`. Si falla, fallback a JSON temporal.
- **Rollback**: Mantén código JSON como opción con un flag (ej. `if (!process.env.DATABASE_URL) { usa JSON }`).
- **Próximos pasos**: Integra marketing (ej. envíos masivos basados en labels).

¡Este plan es simple, funcional y escalable. Si necesitas código específico o ajustes, dime! 🎉