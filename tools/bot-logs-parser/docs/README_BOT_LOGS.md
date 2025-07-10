# Bot Logs Parser - Herramienta de Análisis Rápido

## ¿Por qué existe esta herramienta?

### El Problema 🚨
Google Cloud Logging es poderoso pero tiene una UX terrible para debugging:
- **Logs colapsados**: Cada entrada requiere un clic para ver detalles
- **Sin contexto**: Imposible ver qué pasó antes/después de un error
- **Copia limitada**: No puedes copiar fácilmente logs completos
- **Sin agrupación**: Los logs están mezclados, no agrupados por sesión

### Nuestra Solución ✅
Replicamos la experiencia de logs locales donde TODO es visible inmediatamente:
```
=== NUEVA SESIÓN DEL BOT ===
[Todos los logs de esa sesión, completos y formateados]
=== FIN DE SESIÓN ===
```

### Casos de Uso Reales

**1. Usuario reporta: "El bot no me respondió"**
- Antes: 15 minutos buscando en Cloud Console, expandiendo logs uno por uno
- Ahora: `botlogs user 573003913251` → Ver toda la conversación en 5 segundos

**2. Error en producción**
- Antes: Navegar entre cientos de logs colapsados buscando el error
- Ahora: `botlogs errors` → Solo sesiones con errores, con contexto completo

**3. Análisis post-mortem**
- Antes: Exportar a BigQuery, escribir queries SQL
- Ahora: `botlogs --hours 24` → Resumen de todas las sesiones del día

## Instalación

### Requisitos
1. **Python 3.7+** instalado
2. **Google Cloud SDK** instalado y configurado
3. **Acceso al proyecto** `gen-lang-client-0318357688`

### Instalación rápida
```bash
# Instalar dependencias
pip install -r requirements.txt

# Verificar que gcloud está configurado
gcloud auth list
gcloud config get-value project

# Probar el script
python parse_bot_logs.py --help
```

### Para Windows
```cmd
# Usar el script batch
botlogs.bat help
```

## Uso

### Comandos básicos
```bash
# Últimas 2 horas (por defecto)
botlogs

# Últimas 6 horas
botlogs 6

# Solo errores
botlogs errors

# Logs de un usuario específico
botlogs user 573003913251

# Últimas 24 horas con errores
botlogs --hours 24 --errors-only
```

### Opciones avanzadas
```bash
# Buscar sesión específica
botlogs --session session-1234567890

# Filtrar por usuario en las últimas 4 horas
botlogs --user 573003913251 --hours 4

# No copiar al portapapeles ni guardar archivo
botlogs --no-copy --no-save

# Obtener más logs (default: 5000)
botlogs --limit 10000
```

## Características

### 🎯 Detección Automática de Sesiones
El script detecta automáticamente cuándo inicia y termina una sesión del bot:

**Inicio de sesión:**
- "Servidor HTTP iniciado"
- "Bot completamente inicializado"
- "SERVER_START"
- Más de 5 minutos sin actividad

**Fin de sesión:**
- Error crítico seguido de silencio
- Más de 5 minutos sin actividad
- Patrones de cierre detectados

### 🌈 Colores y Formato
- 🚀 **Verde**: Inicios de sesión exitosos
- ⚠️ **Amarillo**: Warnings y alertas
- 🔴 **Rojo**: Errores críticos
- 👤 **Azul**: Mensajes de usuarios
- ℹ️ **Gris**: Logs informativos

### 📊 Análisis por Sesión
Para cada sesión se extrae:
- Total de mensajes procesados
- Usuarios únicos que interactuaron
- Errores encontrados (con contexto)
- Tiempo de respuesta promedio
- Warnings o buffers vacíos
- Duración de la sesión

### 🕐 Timestamps en Hora Colombia
Todos los timestamps se convierten automáticamente de UTC a hora Colombia (UTC-5).

### 📋 Copia Automática
Los logs se copian automáticamente al portapapeles para fácil sharing.

### 💾 Guardado Automático
Se guarda un archivo `bot_sessions_[timestamp].txt` con todos los logs.

### ⚡ Cache Inteligente
Los logs se cachean por 1 minuto para evitar llamadas innecesarias a Google Cloud.

## Formato de Salida

### Sesión Individual
```
=== NUEVA SESIÓN DEL BOT ===
Timestamp: 2024-01-15 14:30:25 (Colombia)
Session ID: session-1705339825
Deployment: bot-wsp-whapi-ia-00123-abc
=============================
🚀 [2024-01-15 14:30:25] INFO: Servidor HTTP iniciado
ℹ️ [2024-01-15 14:30:26] INFO: Bot completamente inicializado
👤 [2024-01-15 14:30:45] INFO: 👤 Procesando mensaje de usuario 573003913251
🔴 [2024-01-15 14:31:02] ERROR: Error en procesamiento OpenAI
=============================
=== FIN DE SESIÓN DEL BOT ===
Timestamp: 2024-01-15 14:35:30 (Colombia)
Session ID: session-1705339825
Duración: 0:05:05
Eventos procesados: 3
Usuarios únicos: 1
Errores: 1
Warnings: 0
=============================
```

### Resumen Global
```
=== RESUMEN DE SESIONES ===
Total sesiones: 5
Sesiones con errores: 2
Usuarios únicos totales: 12
Mensajes procesados: 47
Total errores: 3
=============================
```

## Filosofía de Diseño

1. **Velocidad sobre todo**: Un comando, resultados inmediatos
2. **Contexto es clave**: Siempre mostrar qué pasó antes y después
3. **Formato familiar**: Igual que los logs locales que ya conocemos
4. **Copia fácil**: Todo al portapapeles automáticamente
5. **Sin fricción**: No login, no navegación, no clicks

## Métricas de Impacto

### ANTES (con Cloud Console):
- Tiempo para encontrar un error: 5-15 minutos
- Tiempo para entender el contexto: 5-10 minutos adicionales  
- Frustración del desarrollador: 8/10
- Probabilidad de missing context: Alta

### DESPUÉS (con este script):
- Tiempo para encontrar un error: <30 segundos
- Contexto incluido automáticamente: 0 minutos adicionales
- Frustración del desarrollador: 2/10  
- Probabilidad de missing context: Casi nula

**ROI**: Una sola sesión de debugging ahorrada justifica el tiempo de desarrollo.

## Troubleshooting

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

### Error: "pyperclip no funciona"
```bash
# En Linux, instalar dependencias adicionales
sudo apt-get install xclip  # o xsel

# En Windows, debería funcionar automáticamente
# En macOS, debería funcionar automáticamente
```

## Contribuir

### Agregar nuevos patrones de detección
Editar la clase `LogEntry` en `parse_bot_logs.py`:
```python
def is_session_start(self) -> bool:
    patterns = [
        r'Tu nuevo patrón aquí',
        # ... patrones existentes
    ]
    return any(re.search(pattern, self.message, re.IGNORECASE) for pattern in patterns)
```

### Agregar nuevos filtros
Editar la función `filter_sessions()` para añadir criterios adicionales.

### Mejorar detección de usuarios
Editar `is_user_message()` para detectar nuevos patrones de usuarios.

## Licencia

Este script es parte del proyecto Bot WhatsApp y está diseñado específicamente para resolver problemas de debugging en Google Cloud Run.

---

**¿Preguntas? ¿Sugerencias? ¿Encontraste un bug?**

El objetivo es que debuggear en producción sea TAN FÁCIL como en desarrollo local. Si no es así, necesitamos mejorarlo. 