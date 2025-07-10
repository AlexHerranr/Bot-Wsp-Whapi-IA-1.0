# 📋 Manual de Uso - Bot Logs Parser

## 🎯 Guía Rápida de Inicio

### ⚡ Comandos Más Usados

```bash
# Los 4 comandos que usarás el 90% del tiempo
.\botlogs.bat                     # Últimas 2 horas
.\botlogs.bat errors              # Solo errores
.\botlogs.bat user 573003913251   # Logs de usuario específico
.\botlogs.bat 6                   # Últimas 6 horas
```

---

## 📖 Guía Completa de Comandos

### 1. Comandos Básicos

#### Windows (Recomendado)
```cmd
# Uso básico
.\botlogs.bat

# Variaciones comunes
.\botlogs.bat 1          # Última hora
.\botlogs.bat 6          # Últimas 6 horas
.\botlogs.bat 24         # Últimas 24 horas
.\botlogs.bat errors     # Solo sesiones con errores
.\botlogs.bat user 573003913251  # Logs de usuario específico
```

#### Linux/Mac
```bash
# Uso básico
./botlogs

# Variaciones comunes
./botlogs 1              # Última hora
./botlogs 6              # Últimas 6 horas
./botlogs 24             # Últimas 24 horas
./botlogs errors         # Solo sesiones con errores
./botlogs user 573003913251  # Logs de usuario específico
```

#### Python Directo
```bash
# Uso básico
python parse_bot_logs.py

# Con opciones específicas
python parse_bot_logs.py --hours 6
python parse_bot_logs.py --errors-only
python parse_bot_logs.py --user 573003913251
python parse_bot_logs.py --no-copy --no-save
```

### 2. Opciones Avanzadas

```bash
# Buscar sesión específica
python parse_bot_logs.py --session session-1234567890

# Combinaciones útiles
python parse_bot_logs.py --user 573003913251 --hours 4 --errors-only
python parse_bot_logs.py --hours 12 --limit 10000
python parse_bot_logs.py --hours 1 --no-copy --no-save
```

### 3. Tabla de Opciones Completa

| Opción | Descripción | Ejemplo |
|--------|-------------|---------|
| `--hours` | Horas hacia atrás | `--hours 6` |
| `--user` | Filtrar por usuario | `--user 573003913251` |
| `--errors-only` | Solo sesiones con errores | `--errors-only` |
| `--session` | Buscar sesión específica | `--session session-123` |
| `--no-copy` | No copiar al portapapeles | `--no-copy` |
| `--no-save` | No guardar en archivo | `--no-save` |
| `--limit` | Límite de logs | `--limit 10000` |

---

## 🎯 Casos de Uso Prácticos

### Caso 1: "El bot no responde"
```bash
# Paso 1: Ver actividad reciente
.\botlogs.bat 1

# Paso 2: Si no hay actividad, buscar errores
.\botlogs.bat errors

# Paso 3: Si hay un usuario específico con problemas
.\botlogs.bat user 573003913251
```

### Caso 2: "Error reportado por usuario"
```bash
# Ver logs del usuario específico
.\botlogs.bat user 573003913251

# Si necesitas más contexto temporal
python parse_bot_logs.py --user 573003913251 --hours 6
```

### Caso 3: "Bot actuó raro esta mañana"
```bash
# Ver las últimas 8 horas
.\botlogs.bat 8

# Solo errores de las últimas 8 horas
python parse_bot_logs.py --hours 8 --errors-only
```

### Caso 4: "Análisis post-mortem"
```bash
# Análisis completo del día
python parse_bot_logs.py --hours 24

# Solo problemas del día
python parse_bot_logs.py --hours 24 --errors-only
```

### Caso 5: "Debugging en vivo"
```bash
# Monitoreo en tiempo real (sin guardar/copiar)
python parse_bot_logs.py --hours 1 --no-copy --no-save

# Repetir cada pocos minutos para ver actividad nueva
```

