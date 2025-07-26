# 📁 **Temporary Files Organization - Bot WhatsApp TeAlquilamos**

> **Gestión profesional de archivos temporales, backups y multimedia cache**

## 🎯 **Filosofía de Archivos Temporales**

### **Principios de Gestión Temporal**
1. **⚡ Performance**: Cache inteligente para respuesta rápida
2. **🔄 Rotación**: Limpieza automática de archivos antiguos
3. **💾 Backup Estratégico**: Respaldos críticos con retención
4. **🎤 Multimedia Cache**: Archivos de voz/audio optimizados
5. **🧹 Auto-cleanup**: Gestión automática de espacio

## 📁 **Estructura Profesional Implementada**

```
tmp/
├── 📖 README_TMP_ORGANIZATION.md  # ← ESTE MANUAL
│
├── 🎤 audio/                      # ← ARCHIVOS DE VOZ/AUDIO
│   ├── voice_573003913251_1753121309380.ogg  # Voz activa
│   ├── voice_573003913251_1753121574642.ogg  # Voz activa
│   ├── voice_573003913251_1753424427749.ogg  # Voz activa
│   ├── voice_573003913251_1753424470879.ogg  # Voz activa
│   ├── voice_573003913251_1753424520799.ogg  # Voz activa
│   ├── voice_573003913251_1753424828128.mp3  # Voz convertida
│   ├── voice_573003913251_1753424925353.mp3  # Voz convertida
│   ├── voice_573003913251_1753424981798.mp3  # Voz convertida
│   ├── voice_573003913251_1753425155972.ogg  # Voz activa
│   │
│   ├── archive/                   # Archivos antiguos (>24h)
│   ├── processing/                # Archivos en procesamiento
│   └── converted/                 # Archivos convertidos cache
│
├── 💾 backups/                    # ← BACKUPS CRÍTICOS
│   ├── threads/                   # Backups de threads por fecha
│   │   ├── 2025-07/              # Backups Julio 2025
│   │   │   ├── threads-2025-07-21T17-36-13-918Z.json
│   │   │   ├── threads-2025-07-21T17-36-49-238Z.json
│   │   │   ├── threads-2025-07-21T17-36-59-939Z.json
│   │   │   ├── threads-2025-07-21T17-37-07-700Z.json
│   │   │   ├── threads-2025-07-21T17-37-16-930Z.json
│   │   │   ├── threads-2025-07-21T17-39-36-265Z.json
│   │   │   ├── threads-2025-07-21T17-39-52-661Z.json
│   │   │   └── threads-2025-07-21T17-42-42-326Z.json
│   │   │
│   │   └── 2025-03/              # Backups Marzo 2025
│   │       └── threads-backup-2025-07-03T06-40-58-635Z.json
│   │
│   ├── assistant-config/          # Backups configuración assistant
│   ├── user-states/               # Backups estados de usuario
│   └── critical-data/             # Otros backups críticos
│
├── 🖼️ images/                     # ← CACHE DE IMÁGENES (FUTURO)
│   ├── received/                  # Imágenes recibidas WhatsApp
│   ├── processed/                 # Imágenes analizadas OpenAI Vision
│   └── thumbnails/                # Miniaturas para cache
│
├── 📄 documents/                  # ← DOCUMENTOS TEMPORALES (FUTURO)
│   ├── pdf-cache/                 # PDFs procesados
│   └── extracted-text/            # Texto extraído de documentos
│
├── 🔄 processing/                 # ← ARCHIVOS EN PROCESAMIENTO
│   ├── ai-requests/               # Requests OpenAI pendientes
│   ├── media-conversion/          # Conversiones multimedia
│   └── background-tasks/          # Tareas en background
│
├── 📊 threads.json                # ← ESTADO ACTUAL THREADS (CRÍTICO)
└── 📊 threads.json.backup         # ← BACKUP INMEDIATO (CRÍTICO)
```

## ⚡ **Gestión de Cache Multimedia**

### **🎤 Audio Cache** (`audio/`)
**Propósito**: 🎯 **PRIORIDAD MULTIMEDIA** - Cache de archivos de voz

**📋 Tipos de Archivos**:
```bash
# Archivos de voz originales (.ogg)
voice_[userId]_[timestamp].ogg     # WhatsApp voice messages

# Archivos convertidos (.mp3)  
voice_[userId]_[timestamp].mp3     # Convertidos para processing

# Estructura del nombre:
# voice_573003913251_1753424427749.ogg
#   |        |            |
#   |        |            └── Timestamp Unix
#   |        └── User ID (WhatsApp)
#   └── Tipo: voice
```

**🔄 Políticas de Retención**:
```bash
# Archivos activos (current): 2 horas
# Archivos en archive/: 24 horas  
# Limpieza automática: Cada 6 horas
# Espacio máximo: 500MB
```

### **🖼️ Images Cache** (`images/` - Futuro)
**Propósito**: Cache de imágenes recibidas y procesadas
```bash
received/     # Imágenes originales WhatsApp
processed/    # Análisis OpenAI Vision cached
thumbnails/   # Miniaturas para UI rápida
```

## 💾 **Sistema de Backups Críticos**

