# 📁 Comandos para Archivos Individuales

## 🎯 **Nuevo Comportamiento por Defecto**
- ✅ **Solo archivos individuales** (como desarrollo local)
- ✅ **Limpieza automática** (máximo 10 archivos)
- ✅ **Sin archivos consolidados** (a menos que se solicite)

## 🚀 **Comandos Principales**

### **Análisis Básico (Recomendado)**
```bash
# Últimas 3 sesiones individuales
python parse_bot_logs.py --sessions 3

# Última hora individual
python parse_bot_logs.py --hours 1

# Últimas 2 horas individuales
python parse_bot_logs.py --hours 2
```

### **Filtros Específicos**
```bash
# Usuario específico
python parse_bot_logs.py --user 573003913251

# Solo sesiones con errores
python parse_bot_logs.py --errors-only

# Sesión específica
python parse_bot_logs.py --session session-1752156620
```

### **Control de Archivos**
```bash
# Mantener más archivos (15 en lugar de 10)
python parse_bot_logs.py --max-session-files 15

# Mantener menos archivos (5 en lugar de 10)
python parse_bot_logs.py --max-session-files 5

# No guardar archivos (solo mostrar en pantalla)
python parse_bot_logs.py --no-save
```

### **Archivo Consolidado (Opcional)**
```bash
# Guardar TAMBIÉN archivo consolidado
python parse_bot_logs.py --save-consolidated

# Solo archivo consolidado (sin individuales)
python parse_bot_logs.py --no-individual-files --save-consolidated
```

## 📂 **Ubicación de Archivos**

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
└── bot_sessions_20250710_151647.txt  (17KB - TODAS las sesiones)
```

## 💡 **Recomendaciones de Uso**

### **Desarrollo Diario**
```bash
# Comando principal para desarrollo
python parse_bot_logs.py --hours 2
```

### **Análisis de Problemas**
```bash
# Buscar errores
python parse_bot_logs.py --errors-only

# Usuario con problemas
python parse_bot_logs.py --user 573003913251 --hours 6
```

### **Limpieza y Mantenimiento**
```bash
# Reducir archivos antiguos
python parse_bot_logs.py --max-session-files 5 --hours 1
```

## 🔧 **Configuración Personalizada**

### **Alias Recomendados (PowerShell)**
```powershell
# Agregar al perfil de PowerShell
function botlogs { python parse_bot_logs.py --hours 2 }
function botlogs-errors { python parse_bot_logs.py --errors-only }
function botlogs-user { param($user) python parse_bot_logs.py --user $user }
```

### **Uso de Alias**
```bash
# Análisis rápido
botlogs

# Solo errores
botlogs-errors

# Usuario específico
botlogs-user 573003913251
```

## 📊 **Ventajas del Nuevo Sistema**

✅ **Archivos como desarrollo local**: Cada sesión en su archivo  
✅ **Limpieza automática**: No acumula archivos antiguos  
✅ **Análisis específico**: Fácil de compartir sesiones individuales  
✅ **Sin duplicados**: Solo guarda sesiones nuevas  
✅ **Configurable**: Ajusta cantidad de archivos a conservar  

## 🎯 **Casos de Uso**

| Necesidad | Comando |
|-----------|---------|
| **Desarrollo diario** | `python parse_bot_logs.py --hours 2` |
| **Debugging específico** | `python parse_bot_logs.py --user 573003913251` |
| **Análisis de errores** | `python parse_bot_logs.py --errors-only` |
| **Sesión específica** | `python parse_bot_logs.py --session session-123` |
| **Archivo consolidado** | `python parse_bot_logs.py --save-consolidated` | 