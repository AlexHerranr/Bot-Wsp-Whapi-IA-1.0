# ⚡ Inicio Rápido - Bot Logs Parser

Convierte logs de Cloud Run en archivos individuales limpios en **5 minutos**.

## 🚀 **Setup Rápido**

### **1. Verificar Prerrequisitos**
```bash
# Verificar Python
python --version  # Debe ser 3.7+

# Verificar gcloud
gcloud --version  # Debe estar instalado
```

### **2. Instalar Dependencias**
```bash
pip install -r requirements.txt
```

### **3. Primer Uso**
```bash
# Comando básico (recomendado)
python parse_bot_logs.py --hours 2
```

## 📁 **¿Dónde se guardan los archivos?**

### **Archivos Individuales** (Por defecto)
```
📁 /logsGoogleCloud/
├── session_20250710_141020_1752156620.txt  ✅ Sesión individual
├── session_20250710_135327_1752155607.txt  ✅ Sesión individual  
└── ... (máximo 10 archivos)
```

### **Sin archivos consolidados** (a menos que uses `--save-consolidated`)

## 🎯 **Comandos Esenciales**

```bash
# Desarrollo diario
python parse_bot_logs.py --hours 2

# Últimas 5 sesiones
python parse_bot_logs.py --sessions 5

# Solo errores
python parse_bot_logs.py --errors-only

# Usuario específico
python parse_bot_logs.py --user 573003913251
```

## 📊 **Resultado Esperado**

### **ANTES** (Cloud Run)
```json
{"httpRequest":{"latency":"0.003s","remoteIp":"37.27.141.248"...},"textPayload":"Usuario 573003913251: Hola"}
```

### **DESPUÉS** (Parser)
```
[2025-07-10 14:10:20] 👤 USER: Usuario 573003913251: "Hola"
[2025-07-10 14:10:25] ✅ SUCCESS: [BOT] Completado (5.2s) → "¡Hola! ¿En qué puedo ayudarte?"
```

## 🔧 **Estructura del Proyecto**

```
bot-logs-parser/
├── 📄 parse_bot_logs.py          # Script principal
├── 📄 log_config.yaml            # Configuración
├── 📄 README.md                  # Documentación principal
├── 📄 COMANDOS_INDIVIDUALES.md   # Guía completa de comandos
├── 🗂️ docs/                      # Documentación detallada
├── 🗂️ examples/                  # Archivos de ejemplo
└── 🗂️ tests/                     # Scripts de prueba
```

## ⚡ **Comandos de Mantenimiento**

```bash
# Limpiar archivos antiguos
python cleanup.py

# Verificar estructura
dir docs, examples, tests

# Configurar alias (PowerShell)
function botlogs { python parse_bot_logs.py --hours 2 }
```

## 🎯 **Ventajas Inmediatas**

✅ **Archivos como desarrollo local**: Cada sesión en su archivo  
✅ **90% menos ruido**: Solo información relevante  
✅ **Limpieza automática**: Máximo 10 archivos  
✅ **Análisis instantáneo**: Métricas automáticas  

## 🆘 **Solución de Problemas**

### **Error: gcloud no encontrado**
```bash
# Instalar Google Cloud SDK
# Windows: https://cloud.google.com/sdk/docs/install
# Luego: gcloud auth login
```

### **Error: Sin permisos**
```bash
gcloud auth login
gcloud config set project gen-lang-client-0318357688
```

### **No se crean archivos**
```bash
# Verificar directorio de salida
ls ../../logsGoogleCloud/

# Forzar creación
python parse_bot_logs.py --hours 1 --max-session-files 5
```

## 📚 **Siguiente Paso**

Una vez funcionando, lee:
- **[COMANDOS_INDIVIDUALES.md](COMANDOS_INDIVIDUALES.md)** - Comandos completos
- **[README.md](README.md)** - Documentación principal
- **[docs/MANUAL_USO.md](docs/MANUAL_USO.md)** - Manual detallado

---

**🎉 ¡En 5 minutos tienes logs limpios como desarrollo local!** 