### **📊 Threads Backups** (`backups/threads/`)
**Contenido**: Estados de conversación, contexto usuario, historial
**Criticidad**: 🚨 **MÁXIMA** - Datos de negocio core

**📅 Organización Temporal**:
```bash
2025-07/    # Backups Julio 2025 (actual)
2025-06/    # Backups Junio 2025
2025-05/    # Backups Mayo 2025
...
```

**🔄 Estrategia de Backup**:
```bash
# Backup automático cada 15 minutos
threads.json → threads.json.backup (inmediato)

# Backup timestamped cada hora
threads.json → backups/threads/YYYY-MM/threads-[ISO-timestamp].json

# Retención:
- Hourly backups: 7 días
- Daily backups: 30 días  
- Weekly backups: 90 días
```

### **🤖 Assistant Config Backups** (`backups/assistant-config/`)
**Contenido**: Configuración assistant, vector store, archivos RAG
**Backup**: Antes de cada actualización mayor

## 🧹 **Limpieza Automática y Optimización**

### **⏰ Limpieza Programada**
```bash
# Cada 6 horas (automático)
npm run cleanup:temp-files

# Cada 24 horas (automático)
npm run cleanup:old-backups

# Manual (cuando sea necesario)
npm run cleanup:audio-cache
npm run cleanup:all-temp
```

### **📊 Monitoreo de Espacio**
```bash
# Verificar uso de espacio tmp/
npm run tmp:usage

# Alertas automáticas si tmp/ > 1GB
npm run tmp:check-space

# Limpieza de emergencia
npm run tmp:emergency-cleanup
```

## 🔧 **Scripts de Gestión**

### **🎤 Multimedia Management**
```bash
# Limpiar archivos de audio antiguos
node scripts/cleanup/audio-cleanup.js

# Procesar archivos de voz pendientes  
node scripts/multimedia/process-voice-queue.js

# Estadísticas de uso multimedia
node scripts/analytics/multimedia-stats.js
```

### **💾 Backup Management**
```bash
# Crear backup manual threads
node scripts/backup/create-threads-backup.js

# Restaurar desde backup específico
node scripts/backup/restore-threads.js [timestamp]

# Verificar integridad backups
node scripts/backup/verify-backups.js
```

### **🧹 Cleanup Scripts**
```bash
# Limpieza completa archivos temporales
node scripts/cleanup/full-temp-cleanup.js

# Limpieza selectiva por edad
node scripts/cleanup/cleanup-by-age.js --days 7

# Limpieza por espacio (mantener últimos X GB)
node scripts/cleanup/cleanup-by-space.js --max-gb 2
```

## 🚨 **Archivos Críticos - NO TOCAR**

### **🔒 Archivos de Estado Activo**
```bash
❌ NO MOVER/ELIMINAR:
tmp/threads.json           # Estado actual conversaciones
tmp/threads.json.backup    # Backup inmediato

⚠️ MOVER CON CUIDADO:
tmp/backups/threads/       # Backups organizados
tmp/audio/voice_*          # Solo si >24h antigüedad
```

### **🛡️ Protección de Datos**
```bash
# Verificación antes de limpieza
if [[ -f "tmp/threads.json" ]]; then
    echo "✅ Estado threads protegido"
else
    echo "🚨 ALERTA: threads.json faltante!"
    exit 1
fi
```

## 📊 **Métricas y Monitoreo**

### **📈 Métricas de Uso**
- **🎤 Audio files**: Cantidad, tamaño, tiempo procesamiento
- **💾 Backups**: Frecuencia, tamaño, integridad
- **🧹 Cleanup**: Archivos eliminados, espacio liberado
- **⚡ Performance**: Tiempo acceso cache, hit rate

### **🚨 Alertas Automáticas**
```bash
# Espacio disco tmp/ > 80%
# Backup threads.json > 1h sin actualizar
# Archivos audio > 500MB total
# Falta threads.json o threads.json.backup
```

## 🔄 **Rutinas de Mantenimiento**

### **⏰ Automático (Cron/Scheduled)**
```bash
# Cada 15 min: Backup threads.json
*/15 * * * * npm run backup:threads-auto

# Cada 6h: Limpieza audio cache  
0 */6 * * * npm run cleanup:audio-cache

# Diario 02:00: Cleanup completo
0 2 * * * npm run cleanup:daily

# Semanal: Backup consolidado
0 3 * * 0 npm run backup:weekly-consolidation
```

### **🛠️ Manual (Desarrollo)**
```bash
# Verificación estado tmp/
npm run tmp:status

# Limpieza pre-deploy
npm run tmp:pre-deploy-cleanup  

# Backup manual antes cambios importantes
npm run backup:manual "before-feature-X"
```

---

## 💡 **Mejores Prácticas Tmp/**

> **"Los archivos temporales deben ser efímeros pero la data crítica debe persistir"**

- 🎯 **Cache inteligente** para performance
- 🔒 **Backup redundante** para datos críticos
- 🧹 **Limpieza automática** para espacio optimizado
- 📊 **Monitoreo continuo** para alertas tempranas
- ⚡ **Acceso rápido** para UX superior

---

**📅 Última actualización**: Julio 2025  
**👤 Responsable**: Equipo de Desarrollo  
**🔄 Próxima revisión**: Semanal  
**🎯 Prioridad**: Cache multimedia y backup threads crítico