---

## 🔍 Interpretando los Resultados

### Estructura de una Sesión
```
=== NUEVA SESIÓN DEL BOT ===
Timestamp: 2025-07-10 12:09:55 (Colombia)
Session ID: session-1752149395
Deployment: bot-wsp-whapi-ia-00032-xc6
==================================================
🚀 [2025-07-10 12:09:55] INFO: 🌐 Servidor HTTP iniciado en 0.0.0.0:8080
🚀 [2025-07-10 12:09:55] INFO: 🤖 Bot completamente inicializado
👤 [2025-07-10 12:09:57] INFO: 7/10 [12:09] 📱 573003913251: "Yo de nuevo" 💬 ⏱ 10s...
ℹ️ [2025-07-10 12:10:05] INFO: 🔍 Buscando runs huérfanos después del reinicio...
==================================================
=== FIN DE SESIÓN DEL BOT ===
Timestamp: 2025-07-10 12:15:12 (Colombia)
Session ID: session-1752149395
Duración: 0:05:16
Eventos procesados: 8
Usuarios únicos: 1
Errores: 2
Warnings: 0
==================================================
```

### Iconos y Colores

| Icono | Color | Significado |
|-------|-------|-------------|
| 🚀 | Verde | Inicio exitoso del bot |
| 👤 | Azul | Mensaje de usuario |
| 🔴 | Rojo | Error crítico |
| ⚠️ | Amarillo | Warning/Alerta |
| ℹ️ | Gris | Información general |

### Patrones Importantes a Buscar

#### ✅ Sesión Saludable
```
🚀 Servidor HTTP iniciado
🚀 Bot completamente inicializado
👤 Mensajes de usuarios
ℹ️ Procesamiento normal
```

#### ❌ Sesión Problemática
```
🚀 Servidor HTTP iniciado
🔴 Error en configuración
🔴 Timeout en OpenAI
👤 Usuario sin respuesta
```

#### ⚠️ Sesión con Warnings
```
🚀 Servidor HTTP iniciado
⚠️ Buffer vacío o inexistente
👤 Usuario procesado con demora
⚠️ Retry en procesamiento
```

---

## 📊 Resumen de Sesiones

Al final de cada análisis verás:

```
=== RESUMEN DE SESIONES ===
Total sesiones: 3
Sesiones con errores: 1
Usuarios únicos totales: 2
Mensajes procesados: 15
Total errores: 3
==================================================
```

### Interpretación del Resumen

- **Total sesiones**: Cuántas veces se reinició el bot
- **Sesiones con errores**: Cuántas tuvieron problemas
- **Usuarios únicos**: Cuántos usuarios diferentes interactuaron
- **Mensajes procesados**: Total de mensajes atendidos
- **Total errores**: Suma de todos los errores encontrados

---

## 🎯 Tips y Trucos

### 1. Uso Eficiente
```bash
# Para debugging rápido (sin archivos)
python parse_bot_logs.py --hours 1 --no-copy --no-save

# Para reportes (con archivos)
python parse_bot_logs.py --hours 24  # Guarda automáticamente
```

### 2. Filtros Combinados
```bash
# Usuario específico con errores
python parse_bot_logs.py --user 573003913251 --errors-only

# Últimas 4 horas, solo errores, sin guardar
python parse_bot_logs.py --hours 4 --errors-only --no-save
```

### 3. Análisis Temporal
```bash
# Comparar actividad por horas
.\botlogs.bat 1    # Última hora
.\botlogs.bat 6    # Últimas 6 horas
.\botlogs.bat 24   # Últimas 24 horas
```

### 4. Debugging Específico
```bash
# Buscar patrones específicos en los logs
python parse_bot_logs.py --hours 6 | grep "timeout"
python parse_bot_logs.py --hours 6 | grep "OpenAI"
python parse_bot_logs.py --hours 6 | grep "573003913251"
```

---

