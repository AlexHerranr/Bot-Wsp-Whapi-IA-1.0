# 🤖 Bot WhatsApp - Analizador de Logs Cloud Run

Herramienta avanzada para analizar y limpiar logs de Google Cloud Run del bot de WhatsApp, convirtiendo logs contaminados en formato legible como desarrollo local.

## 🎯 **Comportamiento Principal**

✅ **Archivos individuales por defecto** (como desarrollo local)  
✅ **Limpieza automática** (máximo 10 archivos)  
✅ **Sin archivos consolidados** (a menos que se solicite)  
✅ **Análisis avanzado** con 8 tipos de métricas  

## 🚀 **Uso Rápido**

```bash
# Comando principal (recomendado)
python parse_bot_logs.py --hours 2

# Últimas sesiones
python parse_bot_logs.py --sessions 5

# Solo errores
python parse_bot_logs.py --errors-only

# Usuario específico
python parse_bot_logs.py --user 573003913251
```

## 📂 **Estructura del Proyecto**

```
bot-logs-parser/
├── 📄 parse_bot_logs.py          # Script principal
├── 📄 log_config.yaml            # Configuración de filtros
├── 📄 requirements.txt           # Dependencias
├── 📄 README.md                  # Esta documentación
├── 📄 COMANDOS_INDIVIDUALES.md   # Guía de comandos
├── 📄 COMANDOS_RAPIDOS.md        # Comandos básicos
├── 📄 QUICK_START.md             # Inicio rápido
├── 🗂️ docs/                      # Documentación detallada
│   ├── MANUAL_USO.md            # Manual completo
│   ├── SETUP_INSTRUCTIONS.md    # Instrucciones de instalación
│   └── README_BOT_LOGS.md       # Documentación técnica
├── 🗂️ examples/                  # Archivos de ejemplo
│   └── ejemplo_archivo_consolidado.txt
└── 🗂️ tests/                     # Scripts de prueba
    ├── test_parser.py
    └── test_advanced_features.py
```

## 📁 **Archivos de Salida**

### **Archivos Individuales** (Por defecto)
```
📁 /logsGoogleCloud/
├── session_20250710_141020_1752156620.txt  (48KB)
├── session_20250710_135327_1752155607.txt  (21KB)
├── session_20250710_151028_1752160228.txt  (2.1KB)
└── ... (máximo 10 archivos)
```

### **Archivo Consolidado** (Solo con --save-consolidated)
```
📁 /tools/bot-logs-parser/
└── bot_sessions_YYYYMMDD_HHMMSS.txt  (TODAS las sesiones)
```

## 🔧 **Instalación**

### **Prerrequisitos**
- Python 3.7+
- Google Cloud SDK
- Dependencias Python

### **Instalación Rápida**
```bash
# Instalar dependencias
pip install -r requirements.txt

# Verificar gcloud
gcloud --version

# Primer uso
python parse_bot_logs.py --hours 1
```

## 💡 **Funcionalidades Principales**

### **🧹 Limpieza de Logs**
- ❌ Elimina 90% de metadatos HTTP inútiles
- ✅ Convierte a formato local legible
- ✅ Preserva información importante

### **📊 Análisis Avanzado**
- **FUNCTION_METRICS**: Rendimiento de funciones
- **USER_INTENT**: Análisis de intención NLP
- **CONVERSION_TRACKING**: Seguimiento comercial
- **RETRY_PATTERN**: Detección de reintentos
- **SESSION_ANALYTICS**: Análisis completo de sesión
- **SYSTEM_HEALTH**: Monitoreo de salud
- **BUSINESS_CONTEXT**: Contexto comercial
- **DEEP_DEBUG**: Debugging técnico

### **🎯 Detección Inteligente**
- **Sesiones automáticas**: Detecta inicio/fin
- **Usuarios únicos**: Identifica conversaciones
- **Errores críticos**: Resalta problemas
- **Tiempos de respuesta**: Mide performance

## 📋 **Comandos Principales**

### **Análisis Básico**
```bash
# Desarrollo diario
python parse_bot_logs.py --hours 2

# Últimas sesiones
python parse_bot_logs.py --sessions 3

# Solo problemas
python parse_bot_logs.py --errors-only
```

### **Filtros Específicos**
```bash
# Usuario específico
python parse_bot_logs.py --user 573003913251

# Sesión específica
python parse_bot_logs.py --session session-1752156620

# Período personalizado
python parse_bot_logs.py --hours 6 --limit 1000
```

### **Control de Archivos**
```bash
# Más archivos (15 en lugar de 10)
python parse_bot_logs.py --max-session-files 15

# Solo mostrar (no guardar)
python parse_bot_logs.py --no-save

# Archivo consolidado también
python parse_bot_logs.py --save-consolidated
```

