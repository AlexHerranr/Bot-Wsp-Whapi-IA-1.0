# 🤖 Claude Code - Documentación del Proyecto

> **Guía completa para el uso de Claude Code en el proyecto TeAlquilamos Bot**

## 🎯 Estrategia de Modelos Definida

Para este proyecto utilizaremos **únicamente 2 modelos** de forma estratégica:

### 🧠 **Claude 4.0 Opus** - Planificación y Análisis
**Uso**: Determinar problemas complejos, crear planes estratégicos, análisis profundo
```bash
export ANTHROPIC_MODEL="claude-4-0-opus"
```

**Casos de uso:**
- 🔍 Análisis completo del sistema
- 📋 Planificación de nuevas funcionalidades
- 🚨 Diagnosis de problemas complejos
- 🏗️ Diseño de arquitectura
- 📊 Análisis de performance crítica

### ⚡ **Claude 3.5 Sonnet** - Ejecución y Desarrollo
**Uso**: Implementar soluciones, desarrollo de código, ejecución de planes
```bash
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"
```

**Casos de uso:**
- 💻 Implementación de código
- 🔧 Refactoring y optimización
- 🐛 Corrección de bugs
- ✅ Ejecución de tests
- 📝 Documentación y commits

## 🔄 Flujo de Trabajo Optimizado

### 1. **Fase de Análisis** (Opus 4.0)
```bash
/model → claude-4-0-opus

"Analiza el proyecto completo y identifica los 3 problemas más críticos"
"Crea un plan detallado para implementar [nueva funcionalidad]"
"Diseña la estrategia para optimizar el performance del bot"
```

### 2. **Fase de Ejecución** (Sonnet 3.5)
```bash
/model → claude-3-5-sonnet-20241022

"Implementa el paso 1 del plan que creaste"
"Ejecuta las correcciones identificadas en el análisis"
"Desarrolla el código según el diseño propuesto"
```

## 📚 Documentación Disponible

### 📖 Guías Principales
1. **[01-guia-basica.md](01-guia-basica.md)** - Introducción y conceptos básicos
2. **[02-configuracion-modelos.md](02-configuracion-modelos.md)** - Configuración de modelos IA
3. **[03-comandos-slash.md](03-comandos-slash.md)** - Referencia de comandos slash
4. **[04-mejores-practicas.md](04-mejores-practicas.md)** - Mejores prácticas y flujos

### 🎯 Configuración Recomendada

#### Variables de Entorno
```bash
# Modelo principal para planificación
export ANTHROPIC_PLANNING_MODEL="claude-4-0-opus"

# Modelo para ejecución
export ANTHROPIC_EXECUTION_MODEL="claude-3-5-sonnet-20241022"

# Modelo por defecto (ejecución)
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"
```

#### Settings.json
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "planningModel": "claude-4-0-opus",
  "project": "TeAlquilamos WhatsApp Bot",
  "strategy": "two-model-approach",
  "workflows": {
    "analyze": "claude-4-0-opus",
    "plan": "claude-4-0-opus",
    "execute": "claude-3-5-sonnet-20241022",
    "develop": "claude-3-5-sonnet-20241022",
    "implement": "claude-3-5-sonnet-20241022"
  }
}
```

## 🚀 Inicio Rápido

### 1. Configuración Inicial
```bash
# Clonar la documentación local
cd docs/claude-code/

# Configurar modelos
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"

# Iniciar Claude Code
claude
```

### 2. Primer Análisis (Opus)
```bash
/model → claude-4-0-opus
"Analiza el estado actual del bot y crea un plan de mejoras"
```

### 3. Implementación (Sonnet)
```bash
/model → claude-3-5-sonnet-20241022
"Implementa las mejoras del plan usando prioridad alta primero"
```

## 💡 Ejemplos Prácticos

### 🔍 Análisis de Problemas (Opus)
```bash
/model → claude-4-0-opus

# Problema complejo
"El bot tiene memory leaks y respuestas lentas. Analiza todas 
las posibles causas y crea un plan de solución priorizado."

# Resultado esperado: Plan detallado con pasos específicos
```

### ⚡ Implementación de Soluciones (Sonnet)
```bash
/model → claude-3-5-sonnet-20241022

# Ejecutar el plan
"Implementa el paso 1 del plan: optimizar el manejo de memoria 
en el sistema de cache de conversaciones"

# Resultado esperado: Código optimizado y funcional
```

## 📊 Ventajas de Esta Estrategia

### ✅ **Beneficios**
- **Análisis profundo** con Opus para decisiones críticas
- **Ejecución eficiente** con Sonnet para desarrollo
- **Costo optimizado** usando cada modelo según fortalezas
- **Flujo claro** entre planificación y ejecución
- **Simplicidad** con solo 2 modelos

### 📈 **Métricas Esperadas**
- **Tiempo de análisis**: 5-15 min (Opus)
- **Tiempo de implementación**: 15-45 min (Sonnet)
- **Calidad de código**: Alta (estrategia bien definida)
- **Eficiencia de costos**: Optimizada

## 🛠️ Comandos Rápidos

### Cambio de Modelo
```bash
/model   # Selector de modelo

# Atajos mentales:
# 🧠 Opus = Pensar, Planificar, Analizar
# ⚡ Sonnet = Hacer, Implementar, Ejecutar
```

### Flujo Típico
```bash
# 1. Análisis (Opus)
/model → opus
"¿Cuál es el problema y cómo lo resolvemos?"

# 2. Ejecución (Sonnet)  
/model → sonnet
"Implementa la solución propuesta"
```

## 📋 Checklist de Sesión

### ✅ Antes de Empezar
- [ ] Modelo configurado según la tarea
- [ ] Contexto del problema claro
- [ ] Objetivo específico definido

### ✅ Durante el Desarrollo
- [ ] Usar Opus para análisis y planificación
- [ ] Cambiar a Sonnet para implementación
- [ ] Verificar cada paso antes de continuar

### ✅ Antes de Terminar
- [ ] Tests ejecutados y pasando
- [ ] Código formateado y sin errores
- [ ] Commit realizado con mensaje descriptivo

## 🔗 Enlaces Útiles

- **[Guía Básica](01-guia-basica.md)** - Empezar aquí
- **[Configuración de Modelos](02-configuracion-modelos.md)** - Setup detallado
- **[Comandos Slash](03-comandos-slash.md)** - Referencia rápida
- **[Mejores Prácticas](04-mejores-practicas.md)** - Optimización

## 📞 Soporte

Para dudas sobre Claude Code:
- **Documentación oficial**: https://docs.anthropic.com/claude-code
- **Issues del proyecto**: [GitHub Issues]
- **Documentación local**: `docs/claude-code/`

---

## 🎯 Resumen Ejecutivo

**Estrategia de 2 Modelos para TeAlquilamos Bot:**

1. **🧠 Claude 4.0 Opus** → Análisis, planificación, diagnosis
2. **⚡ Claude 3.5 Sonnet** → Implementación, desarrollo, ejecución

**Flujo:** Planificar con Opus → Ejecutar con Sonnet → Repetir

*Documentación creada: Julio 2025*  
*Optimizada para el proyecto TeAlquilamos WhatsApp Bot*