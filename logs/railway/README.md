# 📥 Carpeta de Descargas Railway

Esta carpeta contiene logs descargados manualmente desde Railway.

## 📁 Contenido Típico

```
railway/
├── README.md                           # Esta documentación
├── test-sample.log                     # Muestras de prueba
├── railway-logs-2025-08-05T20-45-01.log  # Descargas manuales
└── railway-logs-json-*.json           # Descargas en formato JSON
```

## 🚀 Comandos Rápidos

```bash
# Desde la raíz del proyecto:

# Descargar muestra rápida (20 líneas)
railway logs --deployment | head -20 > logs/railway/sample.log

# Descargar logs de última hora
npm run logs:download:1h

# Ver estadísticas de archivos aquí
npm run logs:stats
```

## 📊 Tipos de Archivos

### **Muestras Rápidas**
- `test-sample.log` - Primeras 20 líneas de Railway
- `sample-*.log` - Muestras manuales

### **Descargas Completas**  
- `railway-logs-{timestamp}.log` - Descarga completa con header
- `railway-logs-json-{timestamp}.json` - Formato JSON original

## 🔍 Análisis Rápido

### **Buscar Errores**
```bash
grep "\[ERROR\]" logs/railway/*.log
```

### **Ver Milestones**
```bash
grep "\[MILESTONE\]" logs/railway/*.log
```

### **Contar Mensajes por Usuario**
```bash
grep "\[MSG_RX\]" logs/railway/*.log | cut -d' ' -f3 | sort | uniq -c
```

## 🧹 Limpieza Automática

Los archivos aquí se limpian automáticamente:
- **Máximo**: 10 archivos mantenidos
- **Criterio**: Por fecha de modificación (más recientes)
- **Trigger**: Al ejecutar `npm run logs:download`

---

**💡 Tip**: Para logs automáticos cada 500 líneas, revisa la carpeta padre `logs/` donde se generan los chunks automáticos.