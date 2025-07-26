# ⚡ Claude Code - Comandos Slash

> **Referencia completa de comandos slash para optimizar tu flujo de trabajo**

Los comandos slash son atajos que te permiten ejecutar acciones específicas rápidamente durante tu sesión con Claude Code.

## 🎯 Comandos Esenciales

### `/model`
Cambiar el modelo de IA durante la conversación.
```bash
/model
# Abre selector de modelos
# → claude-3-5-haiku (rápido)
# → claude-3-5-sonnet-20241022 (balanceado)
# → claude-4-0-sonnet (avanzado)
```

### `/help`
Obtener ayuda y información sobre comandos disponibles.
```bash
/help
# Muestra todos los comandos disponibles
```

### `/clear`
Limpiar el historial de la conversación actual.
```bash
/clear
# ⚠️ Pierde todo el contexto anterior
# Útil para empezar fresh en un nuevo tema
```

### `/exit`
Salir de la sesión actual de Claude Code.
```bash
/exit
# Guarda el estado y cierra la sesión
```

## 🔄 Comandos de Gestión de Sesión

### `/resume`
Continuar una sesión anterior.
```bash
/resume
# Restaura la última conversación
# Mantiene todo el contexto previo
```

### `/save`
Guardar el estado actual de la sesión.
```bash
/save
# Crea un punto de restauración
# Útil antes de cambios grandes
```

### `/history`
Ver el historial de comandos y acciones.
```bash
/history
# Muestra las últimas acciones realizadas
# Útil para revisar qué se ha hecho
```

## 📂 Comandos de Proyecto

### `/analyze`
Análisis rápido del proyecto actual.
```bash
/analyze
# Escanea la estructura del proyecto
# Identifica problemas comunes
# Sugiere mejoras
```

### `/status`
Estado actual del repositorio y archivos.
```bash
/status
# Equivalente a git status
# Muestra archivos modificados
# Estado del working directory
```

### `/build`
Construir el proyecto.
```bash
/build
# Ejecuta npm run build o script equivalente
# Verifica que todo compile correctamente
```

### `/test`
Ejecutar tests del proyecto.
```bash
/test
# Ejecuta npm test o script equivalente
# Muestra resultados de tests
```

## 🛠️ Comandos de Desarrollo

### `/lint`
Ejecutar linter en el proyecto.
```bash
/lint
# Ejecuta eslint u otro linter configurado
# Muestra errores de código style
```

### `/format`
Formatear código del proyecto.
```bash
/format
# Ejecuta prettier u otro formateador
# Aplica estilo consistente
```

### `/deps`
Gestionar dependencias.
```bash
/deps
# Muestra dependencias obsoletas
# Sugiere actualizaciones
```

## 🔍 Comandos de Búsqueda

### `/find`
Buscar archivos o contenido en el proyecto.
```bash
/find filename.ts
/find "function processMessage"
# Busca archivos por nombre o contenido
```

### `/grep`
Búsqueda avanzada con regex.
```bash
/grep "TODO|FIXME"
# Encuentra todos los TODOs y FIXMEs
```

## 📝 Comandos Personalizados

### Crear Comandos Slash Personalizados

Puedes crear tus propios comandos slash guardando prompts en archivos markdown:

```bash
# Crear directorio para comandos personalizados
mkdir -p ~/.config/claude-code/commands

# Crear comando personalizado
nano ~/.config/claude-code/commands/analyze-bot.md
```

```markdown
# /analyze-bot
Analiza específicamente el bot de WhatsApp de TeAlquilamos:

1. Revisa la estructura del código en src/
2. Verifica la configuración de OpenAI
3. Chequea la integración con Whapi
4. Analiza el rendimiento y logging
5. Identifica posibles mejoras

Enfócate en:
- Performance de respuestas
- Manejo de errores
- Uso de memoria
- Escalabilidad
```

Uso:
```bash
/analyze-bot
# Ejecuta el análisis personalizado del bot
```

## 🎯 Comandos Específicos para nuestro Bot

### `/bot-status`
```markdown
# Comando personalizado para verificar estado del bot
Revisa:
- Estado de conexión con OpenAI
- Configuración de Whapi
- Logs recientes de errores
- Métricas de rendimiento
- Estado de Railway deployment
```

### `/bot-deploy`
```markdown
# Comando para proceso de deploy
1. Ejecuta npm run build
2. Verifica tests
3. Revisa configuración de production
4. Prepara para deploy a Railway
5. Muestra checklist pre-deploy
```

### `/bot-debug`
```markdown
# Comando de debugging específico
1. Revisa logs de error recientes
2. Verifica conectividad APIs
3. Analiza tiempo de respuesta
4. Chequea uso de memoria
5. Sugiere fixes específicos
```

## 💡 Tips para Comandos Slash

### Comandos en Secuencia
```bash
/model
# Cambiar a haiku para análisis rápido
/analyze
# Análisis inicial
/model
# Cambiar a sonnet para desarrollo
"Implementa las mejoras sugeridas"
```

### Flujo de Trabajo Típico
```bash
/status          # Ver estado actual
/analyze         # Análisis del proyecto
/build           # Verificar que compila
/test            # Ejecutar tests
/lint            # Verificar estilo
```

### Comandos para Debugging
```bash
/find "ERROR"    # Buscar errores
/grep "TODO"     # Encontrar tareas pendientes
/history         # Ver qué se hizo antes
```

## 🔧 Configuración de Comandos

### Archivo de Configuración
```json
{
  "slashCommands": {
    "shortcuts": {
      "/b": "/build",
      "/t": "/test", 
      "/s": "/status",
      "/a": "/analyze"
    },
    "customCommands": {
      "/bot-check": "~/.config/claude-code/commands/bot-check.md"
    }
  }
}
```

### Aliases Útiles
```bash
# Crear aliases para comandos frecuentes
/b    # = /build
/t    # = /test
/s    # = /status
/a    # = /analyze
```

## 🚨 Comandos de Emergencia

### `/rollback`
```bash
/rollback
# Deshace los últimos cambios
# Restaura al último estado guardado
```

### `/safe-mode`
```bash
/safe-mode
# Modo conservador
# Solo análisis, no modificaciones
# Útil para debugging crítico
```

### `/force-restart`
```bash
/force-restart
# Reinicia la sesión completamente
# Limpia cache y estado
# Último recurso para problemas
```

## 📚 Comandos por Categoría

### 🔍 Análisis
- `/analyze` - Análisis del proyecto
- `/status` - Estado de archivos
- `/find` - Buscar archivos/contenido
- `/grep` - Búsqueda con regex

### 🛠️ Desarrollo
- `/build` - Construir proyecto
- `/test` - Ejecutar tests
- `/lint` - Verificar estilo
- `/format` - Formatear código

### ⚙️ Configuración
- `/model` - Cambiar modelo IA
- `/help` - Ayuda y documentación
- `/save` - Guardar estado
- `/resume` - Continuar sesión

### 🚨 Utilidades
- `/clear` - Limpiar historial
- `/history` - Ver historial
- `/exit` - Salir de sesión

## 🎯 Ejemplo de Sesión Completa

```bash
# Iniciar análisis
/model → claude-3-5-haiku
/status
/analyze

# Desarrollo
/model → claude-3-5-sonnet-20241022
"Implementa las mejoras sugeridas"

# Verificación
/build
/test
/lint

# Finalización
/save
"Haz commit de los cambios"
```

---

*Referencia de comandos actualizada: Julio 2025*
*Optimizada para el proyecto TeAlquilamos Bot*