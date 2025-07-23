# ✅ Checklist de Implementación PostgreSQL

## 📋 Resumen

Checklist completo para migrar de archivos JSON a PostgreSQL en Railway, paso a paso.

## 🎯 Fase 1: Configuración Inicial

### **1.1 Railway Setup**
- [ ] Crear servicio PostgreSQL en Railway
- [ ] Copiar DATABASE_URL del servicio
- [ ] Agregar DATABASE_URL como variable de entorno en el bot
- [ ] Verificar conexión a la base de datos

### **1.2 Dependencias**
- [ ] Instalar `pg` y `@types/pg`
- [ ] Verificar que se agregaron a `package.json`
- [ ] Ejecutar `npm install` para confirmar instalación

### **1.3 Estructura de Base de Datos**
- [ ] Crear script `create_tables.sql`
- [ ] Ejecutar script en PostgreSQL
- [ ] Verificar que las tablas se crearon correctamente
- [ ] Verificar que los índices se crearon correctamente

## 🔧 Fase 2: Desarrollo del Código

### **2.1 Clase GuestDatabase**
- [ ] Crear archivo `src/utils/database/GuestDatabase.ts`
- [ ] Implementar constructor con Pool de PostgreSQL
- [ ] Implementar método `getContext()` con cache
- [ ] Implementar método `updateProfile()`
- [ ] Implementar métodos auxiliares (`isContextValid`, `getCacheAge`)
- [ ] Implementar método `generateContext()` (migrar lógica actual)
- [ ] Implementar método `updateContext()`
- [ ] Agregar manejo de errores y logging

### **2.2 Migración del Código Actual**
- [ ] Importar GuestDatabase en `app-unified.ts`
- [ ] Inicializar instancia de GuestDatabase
- [ ] Reemplazar función `getRelevantContext()` para usar base de datos
- [ ] Eliminar cache en memoria (`contextCache`, `CONTEXT_CACHE_TTL`)
- [ ] Verificar que no hay errores TypeScript

### **2.3 Script de Migración**
- [ ] Crear archivo `scripts/migrate-to-postgresql.ts`
- [ ] Implementar migración de `tmp/threads.json`
- [ ] Implementar migración de `tmp/guest_profiles.json`
- [ ] Agregar logging detallado del proceso
- [ ] Agregar manejo de errores
- [ ] Compilar script TypeScript

## 🧪 Fase 3: Testing

### **3.1 Tests Básicos**
- [ ] Crear archivo `tests/database/test-guest-database.ts`
- [ ] Test de conexión a base de datos
- [ ] Test de obtención de contexto
- [ ] Test de cache hit/miss
- [ ] Test de actualización de perfil
- [ ] Compilar y ejecutar tests

### **3.2 Tests de Integración**
- [ ] Test de migración de datos
- [ ] Test de funcionalidad completa del bot
- [ ] Test de performance vs archivos JSON
- [ ] Test de manejo de errores

### **3.3 Verificación de Datos**
- [ ] Verificar que los datos se migraron correctamente
- [ ] Verificar que el cache funciona
- [ ] Verificar que las consultas son rápidas
- [ ] Verificar que no hay pérdida de datos

## 🚀 Fase 4: Deploy

### **4.1 Preparación**
- [ ] Hacer backup de archivos JSON actuales
- [ ] Verificar que todas las variables de entorno están configuradas
- [ ] Verificar que no hay errores TypeScript
- [ ] Ejecutar tests localmente

### **4.2 Deploy a Railway**
- [ ] Commit de todos los cambios
- [ ] Push a GitHub
- [ ] Verificar que el deploy fue exitoso
- [ ] Verificar logs del bot en Railway
- [ ] Verificar conexión a PostgreSQL

### **4.3 Post-Deploy**
- [ ] Ejecutar script de migración en Railway
- [ ] Verificar que los datos se migraron
- [ ] Probar funcionalidad del bot
- [ ] Verificar que el cache funciona
- [ ] Monitorear logs por errores

## 📊 Fase 5: Monitoreo y Optimización

### **5.1 Métricas de Performance**
- [ ] Monitorear tiempo de respuesta de consultas
- [ ] Monitorear uso de memoria
- [ ] Monitorear cache hit rate
- [ ] Monitorear errores de base de datos

### **5.2 Consultas de Verificación**
- [ ] Verificar total de perfiles migrados
- [ ] Verificar cache hits vs misses
- [ ] Verificar performance de consultas
- [ ] Verificar uso de conexiones

### **5.3 Optimización**
- [ ] Optimizar consultas lentas si las hay
- [ ] Ajustar índices si es necesario
- [ ] Optimizar configuración de Pool
- [ ] Implementar métricas de monitoreo

