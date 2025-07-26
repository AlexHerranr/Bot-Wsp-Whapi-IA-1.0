# 🎯 Claude Code - Mejores Prácticas y Flujos de Trabajo

> **Guía para maximizar la productividad con Claude Code en el desarrollo del bot**

## 💎 Principios Fundamentales

### 1. **Comunicación Clara y Específica**
```bash
# ❌ Vago
"Arregla el bot"

# ✅ Específico
"El bot no está respondiendo a mensajes de WhatsApp. 
Revisa la conexión con Whapi API y los logs de errores 
en src/app-unified.ts línea 200-250"
```

### 2. **Contexto Antes de Acción**
```bash
# ✅ Flujo correcto
1. "Analiza el proyecto y dame un resumen del estado"
2. "Identifica los 3 problemas más críticos"
3. "Implementa las soluciones para estos problemas"
```

### 3. **Verificación Constante**
```bash
# Después de cada cambio importante
"Ejecuta los tests y verifica que todo funcione"
"Haz un build para verificar que no hay errores de TypeScript"
```

## 🚀 Flujos de Trabajo Optimizados

### 🧠 Flujo de Planificación (Modelo: Opus 4.0)
```bash
/model → claude-4-0-opus

# 1. Análisis profundo del problema
"Analiza completamente [problema/funcionalidad] y identifica 
todas las implicaciones y dependencias"

# 2. Estrategia y planificación
"Crea un plan detallado paso a paso con prioridades"

# 3. Identificación de riesgos
"Identifica posibles problemas y crea estrategias de mitigación"
```

### ⚡ Flujo de Ejecución (Modelo: Sonnet 3.5)
```bash
/model → claude-3-5-sonnet-20241022

# 1. Implementación del plan
"Implementa el paso [X] del plan creado anteriormente"

# 2. Desarrollo incremental
"Desarrolla y testa cada componente individualmente"

# 3. Verificación y optimización
"Verifica funcionalidad y optimiza el código implementado"
```

## 🎯 Estrategias por Tipo de Tarea

### 🐛 Debugging Efectivo
```bash
# 1. Reproducir el problema
"Ayúdame a entender este error: [pegar error completo]"

# 2. Análisis de contexto
"Revisa el código alrededor de la línea que falla"

# 3. Solución guiada
"Propón 3 posibles soluciones y sus pros/contras"

# 4. Implementación
"Implementa la solución más segura"

# 5. Verificación
"Crea un test para asegurar que este error no vuelva a ocurrir"
```

### ⚡ Optimización de Performance
```bash
# 1. Medición actual
"Analiza el rendimiento actual del bot y identifica cuellos de botella"

# 2. Profiling
"Revisa las funciones que más tiempo consumen"

# 3. Optimización incremental
"Optimiza una función a la vez y mide el impacto"

# 4. Verificación
"Confirma que las optimizaciones no rompieron funcionalidad"
```

### 🔧 Refactoring Seguro
```bash
# 1. Tests primero
"Crea tests para el código que vamos a refactorizar"

# 2. Refactor incremental
"Refactoriza en pequeños pasos, manteniendo los tests verdes"

# 3. Verificación continua
"Ejecuta tests después de cada cambio"

# 4. Cleanup final
"Elimina código dead y optimiza imports"
```

## 💡 Tips de Productividad

### 🔄 Trabajo en Iteraciones
```bash
# Iteración típica (20-30 minutos)
1. Análisis → Haiku (2-3 min)
2. Planificación → Sonnet 3.5 (5 min)
3. Implementación → Sonnet 3.5 (15-20 min)
4. Verificación → Haiku (2-3 min)
```

### 📝 Documentación Automática
```bash
# Mientras desarrollas
"Agrega comentarios JSDoc a las funciones que modificaste"
"Actualiza el README con los cambios realizados"
"Crea entrada en el changelog para esta funcionalidad"
```

### 🔄 Control de Versiones Inteligente
```bash
# Commits frecuentes y descriptivos
"Haz commit de este cambio con un mensaje descriptivo"

# Review antes de push
"Revisa todos los cambios antes de hacer push"

# Branches para features
"Crea una nueva branch para esta feature"
```

## 🎨 Estándares de Código

### TypeScript Best Practices
```bash
# Siempre especificar tipos
"Agrega tipos TypeScript explícitos a todas las funciones"

# Error handling consistente
"Implementa manejo de errores consistente usando try/catch"

# Interfaces claras
"Define interfaces para todos los objetos de datos"
```

