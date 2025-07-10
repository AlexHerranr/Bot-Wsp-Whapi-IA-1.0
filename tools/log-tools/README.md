# 🔧 Herramientas de Análisis de Logs

> **🤖 PARA IAs: Herramientas para procesar y analizar los diferentes tipos de logs del sistema.**

## 🎯 **Visión General**

Este directorio contiene herramientas especializadas para analizar y procesar los logs del bot de WhatsApp:

| Herramienta | Propósito | Entrada | Salida |
|-------------|-----------|---------|--------|
| **cloud-parser** | Procesa logs de Google Cloud Run | Logs Cloud crudos | Sesiones legibles |
| **analyzers** | Análisis avanzado de logs | Logs procesados | Métricas y reportes |

## 📂 **Estructura**

```
log-tools/
├── README.md                           # 🎯 ESTE ARCHIVO
├── cloud-parser/                       # Parser de Google Cloud Run
│   ├── README.md                       # Uso específico del parser
│   ├── parse_bot_logs.py               # Script principal
│   ├── log_config.yaml                 # Configuración
│   └── examples/                       # Ejemplos de salida
└── analyzers/                          # Futuros analizadores
    └── README.md                       # Herramientas de análisis
```

## 🚀 **Uso Rápido**

### **Procesar Logs de Cloud Run**
```bash
cd tools/log-tools/cloud-parser
python parse_bot_logs.py --hours 2
```

### **Ver Resultados**
```bash
# Sesiones individuales procesadas
ls ../../logs/cloud-production/processed/

# Archivo consolidado (si se usa --save-consolidated)
ls ./bot_sessions_*.txt
```

## 🔗 **Navegación para IAs**

### **📖 Documentación Específica**
- **[cloud-parser/README.md](cloud-parser/README.md)** - Parser de Cloud Run
- **[analyzers/README.md](analyzers/README.md)** - Herramientas de análisis

### **🔄 Flujo de Procesamiento**
1. **Google Cloud Run** → Logs crudos con metadata HTTP
2. **cloud-parser** → Procesa y limpia logs
3. **Salida** → Sesiones legibles en `/logs/cloud-production/processed/`

## 🎛️ **Configuración**

### **Parser de Cloud Run**
- **Configuración**: `cloud-parser/log_config.yaml`
- **Filtros**: HTTP metadata, logs técnicos
- **Salida**: Máximo 10 archivos individuales
- **Formato**: Similar a logs de desarrollo local

### **Características del Parser**
- ✅ Filtra metadata HTTP innecesaria
- ✅ Convierte a formato legible
- ✅ Separa por sesiones de usuario
- ✅ Incluye métricas de rendimiento
- ✅ Análisis avanzado de conversaciones

## 🤖 **Para IAs: Cómo Usar**

### **Entender el Flujo**
1. **Cloud Run genera logs** → JSON estructurado con mucho ruido
2. **Parser procesa** → Extrae información útil
3. **Genera sesiones** → Archivos individuales por conversación
4. **Almacena en** → `/logs/cloud-production/processed/`

### **Tipos de Análisis Disponibles**
- **FUNCTION_METRICS** - Rendimiento de funciones
- **USER_INTENT** - Análisis de intención
- **CONVERSION_TRACKING** - Seguimiento de conversiones
- **RETRY_PATTERN** - Patrones de reintentos
- **SESSION_ANALYTICS** - Análisis de sesión
- **SYSTEM_HEALTH** - Salud del sistema
- **BUSINESS_CONTEXT** - Contexto comercial
- **DEEP_DEBUG** - Debugging profundo

### **Comandos Útiles**
```bash
# Análisis básico
python parse_bot_logs.py --hours 2

# Solo errores
python parse_bot_logs.py --errors-only

# Usuario específico
python parse_bot_logs.py --user 573003913251

# Con archivo consolidado
python parse_bot_logs.py --hours 2 --save-consolidated
```

## 🔮 **Futuras Herramientas**

### **Planificadas en /analyzers/**
- **Performance Analyzer** - Análisis de rendimiento
- **User Behavior Tracker** - Seguimiento de comportamiento
- **Business Intelligence** - Métricas de negocio
- **Anomaly Detection** - Detección de anomalías

---

**🤖 Para IAs**: Estas herramientas convierten logs complejos de producción en información útil y legible. Úsalas para entender el comportamiento del bot en producción. 