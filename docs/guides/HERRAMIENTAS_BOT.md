# 🛠️ Herramientas del Bot WhatsApp

## 📍 Ubicación de Herramientas

### 🤖 Bot Logs Parser
**Ubicación**: `tools/bot-logs-parser/`
**Propósito**: Análisis rápido de logs de Google Cloud Run

#### Uso Rápido:
```bash
cd tools/bot-logs-parser
.\botlogs.bat                     # Últimas 2 horas
.\botlogs.bat errors              # Solo errores
.\botlogs.bat user 573003913251   # Usuario específico
```

#### Documentación:
- 📖 **README.md** - Documentación completa
- ⚡ **QUICK_START.md** - Inicio rápido (2 minutos)
- 📋 **MANUAL_USO.md** - Manual detallado con ejemplos
- ⚙️ **SETUP_INSTRUCTIONS.md** - Instalación paso a paso

#### Archivos Principales:
- `parse_bot_logs.py` - Script principal Python
- `botlogs.bat` - Script Windows (uso fácil)
- `botlogs` - Script Linux/Mac
- `requirements.txt` - Dependencias

---

## 🎯 ¿Qué Herramienta Usar?

### "El bot no responde"
```bash
cd tools/bot-logs-parser
.\botlogs.bat errors
```

### "Usuario tiene problemas"
```bash
cd tools/bot-logs-parser
.\botlogs.bat user 573003913251
```

### "Análisis general"
```bash
cd tools/bot-logs-parser
.\botlogs.bat 6
```

---

## 📁 Estructura de Herramientas

```
tools/
├── bot-logs-parser/          # 🤖 Análisis de logs
│   ├── README.md            # Documentación principal
│   ├── QUICK_START.md       # Inicio rápido
│   ├── MANUAL_USO.md        # Manual detallado
│   ├── parse_bot_logs.py    # Script principal
│   ├── botlogs.bat          # Script Windows
│   └── requirements.txt     # Dependencias
└── [futuras herramientas]   # 🔮 Próximas herramientas
```

---

## 🚀 Instalación Rápida

```bash
# 1. Ir a la herramienta
cd tools/bot-logs-parser

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Usar
.\botlogs.bat
```

---

## 📞 Soporte

- **Bot Logs Parser**: Ver `tools/bot-logs-parser/README.md`
- **Problemas generales**: Revisar documentación en `docs/`
- **Desarrollo**: Ver `scripts/` para herramientas de desarrollo

---

**¡Todas las herramientas están diseñadas para hacer tu vida más fácil!** 🎯 