## 🧹 Fase 6: Limpieza

### **6.1 Eliminación de Archivos JSON**
- [ ] Verificar que todo funciona correctamente
- [ ] Hacer backup final de archivos JSON
- [ ] Eliminar `tmp/threads.json`
- [ ] Eliminar `tmp/guest_profiles.json`
- [ ] Eliminar cache en memoria del código

### **6.2 Limpieza de Código**
- [ ] Eliminar imports no utilizados
- [ ] Eliminar variables no utilizadas
- [ ] Limpiar comentarios obsoletos
- [ ] Verificar que no hay errores TypeScript

### **6.3 Documentación**
- [ ] Actualizar documentación del proyecto
- [ ] Documentar nueva estructura de base de datos
- [ ] Documentar APIs de base de datos
- [ ] Actualizar README con nueva arquitectura

## 🎯 Verificación Final

### **7.1 Funcionalidad**
- [ ] El bot responde correctamente
- [ ] El contexto temporal funciona
- [ ] El cache funciona eficientemente
- [ ] Los perfiles se actualizan correctamente

### **7.2 Performance**
- [ ] Tiempo de respuesta similar o mejor que antes
- [ ] Cache hit rate > 80%
- [ ] Sin errores de base de datos
- [ ] Uso de memoria estable

### **7.3 Datos**
- [ ] Todos los datos se migraron correctamente
- [ ] No hay pérdida de información
- [ ] Los datos persisten después de reinicios
- [ ] Backup automático funcionando

## 🚨 Troubleshooting

### **Problemas Comunes y Soluciones**

#### **Error: Connection refused**
- [ ] Verificar DATABASE_URL en Railway
- [ ] Verificar que PostgreSQL esté activo
- [ ] Verificar firewall/red

#### **Error: Table does not exist**
- [ ] Ejecutar script de creación de tablas
- [ ] Verificar nombres de tablas
- [ ] Verificar permisos de usuario

#### **Error: Permission denied**
- [ ] Verificar permisos de la base de datos
- [ ] Verificar que el usuario tenga acceso
- [ ] Verificar configuración de Railway

#### **Performance lenta**
- [ ] Verificar índices
- [ ] Optimizar consultas
- [ ] Monitorear uso de conexiones
- [ ] Ajustar configuración de Pool

#### **Cache no funciona**
- [ ] Verificar TTL en código
- [ ] Verificar consultas de cache
- [ ] Verificar timestamps
- [ ] Verificar zona horaria

## 📈 Métricas de Éxito

### **Antes vs Después**
- [ ] Datos persistentes (antes: se perdían, después: nunca se pierden)
- [ ] Cache eficiente (antes: memoria, después: PostgreSQL)
- [ ] Performance (antes: archivos, después: SQL optimizado)
- [ ] Escalabilidad (antes: limitado, después: ilimitado)

### **Métricas Específicas**
- [ ] Cache hit rate > 80%
- [ ] Tiempo de respuesta < 100ms
- [ ] 0 errores de base de datos
- [ ] 100% de datos migrados

## 🎉 Criterios de Completación

### **Migración Exitosa:**
- ✅ Todos los datos migrados sin pérdida
- ✅ Funcionalidad del bot intacta
- ✅ Performance igual o mejor
- ✅ Cache funcionando eficientemente
- ✅ Datos persistentes en Railway

### **Listo para Producción:**
- ✅ Tests pasando
- ✅ Monitoreo configurado
- ✅ Documentación actualizada
- ✅ Archivos JSON eliminados
- ✅ Código limpio y optimizado

## 🔄 Rollback Plan

### **Si algo sale mal:**
- [ ] Mantener archivos JSON como fallback
- [ ] Script de rollback a JSON
- [ ] Variables de entorno para alternar entre JSON y PostgreSQL
- [ ] Backup completo antes de migración

## 📝 Notas Importantes

### **Antes de Empezar:**
- [ ] Hacer backup completo del proyecto
- [ ] Documentar estado actual
- [ ] Planificar tiempo suficiente (2-3 días)
- [ ] Tener acceso a Railway Dashboard

### **Durante la Implementación:**
- [ ] Probar cada paso antes de continuar
- [ ] Mantener logs detallados
- [ ] Hacer commits frecuentes
- [ ] Documentar cambios

### **Después de la Implementación:**
- [ ] Monitorear por al menos 1 semana
- [ ] Verificar métricas de performance
- [ ] Documentar lecciones aprendidas
- [ ] Planificar próximas mejoras

¡Migración a PostgreSQL completada! 🎉 