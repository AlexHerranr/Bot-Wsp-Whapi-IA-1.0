# 🤖 Bot Logs Parser

> **Herramienta de análisis rápido de logs para Google Cloud Run**

## 📋 Tabla de Contenidos

1. [¿Qué es esto?](#qué-es-esto)
2. [Instalación](#instalación)
3. [Uso Rápido](#uso-rápido)
4. [Guía Completa](#guía-completa)
5. [Ejemplos Prácticos](#ejemplos-prácticos)
6. [Troubleshooting](#troubleshooting)
7. [Archivos del Proyecto](#archivos-del-proyecto)

---

## ¿Qué es esto?

**Bot Logs Parser** es una herramienta que resuelve el problema más frustrante de Google Cloud Console: **analizar logs detallados**.

### 🚨 El Problema
- **Logs colapsados**: Cada entrada requiere un clic para ver detalles
- **Sin contexto**: Imposible ver qué pasó antes/después de un error
- **Copia limitada**: No puedes copiar fácilmente logs completos
- **Sin agrupación**: Los logs están mezclados, no agrupados por sesión

### ✅ Nuestra Solución
Replicamos la experiencia de **logs locales** donde TODO es visible inmediatamente:

```
=== NUEVA SESIÓN DEL BOT ===
🚀 [2025-07-10 12:09:55] INFO: 🌐 Servidor HTTP iniciado en 0.0.0.0:8080
🚀 [2025-07-10 12:09:55] INFO: 🤖 Bot completamente inicializado
👤 [2025-07-10 12:09:57] INFO: 7/10 [12:09] 📱 573003913251: "Yo de nuevo" 💬 ⏱ 10s...
ℹ️ [2025-07-10 12:10:05] INFO: 🔍 Buscando runs huérfanos después del reinicio...
=== FIN DE SESIÓN DEL BOT ===
```

### ⚡ Impacto Real
- **ANTES**: 15 minutos navegando Cloud Console
- **DESPUÉS**: 10 segundos con `botlogs`

---

## 🚀 Instalación

### Requisitos Previos
- ✅ **Python 3.7+** instalado
- ✅ **Google Cloud SDK** configurado
- ✅ **Acceso al proyecto** `gen-lang-client-0318357688`

### Instalación Rápida

```bash
# 1. Instalar dependencias
pip install -r requirements.txt

# 2. Verificar configuración
python parse_bot_logs.py --help

# 3. ¡Listo para usar!
```

### Verificación de Instalación

```bash
# Verificar Python
python --version

# Verificar Google Cloud SDK
gcloud --version
gcloud config get-value project

# Debería mostrar: gen-lang-client-0318357688
```

---

## ⚡ Uso Rápido

### Windows
```cmd
# Usar el script batch (recomendado)
.\botlogs.bat                    # Últimas 10 sesiones (nuevo default)

# Por número de sesiones (RECOMENDADO)
.\botlogs.bat --sessions 5       # Últimas 5 sesiones
.\botlogs.bat --sessions 15      # Últimas 15 sesiones

# Por tiempo (modo clásico)
.\botlogs.bat --hours 6          # Últimas 6 horas

# Filtros específicos
.\botlogs.bat --errors-only      # Solo errores
.\botlogs.bat --user 573003913251  # Usuario específico
```

### Linux/Mac
```bash
# Usar el script bash
./botlogs                        # Últimas 10 sesiones (nuevo default)

# Por número de sesiones (RECOMENDADO)
./botlogs --sessions 5           # Últimas 5 sesiones
./botlogs --sessions 15          # Últimas 15 sesiones

# Por tiempo (modo clásico)
./botlogs --hours 6              # Últimas 6 horas

# Filtros específicos
./botlogs --errors-only          # Solo errores
./botlogs --user 573003913251    # Usuario específico
```

### Python Directo
```bash
# Uso básico (últimas 10 sesiones)
python parse_bot_logs.py

# Por sesiones (RECOMENDADO)
python parse_bot_logs.py --sessions 5
python parse_bot_logs.py --sessions 15

# Por tiempo
python parse_bot_logs.py --hours 6

# Con filtros
python parse_bot_logs.py --errors-only
python parse_bot_logs.py --user 573003913251
```

---

## 📖 Guía Completa

### Comandos Básicos

| Comando | Descripción |
|---------|-------------|
| `botlogs` | **Últimas 10 sesiones** (nuevo default) |
| `botlogs --sessions 5` | Últimas 5 sesiones |
| `botlogs --sessions 15` | Últimas 15 sesiones |
| `botlogs --hours 6` | Últimas 6 horas (modo clásico) |
| `botlogs --errors-only` | Solo sesiones con errores |
| `botlogs --user 573003913251` | Logs de usuario específico |

### Opciones Avanzadas

```bash
# Buscar sesión específica
python parse_bot_logs.py --session session-1234567890

# Filtrar por usuario con sesiones específicas
python parse_bot_logs.py --user 573003913251 --sessions 5

# Configurar límite de archivos guardados
python parse_bot_logs.py --max-session-files 15

# No copiar al portapapeles ni guardar archivo
python parse_bot_logs.py --no-copy --no-save

# No guardar archivos individuales (solo consolidado)
python parse_bot_logs.py --no-individual-files

# Obtener más logs (default: 5000)
python parse_bot_logs.py --limit 10000
```

### Características Principales

#### 🎯 Detección Automática de Sesiones
- **Inicio**: "Servidor HTTP iniciado", "Bot completamente inicializado"
- **Fin**: Errores críticos, >5 minutos sin actividad

#### 🌈 Colores y Formato
- 🚀 **Verde**: Inicios de sesión exitosos
- ⚠️ **Amarillo**: Warnings y alertas
- 🔴 **Rojo**: Errores críticos
- 👤 **Azul**: Mensajes de usuarios
- ℹ️ **Gris**: Logs informativos

#### 📊 Análisis por Sesión
- Total de mensajes procesados
- Usuarios únicos que interactuaron
- Errores encontrados (con contexto)
- Duración de la sesión

#### 🕐 Timestamps en Hora Colombia
Todos los timestamps se convierten automáticamente de UTC a Colombia (UTC-5).

#### 🆕 Funcionalidades Nuevas (v2.0)

##### 🎯 Búsqueda por Sesiones (RECOMENDADO)
- **Antes**: `--hours 6` (impreciso, puede incluir sesiones incompletas)
- **Ahora**: `--sessions 10` (exacto, siempre sesiones completas)
- **Ventaja**: Obtienes exactamente el número de sesiones que necesitas

##### 🧠 Detección Inteligente de Duplicados
- **Problema resuelto**: No crea archivos duplicados
- **Cómo funciona**: Detecta sesiones ya guardadas y solo procesa las nuevas
- **Resultado**: Eficiencia máxima, sin archivos redundantes

```bash
# Primera ejecución: crea 10 archivos
botlogs

# Segunda ejecución inmediata: 
# "📋 No hay sesiones nuevas para guardar (todas ya existen)"

# Horas después con nuevas sesiones:
# "📝 Detectadas 3 sesiones nuevas de 10 totales"
```

##### 📁 Archivos Individuales por Sesión
- **Automático**: Cada sesión se guarda en `logsGoogleCloud/session_FECHA_HORA_ID.txt`
- **Organizado**: Igual que tus logs locales
- **Limpieza automática**: Solo mantiene las últimas 10 sesiones (configurable)

##### ⚙️ Configuración Flexible
```bash
# Cambiar número de sesiones
botlogs --sessions 5          # Solo 5 sesiones

# Cambiar límite de archivos
botlogs --max-session-files 20  # Mantener 20 archivos

# Deshabilitar archivos individuales
botlogs --no-individual-files   # Solo archivo consolidado
```

#### 🔧 Extracción Técnica Avanzada (v2.1)

##### 🎯 Problema Resuelto
Los logs de Cloud Run contienen la misma información técnica que los logs locales, pero enterrada en diferentes formatos JSON. La versión anterior perdía información crítica para debugging.

##### 🛠️ Información Técnica Extraída
- **FUNCTION_CALLING_START**: Funciones y argumentos completos
- **FUNCTION_EXECUTING**: Nombre de función y parámetros
- **BEDS24_REQUEST**: Fechas y parámetros de consulta
- **BEDS24_RESPONSE_DETAIL**: Respuesta completa (no preview)
- **OPENAI_REQUEST**: Estados detallados (adding_message, creating_run, run_started)
- **Thread IDs**: Identificadores completos (thread_xyz...)
- **Run IDs**: Identificadores completos (run_abc...)
- **Errores**: Contexto completo con stack traces

##### 🔍 Comandos de Debugging Avanzado
```bash
# Análisis de logs crudos para debugging
python parse_bot_logs.py --analyze-raw --hours 2

# Validar extracción técnica
python parse_bot_logs.py --sessions 10 --validate-extraction

# Análisis normal con extracción técnica mejorada
python parse_bot_logs.py --sessions 10
```

##### 🏗️ Arquitectura de Extracción (5 Etapas)
1. **analyze_raw_logs()**: Debugging temporal de logs crudos
2. **extract_technical_logs()**: Búsqueda en TODAS las ubicaciones JSON
3. **reconstruct_technical_event()**: Reconstrucción en formato local
4. **parse_cloud_log()**: Parser mejorado con nuevos extractores
5. **validate_extraction()**: Verificación de extracción completa

##### 🎯 Resultado Final
Los logs procesados se ven **EXACTAMENTE** como los logs locales, con toda la información técnica pero sin la basura HTTP de Cloud Run.

---

## 🎯 Ejemplos Prácticos

### Caso 1: Usuario reporta "El bot no me respondió"
```bash
# ANTES: 15 minutos buscando en Cloud Console
# AHORA: 5 segundos
botlogs --user 573003913251
```

### Caso 2: Error en producción
```bash
# ANTES: Navegar entre cientos de logs colapsados
# AHORA: Solo sesiones con errores
botlogs --errors-only
```

### Caso 3: Análisis post-mortem
```bash
# ANTES: Exportar a BigQuery, escribir queries SQL
# AHORA: Últimas 20 sesiones completas
botlogs --sessions 20
```

### Caso 4: Debugging específico
```bash
# Últimas 5 sesiones con errores de un usuario
botlogs --user 573003913251 --sessions 5 --errors-only
```

### Caso 5: Monitoreo diario (NUEVO)
```bash
# Primera vez del día: obtiene todas las sesiones nuevas
botlogs

# Ejecutar cada hora: solo obtiene sesiones nuevas
# "📝 Detectadas 2 sesiones nuevas de 10 totales"
botlogs
```

---

## 🔧 Troubleshooting

### Error: "gcloud CLI no está instalado"
```bash
# Instalar Google Cloud SDK
# https://cloud.google.com/sdk/docs/install

# Verificar instalación
gcloud --version

# Autenticar
gcloud auth login

# Configurar proyecto
gcloud config set project gen-lang-client-0318357688
```

### Error: "No se pudieron obtener logs"
```bash
# Verificar permisos
gcloud auth list

# Verificar proyecto
gcloud config get-value project

# Probar comando manual
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bot-wsp-whapi-ia" --limit=10
```

### Error: "Python no se encuentra"
```bash
# En Windows, reinstalar Python marcando "Add to PATH"
# Reiniciar terminal/PowerShell
# Usar 'py' en lugar de 'python' si es necesario
```

### Error: "pyperclip no funciona"
```bash
# En Linux, instalar dependencias adicionales
sudo apt-get install xclip  # o xsel

# En Windows/macOS, debería funcionar automáticamente
```

---

## 📁 Archivos del Proyecto

```
tools/bot-logs-parser/
├── parse_bot_logs.py      # 🐍 Script principal Python
├── botlogs.bat           # 🪟 Script Windows (uso fácil)
├── botlogs               # 🐧 Script Linux/Mac (uso fácil)
├── requirements.txt      # 📦 Dependencias Python
├── README.md            # 📖 Este archivo
├── MANUAL_USO.md        # 📋 Manual detallado de uso
└── SETUP_INSTRUCTIONS.md # ⚙️ Instrucciones de instalación
```

### Descripción de Archivos

- **`parse_bot_logs.py`**: Script principal con toda la lógica
- **`botlogs.bat`**: Wrapper para Windows (uso simplificado)
- **`botlogs`**: Wrapper para Linux/Mac (uso simplificado)
- **`requirements.txt`**: Solo contiene `pyperclip==1.8.2`
- **`README.md`**: Documentación principal (este archivo)
- **`MANUAL_USO.md`**: Manual detallado con ejemplos
- **`SETUP_INSTRUCTIONS.md`**: Guía paso a paso de instalación

---

## 🎯 Filosofía del Proyecto

### Principios de Diseño
1. **Velocidad sobre todo**: Un comando, resultados inmediatos
2. **Contexto es clave**: Siempre mostrar qué pasó antes y después
3. **Formato familiar**: Igual que los logs locales que ya conocemos
4. **Copia fácil**: Todo al portapapeles automáticamente
5. **Sin fricción**: No login, no navegación, no clicks

### Métricas de Éxito

| Métrica | ANTES (Cloud Console) | DESPUÉS (Bot Logs Parser) |
|---------|----------------------|---------------------------|
| Tiempo para encontrar error | 5-15 minutos | <30 segundos |
| Contexto del error | Manual, incompleto | Automático, completo |
| Frustración del desarrollador | 8/10 | 2/10 |
| Probabilidad de missing context | Alta | Casi nula |

---

## 🤝 Contribuir

### Agregar nuevos patrones de detección
```python
# Editar parse_bot_logs.py, clase LogEntry
def is_session_start(self) -> bool:
    patterns = [
        r'Tu nuevo patrón aquí',
        # ... patrones existentes
    ]
```

### Agregar nuevos filtros
```python
# Editar función filter_sessions() para criterios adicionales
```

---

## 📄 Licencia

Este proyecto es parte del sistema Bot WhatsApp y está diseñado específicamente para resolver problemas de debugging en Google Cloud Run.

---

## 🆘 Soporte

**¿Preguntas? ¿Sugerencias? ¿Encontraste un bug?**

El objetivo es que debuggear en producción sea **TAN FÁCIL** como en desarrollo local. Si no es así, necesitamos mejorarlo.

---

## 🏆 Conclusión

**Bot Logs Parser** transforma la experiencia de debugging de esto:

```
😫 15 minutos navegando en Cloud Console
😫 Clicks infinitos expandiendo logs
😫 Contexto perdido
😫 Imposible copiar/compartir
```

A esto:

```
😎 botlogs
😎 Logs completos en 10 segundos
😎 Contexto automático
😎 Copia al portapapeles lista
```

¡Debugging en producción ahora es **TAN FÁCIL** como en desarrollo local! 🚀 