## 🔧 Solución de Problemas Comunes

### Problema: "No se encontraron logs"
```bash
# Verificar que el bot esté activo
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bot-wsp-whapi-ia" --limit=5

# Aumentar el rango de tiempo
python parse_bot_logs.py --hours 24
```

### Problema: "Muchos logs irrelevantes"
```bash
# Filtrar solo errores
.\botlogs.bat errors

# Filtrar por usuario específico
.\botlogs.bat user 573003913251
```

### Problema: "Logs muy antiguos"
```bash
# Aumentar límite de logs
python parse_bot_logs.py --limit 10000

# Aumentar rango temporal
python parse_bot_logs.py --hours 48
```

---

## 📝 Ejemplos de Salida Real

### Ejemplo 1: Bot Funcionando Normal
```
=== NUEVA SESIÓN DEL BOT ===
Timestamp: 2025-07-10 12:09:55 (Colombia)
Session ID: session-1752149395
Deployment: bot-wsp-whapi-ia-00032-xc6
==================================================
🚀 [2025-07-10 12:09:55] INFO: 🌐 Servidor HTTP iniciado en 0.0.0.0:8080
🚀 [2025-07-10 12:09:55] INFO: 🤖 Bot completamente inicializado
👤 [2025-07-10 12:09:57] INFO: 7/10 [12:09] 📱 573003913251: "Hola" 💬 ⏱ 10s...
ℹ️ [2025-07-10 12:10:05] INFO: 7/10 [12:10] [BOT] ✅ Completado (8.2s) 💬 "¡Hola! ¿En qué puedo ayudarte?"
==================================================
=== FIN DE SESIÓN DEL BOT ===
Duración: 0:05:16
Eventos procesados: 2
Usuarios únicos: 1
Errores: 0
Warnings: 0
==================================================
```

### Ejemplo 2: Bot con Errores
```
=== NUEVA SESIÓN DEL BOT ===
Timestamp: 2025-07-10 12:15:30 (Colombia)
Session ID: session-1752149730
==================================================
🚀 [2025-07-10 12:15:30] INFO: 🌐 Servidor HTTP iniciado en 0.0.0.0:8080
🔴 [2025-07-10 12:15:31] ERROR: ❌ Error en OpenAI: Timeout after 30s
👤 [2025-07-10 12:15:35] INFO: 7/10 [12:15] 📱 573003913251: "¿Hola?" 💬 ⏱ 10s...
🔴 [2025-07-10 12:15:45] ERROR: ❌ Error procesando mensaje: OpenAI timeout
==================================================
=== FIN DE SESIÓN DEL BOT ===
Duración: 0:02:15
Eventos procesados: 1
Usuarios únicos: 1
Errores: 2
Warnings: 0
==================================================
```

---

## 🚀 Flujo de Trabajo Recomendado

### 1. Debugging Diario
```bash
# Cada mañana, revisar la noche anterior
.\botlogs.bat 12

# Si hay errores, investigar
.\botlogs.bat errors
```

### 2. Respuesta a Incidentes
```bash
# Paso 1: Actividad reciente
.\botlogs.bat 1

# Paso 2: Contexto amplio
.\botlogs.bat 6

# Paso 3: Análisis específico
.\botlogs.bat user [ID_USUARIO]
```

### 3. Análisis Post-Mortem
```bash
# Análisis completo del período problemático
python parse_bot_logs.py --hours 24

# Exportar para revisión
python parse_bot_logs.py --hours 24 > analisis_completo.txt
```

---

## 🎯 Conclusión

**Bot Logs Parser** te permite:

✅ **Debugging en 10 segundos** en lugar de 15 minutos
✅ **Contexto completo** automático
✅ **Logs organizados** por sesiones
✅ **Filtros inteligentes** para encontrar problemas específicos
✅ **Formato familiar** como logs locales

¡Úsalo cada vez que necesites entender qué está pasando con tu bot en producción! 🚀 