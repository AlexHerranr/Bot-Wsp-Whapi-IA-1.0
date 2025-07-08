# 📦 Archivo de Archivos Históricos

Esta carpeta contiene todos los archivos que fueron utilizados durante el desarrollo y deployment del bot, pero que ya no son necesarios para la operación actual. **NO BORRAR** - mantener como referencia y backup.

## 📁 Estructura de Carpetas

### `/app-versions/` - Versiones Anteriores de la Aplicación
- `app-nuclear.ts` - Versión minimalista de emergencia
- `app-emergency.ts` - Versión de emergencia básica  
- `app-emergency-backup.ts` - Backup de la versión de emergencia
- `app-original.ts` - Versión original antes de unificación
- `app.ts.backup.1751833834188` - **IMPORTANTE**: Backup completo con todas las funcionalidades (1825 líneas)

### `/deployment-scripts/` - Scripts de Deployment y Utilidades
- `deploy-cloud-run.ps1` - Script original de deployment
- `deploy-cloud-run.sh` - Versión en bash del deployment
- `deploy-cloud-run-fixed.ps1` - Script corregido v1
- `deploy-cloud-run-fixed.sh` - Script corregido en bash
- `deploy-cloud-run-v2.ps1` - Script versión 2
- `diagnose-cloud-run.sh` - Script de diagnóstico de Cloud Run
- `fix-typescript-errors.js` - Script para corregir errores de TypeScript
- `verify-build.js` - Script de verificación de build
- `check-webhook.js` - Script de verificación de webhook

### `/configs-old/` - Configuraciones Antiguas
- `cloud-run-config.yaml` - Configuración antigua de Cloud Run
- `cloud-run-service.yaml` - Configuración de servicio anterior
- `rollup.config.mjs` - Configuración de Rollup (no utilizada)

### `/docs-old/` - Documentación Antigua
- `README-UNIFIED.md` - Documentación de la versión unificada anterior

## 🎯 Archivo Más Importante

**`app-versions/app.ts.backup.1751833834188`** - Este es el archivo MÁS IMPORTANTE del archive. Contiene:
- ✅ Sistema completo de buffers de 8 segundos
- ✅ Function calling completo con retry logic
- ✅ Mensajes manuales del agente
- ✅ División inteligente de mensajes largos
- ✅ Sistema avanzado de etiquetas
- ✅ Todas las funcionalidades que se integraron en `app-unified.ts`

## 🚨 Instrucciones de Uso

1. **NO BORRAR NINGÚN ARCHIVO** - Todos sirven como referencia
2. **Para recuperar funcionalidad**: Revisar primero `app.ts.backup.1751833834188`
3. **Para problemas de deployment**: Revisar scripts en `/deployment-scripts/`
4. **Para configuraciones**: Revisar `/configs-old/`

## 📊 Estado Actual del Proyecto

- **Archivo activo**: `src/app-unified.ts` (versión final unificada)
- **Configuración activa**: `src/config/environment.ts`
- **Scripts activos**: Los que están en la raíz del proyecto

---
*Creado durante la reorganización del proyecto - $(Get-Date)* 