### Estructura de Proyecto
```bash
# Organización modular
src/
├── handlers/          # Manejadores de eventos
├── services/          # Servicios externos (OpenAI, Whapi)
├── utils/             # Utilidades reutilizables
├── types/             # Definiciones de tipos
└── config/            # Configuración

# Naming conventions
- Archivos: kebab-case (whapi-handler.ts)
- Funciones: camelCase (processMessage)
- Constantes: UPPER_CASE (MAX_RETRIES)
- Interfaces: PascalCase (MessageData)
```

## 🚨 Anti-Patrones a Evitar

### ❌ Lo que NO hacer
```bash
# Cambios masivos sin context
"Cambia todo el código a ES6"

# Modificaciones sin tests
"Refactoriza el core sin ejecutar tests"

# Requests vagas
"Haz que el bot sea mejor"

# Commits sin review
"Haz commit y push de todo"
```

### ✅ Lo correcto
```bash
# Cambios incrementales
"Convierte una función a la vez a async/await"

# Tests first
"Crea tests antes de modificar el código crítico"

# Especificidad
"Optimiza la función processMessage para reducir latencia"

# Review consciente
"Muéstrame los cambios antes de hacer commit"
```

## 🔧 Configuración del Entorno

### Settings.json Optimizado
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "smallFastModel": "claude-3-5-haiku",
  "project": "TeAlquilamos WhatsApp Bot",
  "autoSave": true,
  "verboseLogging": false,
  "codeStyle": {
    "indentation": 2,
    "quotes": "single",
    "semicolons": true,
    "trailingComma": true
  },
  "workflows": {
    "analyze": "claude-3-5-haiku",
    "develop": "claude-3-5-sonnet-20241022",
    "architect": "claude-4-0-sonnet"
  }
}
```

### Aliases Útiles
```bash
# En tu .bashrc/.zshrc
alias cc="claude"
alias cca="/model claude-3-5-haiku && /analyze"
alias ccd="/model claude-3-5-sonnet-20241022"
alias cctest="npm test && npm run build && npm run lint"
```

## 📊 Métricas de Productividad

### Medir tu Efectividad
```bash
# Tiempo por tarea
- Análisis simple: 2-5 min (Haiku)
- Feature nueva: 15-30 min (Sonnet)
- Refactor complejo: 45-60 min (Sonnet 4.0)

# Calidad del código
- Tests coverage > 80%
- 0 errores de TypeScript
- 0 warnings de ESLint
- Build time < 30 segundos
```

### KPIs del Bot
```bash
# Performance
- Tiempo de respuesta < 2 segundos
- Uptime > 99.9%
- Memoria < 512MB
- CPU < 50%

# Calidad
- Error rate < 1%
- Tests passing: 100%
- Code coverage > 85%
```

## 🎯 Casos de Uso Específicos

### Para el Bot de WhatsApp
```bash
# Debugging de mensajes
"El bot no responde a ciertos mensajes. Revisa el handler 
de webhooks y la validación de entrada"

# Optimización de OpenAI
"Las respuestas de OpenAI son lentas. Analiza el uso de 
threads y caché de contexto"

# Integración Whapi
"Algunos mensajes no se envían. Revisa la implementación 
del rate limiting y retry logic"
```

### Para Deployment
```bash
# Pre-deploy checklist
"Ejecuta todos los checks necesarios antes de deploy:
1. Tests passing
2. Build successful
3. Environment variables set
4. Railway config updated"

# Post-deploy verification
"Verifica que el deploy fue exitoso:
1. Health check endpoint responde
2. Logs no muestran errores
3. Bot responde a mensajes de prueba"
```

## 📚 Recursos de Referencia

### Comandos Rápidos
```bash
/status    # Estado actual
/analyze   # Análisis rápido
/build     # Construir proyecto
/test      # Ejecutar tests
/model     # Cambiar modelo
```

### Archivos Clave del Proyecto
```bash
src/app-unified.ts           # Aplicación principal
src/config/environment.ts    # Configuración
src/handlers/               # Manejadores de eventos
src/services/               # Servicios externos
package.json                # Dependencias y scripts
```

---

*Mejores prácticas actualizadas: Julio 2025*
*Optimizadas para el proyecto TeAlquilamos Bot*