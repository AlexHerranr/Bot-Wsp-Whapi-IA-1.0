# 🚀 Comandos Rápidos - Bot Logs Parser

## 📋 Comandos Más Usados

### ⚡ Uso Básico
```bash
# Últimas 10 sesiones (RECOMENDADO)
botlogs

# Últimas 5 sesiones
botlogs --sessions 5

# Últimas 15 sesiones
botlogs --sessions 15
```

### 🎯 Filtros Específicos
```bash
# Solo errores
botlogs --errors-only

# Usuario específico
botlogs --user 573003913251

# Combinado: errores de un usuario
botlogs --user 573003913251 --errors-only
```

### 🕐 Por Tiempo (Modo Clásico)
```bash
# Últimas 6 horas
botlogs --hours 6

# Últimas 12 horas
botlogs --hours 12
```

### ⚙️ Configuración
```bash
# Cambiar límite de archivos guardados
botlogs --max-session-files 20

# No guardar archivos individuales
botlogs --no-individual-files

# No copiar al portapapeles
botlogs --no-copy
```

## 🔥 Para Recordar

### ✅ NUEVAS FUNCIONALIDADES (v2.0)
- **Default**: 10 sesiones (antes eran 2 horas)
- **Sin duplicados**: Solo crea archivos para sesiones nuevas
- **Archivos individuales**: Cada sesión en `logsGoogleCloud/`
- **Limpieza automática**: Mantiene solo las últimas 10 sesiones

### 💡 Casos de Uso Comunes

| Situación | Comando |
|-----------|---------|
| **Revisión diaria** | `botlogs` |
| **Error reportado** | `botlogs --errors-only` |
| **Usuario específico** | `botlogs --user 573003913251` |
| **Análisis profundo** | `botlogs --sessions 20` |
| **Debugging rápido** | `botlogs --sessions 3` |

### 🎯 Lo Que Dice el Sistema

```bash
# Primera vez del día
🔍 Buscando por sesiones: últimas 10 sesiones
📝 Detectadas 10 sesiones nuevas de 10 totales
✅ 10 sesiones nuevas guardadas en logsGoogleCloud/

# Segunda ejecución (sin sesiones nuevas)
📋 No hay sesiones nuevas para guardar (todas ya existen)

# Más tarde (con algunas sesiones nuevas)
📝 Detectadas 3 sesiones nuevas de 10 totales
✅ 3 sesiones nuevas guardadas en logsGoogleCloud/
```

## 🚨 Troubleshooting Rápido

```bash
# Error de permisos
gcloud auth login

# Error de proyecto
gcloud config set project gen-lang-client-0318357688

# Error de Python
pip install -r requirements.txt
```

---

**💡 TIP**: Usa `botlogs` sin parámetros para el 90% de casos. Es inteligente y eficiente. 