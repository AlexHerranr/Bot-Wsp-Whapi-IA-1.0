# 🤖 Claude Code - Guía Básica de Uso

> **Documentación interna para el equipo de TeAlquilamos Bot**

## 🎯 ¿Qué es Claude Code?

Claude Code es una herramienta de IA que funciona directamente en tu terminal para ayudarte con desarrollo de software. Puede leer, escribir, modificar código y ejecutar comandos de forma autónoma.

## 🚀 Instalación y Configuración

### Instalación
```bash
# Instalar Claude Code
npm install -g @anthropic/claude-code

# Verificar instalación
claude --version
```

### Configuración Inicial
```bash
# Configurar API key
export ANTHROPIC_API_KEY="tu-api-key-aquí"

# Configurar modelo preferido
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"
```

## 💬 Iniciar una Sesión

```bash
# Iniciar Claude Code en el directorio del proyecto
claude

# Iniciar con un prompt específico
claude "Analiza el código y encuentra bugs"

# Continuar sesión anterior
claude --resume
```

## 🎯 Capacidades Principales

### ✅ Lo que Claude Code PUEDE hacer:
- **Leer y analizar** todo tu código
- **Modificar archivos** existentes
- **Crear nuevos archivos** cuando sea necesario
- **Ejecutar comandos** (npm, git, tests, etc.)
- **Hacer commits** con mensajes descriptivos
- **Debuggear errores** y implementar fixes
- **Refactorizar código** completo
- **Optimizar performance**
- **Escribir tests** automáticamente

### ⚠️ Lo que necesita aprobación:
- Hacer **push** a repositorios remotos
- Cambiar **configuraciones críticas** del sistema
- **Eliminar archivos** importantes
- **Instalar nuevas dependencias**

## 🗣️ Cómo Comunicarte con Claude

### Comandos Directos
```bash
# Análisis
"Analiza el archivo src/app-unified.ts"
"¿Qué hace la función processMessage?"

# Modificaciones
"Arregla todos los errores de TypeScript"
"Implementa un sistema de cache Redis"
"Optimiza la performance del bot"

# Desarrollo
"Crea tests para el módulo de WhatsApp"
"Refactoriza la función de logging"
"Agrega documentación JSDoc a todas las funciones"
```

### Nivel de Autonomía
```bash
# Máxima autonomía
"Analiza el bot, encuentra problemas, implementa mejoras, 
haz tests y commit los cambios"

# Control paso a paso
"Muéstrame los errores de TypeScript primero"
```

## 🔄 Flujo de Trabajo Típico

### 1. Análisis Inicial
```bash
"Analiza el proyecto y dame un resumen del estado actual"
```

### 2. Identificar Problemas
```bash
"Encuentra bugs, errores de tipo y problemas de performance"
```

### 3. Implementar Soluciones
```bash
"Implementa las mejoras que identificaste"
```

### 4. Verificar Cambios
```bash
"Ejecuta los tests y verifica que todo funcione"
```

### 5. Commit Changes
```bash
"Haz commit de los cambios con mensaje descriptivo"
```

## 💡 Tips para Mejores Resultados

### ✅ Buenas Prácticas
- **Sé específico** en tus peticiones
- **Da contexto** sobre lo que necesitas
- **Pregunta por explicaciones** si no entiendes algo
- **Revisa los cambios** antes de hacer commit

### ❌ Evita
- Peticiones muy vagas como "arregla todo"
- Cambiar múltiples cosas sin contexto
- No revisar los cambios importantes

## 🔧 Comandos Útiles Durante la Sesión

```bash
# Ver estado actual
git status

# Ver cambios realizados
git diff

# Ejecutar tests
npm test

# Verificar build
npm run build

# Ver logs en tiempo real
tail -f logs/app.log
```

## 🎯 Casos de Uso Específicos para nuestro Bot

### Debugging
```bash
"El bot no responde a mensajes, ayúdame a debuggear"
"Los logs muestran errores de OpenAI, ¿qué está pasando?"
```

### Nuevas Funcionalidades
```bash
"Implementa un sistema de respuestas automáticas"
"Agrega soporte para imágenes en WhatsApp"
```

### Optimización
```bash
"El bot es lento, optimiza la performance"
"Reduce el uso de memoria del sistema de cache"
```

### Mantenimiento
```bash
"Actualiza todas las dependencias de forma segura"
"Mejora el sistema de logging para production"
```

## 📚 Recursos Adicionales

- **Documentación oficial**: https://docs.anthropic.com/claude-code
- **Guía de modelos**: `docs/claude-code/02-configuracion-modelos.md`
- **Comandos slash**: `docs/claude-code/03-comandos-slash.md`
- **Mejores prácticas**: `docs/claude-code/04-mejores-practicas.md`

---

*Última actualización: Julio 2025*
*Autor: Claude Code + Alexander (TeAlquilamos)*