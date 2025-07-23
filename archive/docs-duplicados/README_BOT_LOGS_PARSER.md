# 📚 Documentación - Bot Logs Parser

Esta carpeta contiene la documentación detallada del analizador de logs.

## 📋 **Índice de Documentación**

### **📖 Manuales de Usuario**
- **[MANUAL_USO.md](MANUAL_USO.md)** - Manual completo de uso
- **[SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)** - Instrucciones de instalación
- **[README_BOT_LOGS.md](README_BOT_LOGS.md)** - Documentación técnica detallada

### **🚀 Guías Rápidas** (En directorio principal)
- **[../COMANDOS_INDIVIDUALES.md](../COMANDOS_INDIVIDUALES.md)** - Guía de archivos individuales
- **[../COMANDOS_RAPIDOS.md](../COMANDOS_RAPIDOS.md)** - Comandos básicos
- **[../QUICK_START.md](../QUICK_START.md)** - Inicio rápido

## 🎯 **Por Dónde Empezar**

### **👨‍💻 Si eres desarrollador:**
1. Leer **[../README.md](../README.md)** - Visión general
2. Seguir **[SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)** - Instalación
3. Usar **[../COMANDOS_INDIVIDUALES.md](../COMANDOS_INDIVIDUALES.md)** - Comandos diarios

### **🔧 Si necesitas configuración avanzada:**
1. **[MANUAL_USO.md](MANUAL_USO.md)** - Configuración completa
2. **[README_BOT_LOGS.md](README_BOT_LOGS.md)** - Detalles técnicos

### **⚡ Si solo quieres usar rápido:**
1. **[../QUICK_START.md](../QUICK_START.md)** - 5 minutos
2. **[../COMANDOS_RAPIDOS.md](../COMANDOS_RAPIDOS.md)** - Comandos esenciales

## 🎯 **Estructura Recomendada de Lectura**

```
📚 Documentación
├── 🚀 Inicio Rápido
│   ├── ../README.md (Visión general)
│   ├── ../QUICK_START.md (5 minutos)
│   └── ../COMANDOS_RAPIDOS.md (Comandos básicos)
│
├── 👨‍💻 Uso Diario
│   ├── ../COMANDOS_INDIVIDUALES.md (Guía principal)
│   └── SETUP_INSTRUCTIONS.md (Instalación)
│
└── 🔧 Avanzado
    ├── MANUAL_USO.md (Configuración completa)
    └── README_BOT_LOGS.md (Detalles técnicos)
```

## 📝 **Resumen de Funcionalidades**

### **🎯 Lo que hace el parser:**
- ✅ Convierte logs de Cloud Run en formato local
- ✅ Elimina 90% de metadatos HTTP inútiles
- ✅ Crea archivos individuales por sesión
- ✅ Limpieza automática (máximo 10 archivos)
- ✅ Análisis avanzado con 8 tipos de métricas

### **📁 Archivos que genera:**
- **Individuales**: `/logsGoogleCloud/session_*.txt`
- **Consolidado**: Solo con `--save-consolidated`
- **Limpieza**: Automática cada 10 archivos

### **🚀 Comando principal:**
```bash
python parse_bot_logs.py --hours 2
```

---

**💡 Tip**: Empieza por el **[README principal](../README.md)** para una visión completa del proyecto.