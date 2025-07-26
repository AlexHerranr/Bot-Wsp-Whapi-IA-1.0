# ⚙️ Claude Code - Configuración de Modelos

> **Guía completa para configurar y cambiar modelos de IA**

## 🤖 Modelos Disponibles

### Claude 3.5 Sonnet (Recomendado)
```bash
claude-3-5-sonnet-20241022
```
- **Uso**: Desarrollo general, debugging, refactoring
- **Ventajas**: Balance perfecto entre velocidad e inteligencia
- **Ideal para**: Nuestro bot de WhatsApp

### Claude 3.5 Haiku (Rápido)
```bash
claude-3-5-haiku
```
- **Uso**: Tareas simples, lectura de archivos, comandos básicos
- **Ventajas**: Muy rápido, económico
- **Ideal para**: Análisis rápido, preguntas simples

### Claude 4.0 Sonnet (Más Avanzado)
```bash
claude-4-0-sonnet
```
- **Uso**: Tareas complejas, arquitectura, análisis profundo
- **Ventajas**: Máxima inteligencia
- **Ideal para**: Refactoring complejo, diseño de sistemas

### Claude 4.0 Opus (Premium)
```bash
claude-4-0-opus
```
- **Uso**: Proyectos críticos, análisis muy complejos
- **Ventajas**: El más potente disponible
- **Nota**: Requiere acceso especial

## 🔧 Métodos de Configuración

### 1. Variable de Entorno (Global)
```bash
# En tu .bashrc, .zshrc, o .profile
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"
export ANTHROPIC_SMALL_FAST_MODEL="claude-3-5-haiku"

# Aplicar cambios
source ~/.bashrc
```

### 2. Archivo de Configuración Global
```bash
# Crear archivo de configuración
mkdir -p ~/.config/claude-code
nano ~/.config/claude-code/settings.json
```

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "smallFastModel": "claude-3-5-haiku"
}
```

### 3. Configuración por Proyecto
```bash
# En el directorio de tu proyecto
nano settings.json
```

```json
{
  "model": "claude-4-0-sonnet",
  "smallFastModel": "claude-3-5-haiku",
  "project": "TeAlquilamos Bot"
}
```

## 🔄 Cambio de Modelo Durante la Conversación

### Comando /model
```bash
/model
```
Este comando abre un selector para cambiar el modelo actual.

### Estrategia Inteligente por Tarea

#### Para Análisis Rápido → Haiku
```bash
/model
# Seleccionar: claude-3-5-haiku

"¿Qué hace este archivo?"
"Ejecuta npm test"
"Muéstrame el contenido de package.json"
```

#### Para Desarrollo → Sonnet 3.5
```bash
/model
# Seleccionar: claude-3-5-sonnet-20241022

"Implementa un sistema de cache"
"Arregla los errores de TypeScript"
"Optimiza la función de logging"
```

#### Para Arquitectura → Sonnet 4.0
```bash
/model
# Seleccionar: claude-4-0-sonnet

"Refactoriza toda la arquitectura del bot"
"Diseña un sistema de microservicios"
"Analiza y mejora la estructura completa"
```

## 🎯 Configuración Recomendada para nuestro Proyecto

### ⚡ Estrategia de 2 Modelos Optimizada
Utilizamos únicamente **2 modelos** estratégicamente:

**🧠 Claude 4.0 Opus** - Planificación y Análisis Complejo  
**⚡ Claude 3.5 Sonnet** - Ejecución y Desarrollo

### Configuración Principal
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "planningModel": "claude-4-0-opus",
  "project": "TeAlquilamos WhatsApp Bot",
  "strategy": "two-model-approach",
  "defaultSettings": {
    "autoCommit": false,
    "verboseLogging": true,
    "codeStyle": "typescript"
  },
  "workflows": {
    "analyze": "claude-4-0-opus",
    "plan": "claude-4-0-opus",
    "execute": "claude-3-5-sonnet-20241022",
    "develop": "claude-3-5-sonnet-20241022"
  }
}
```

### Variables de Entorno Específicas
```bash
# Modelo principal para ejecución
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"

# Modelo para planificación y análisis
export ANTHROPIC_PLANNING_MODEL="claude-4-0-opus"

# Proyecto específico
export CLAUDE_PROJECT="TeAlquilamos-Bot"
```

## 📊 Comparación de Modelos

| Modelo | Velocidad | Inteligencia | Costo | Uso Recomendado |
|--------|-----------|--------------|-------|-----------------|
| Haiku | ⚡⚡⚡⚡⚡ | ⭐⭐⭐ | 💰 | Tareas simples |
| Sonnet 3.5 | ⚡⚡⚡⚡ | ⭐⭐⭐⭐ | 💰💰 | Desarrollo general |
| Sonnet 4.0 | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | 💰💰💰 | Tareas complejas |
| Opus 4.0 | ⚡⚡ | ⭐⭐⭐⭐⭐ | 💰💰💰💰 | Proyectos críticos |

## 🔄 Flujo de Trabajo Optimizado

### Análisis Inicial (Haiku)
```bash
/model → claude-3-5-haiku
"Dame un resumen rápido del proyecto"
```

### Desarrollo (Sonnet 3.5)
```bash
/model → claude-3-5-sonnet-20241022
"Implementa las mejoras identificadas"
```

### Revisión Compleja (Sonnet 4.0)
```bash
/model → claude-4-0-sonnet
"Revisa la arquitectura completa y sugiere optimizaciones"
```

## 💡 Tips de Optimización

### Ahorro de Costos
- Usa **Haiku** para lecturas y análisis simples
- Cambia a **Sonnet** solo para implementaciones
- Reserva **Opus** para decisiones arquitectónicas críticas

### Máxima Eficiencia
- Mantén el modelo **Sonnet 3.5** como predeterminado
- Usa **Haiku** para preguntas rápidas
- Cambia a **4.0** solo para tareas muy complejas

## 🚨 Troubleshooting

### Error de Modelo No Disponible
```bash
# Verificar modelos disponibles
claude --models

# Usar modelo de respaldo
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"
```

### Configuración No Se Aplica
```bash
# Verificar configuración actual
cat ~/.config/claude-code/settings.json

# Reiniciar sesión
exit
claude
```

### Límites de Rate
```bash
# Cambiar a modelo más económico temporalmente
/model → claude-3-5-haiku
```

## 📝 Configuración de Ejemplo para el Bot

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "smallFastModel": "claude-3-5-haiku",
  "project": "TeAlquilamos WhatsApp Bot",
  "settings": {
    "typescript": true,
    "testing": "jest",
    "linting": "eslint",
    "deployment": "railway"
  },
  "workflows": {
    "analysis": "claude-3-5-haiku",
    "development": "claude-3-5-sonnet-20241022",
    "architecture": "claude-4-0-sonnet"
  }
}
```

---

*Configuración actualizada: Julio 2025*
*Optimizada para el proyecto TeAlquilamos Bot*