## 🎯 **Casos de Uso**

| Necesidad | Comando |
|-----------|---------|
| **Desarrollo diario** | `python parse_bot_logs.py --hours 2` |
| **Debugging específico** | `python parse_bot_logs.py --user 573003913251` |
| **Análisis de errores** | `python parse_bot_logs.py --errors-only` |
| **Performance check** | `python parse_bot_logs.py --sessions 5` |
| **Sesión específica** | `python parse_bot_logs.py --session session-123` |

## 📊 **Ejemplo de Salida**

### **ANTES** (Log contaminado de Cloud Run)
```json
{
  "httpRequest": {
    "latency": "0.003107059s",
    "protocol": "HTTP/1.1",
    "remoteIp": "37.27.141.248",
    "requestMethod": "POST",
    "requestSize": "727",
    "requestUrl": "https://bot-wsp-whapi-ia...",
    "responseSize": "280",
    "serverIp": "34.143.76.2",
    "status": 200
  },
  "insertId": "6870101c0005c456c093bd02",
  "labels": { ... },
  "textPayload": "[2025-07-10T14:10:20] Usuario 573003913251: \"Me gustaría consultar disponibilidad\""
}
```

### **DESPUÉS** (Log limpio)
```
[2025-07-10 14:10:20] 👤 USER: Usuario 573003913251: "Me gustaría consultar disponibilidad"
[2025-07-10 14:10:36] ℹ️ INFO: [BOT] 📝 2 msgs → OpenAI
[2025-07-10 14:11:04] ✅ SUCCESS: [BOT] ✓ Completado (28.5s) → "Para las fechas del 15 al 20 de julio..."
```

## 🔍 **Ventajas del Sistema**

### **✅ Antes vs Después**
| Aspecto | ANTES (Cloud Run) | DESPUÉS (Parser) |
|---------|-------------------|------------------|
| **Legibilidad** | 10% útil, 90% ruido | 100% información relevante |
| **Formato** | JSON complejo | Logs como desarrollo local |
| **Análisis** | Manual y lento | Automático con métricas |
| **Archivos** | Un archivo gigante | Sesiones individuales |
| **Mantenimiento** | Acumulación infinita | Limpieza automática |

### **🎯 Impacto**
- **⚡ 10x más rápido** para encontrar problemas
- **🧹 90% menos ruido** en los logs
- **📊 Métricas automáticas** de rendimiento
- **🔍 Análisis inteligente** de conversaciones
- **💾 Gestión automática** de archivos

## 🛠️ **Configuración Avanzada**

### **Archivo de Configuración** (`log_config.yaml`)
```yaml
# Controla qué logs mostrar/ocultar
filters:
  show_http_metadata: false
  show_user_messages: true
  show_openai_responses: true
  show_function_calls: true
  
# Límites y umbrales
limits:
  max_session_files: 10
  session_timeout_minutes: 5
  max_logs_per_request: 5000
```

### **Alias Recomendados**
```powershell
# PowerShell Profile
function botlogs { python parse_bot_logs.py --hours 2 }
function botlogs-errors { python parse_bot_logs.py --errors-only }
function botlogs-user { param($user) python parse_bot_logs.py --user $user }
```

## 📚 **Documentación**

- **[COMANDOS_INDIVIDUALES.md](COMANDOS_INDIVIDUALES.md)** - Guía completa de comandos
- **[COMANDOS_RAPIDOS.md](COMANDOS_RAPIDOS.md)** - Comandos básicos
- **[QUICK_START.md](QUICK_START.md)** - Inicio rápido
- **[docs/MANUAL_USO.md](docs/MANUAL_USO.md)** - Manual detallado
- **[docs/SETUP_INSTRUCTIONS.md](docs/SETUP_INSTRUCTIONS.md)** - Instalación
- **[docs/README_BOT_LOGS.md](docs/README_BOT_LOGS.md)** - Documentación técnica

## 🚨 **Solución de Problemas**

### **Error: gcloud no encontrado**
```bash
# Windows
choco install gcloudsdk
# O descargar desde: https://cloud.google.com/sdk/docs/install
```

### **Error: Sin permisos Cloud Run**
```bash
gcloud auth login
gcloud config set project gen-lang-client-0318357688
```

### **Error: Cache temporal**
```bash
# Limpiar cache si hay problemas
rm /tmp/bot_logs_cache.json
```

## 🎉 **Resultado Final**

Transforma logs **ilegibles de Cloud Run** en **logs limpios como desarrollo local** con:

✅ **Archivos individuales** por sesión  
✅ **Limpieza automática** de archivos antiguos  
✅ **Análisis inteligente** con métricas avanzadas  
✅ **Formato idéntico** al desarrollo local  
✅ **Detección automática** de problemas  

**De logs contaminados a análisis profesional en segundos.** 🚀