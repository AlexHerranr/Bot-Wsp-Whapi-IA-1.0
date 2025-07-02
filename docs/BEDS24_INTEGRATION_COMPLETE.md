# 🎯 Integración Beds24 - IMPLEMENTACIÓN COMPLETA

## 📋 Resumen de la Actualización

La integración con Beds24 ha sido **completamente rediseñada** con un algoritmo multi-estrategia que prioriza opciones según la estrategia comercial:

### 🥇 **PRIORIDAD 1**: Opciones Completas (Sin Traslados)
### 🥈 **PRIORIDAD 2**: Alternativas con Traslado (Máximo 3 traslados)

---

## 🏗️ Arquitectura Final

```
Usuario → WhatsApp → OpenAI Assistant → function-handler.ts → beds24-availability.ts → Beds24 API
                                                ↓
                                 Respuesta Inteligente ← Algoritmo Multi-Estrategia
```

---

## 🚀 NUEVA CONFIGURACIÓN PARA OPENAI ASSISTANT (MEJORADA)

### Función para OpenAI - VERSIÓN CORREGIDA (Copia esto exactamente)

```json
{
  "type": "function",
  "name": "check_availability",
  "description": "Consulta disponibilidad en tiempo real desde Beds24. IMPORTANTE: Estamos en julio 2025. Siempre usa fechas de 2025 o futuro. Interpreta fechas relativas basándote en que HOY es 2025-07-02.",
  "strict": true,
  "parameters": {
    "type": "object",
    "properties": {
      "startDate": {
        "type": "string",
        "description": "Fecha de inicio en formato YYYY-MM-DD. USAR AÑO 2025. Ejemplos: 'hoy 2 Jul' = '2025-07-02', 'mañana' = '2025-07-03', '10 de julio' = '2025-07-10'."
      },
      "endDate": {
        "type": "string",
        "description": "Fecha de fin en formato YYYY-MM-DD. USAR AÑO 2025. Debe ser posterior a startDate. Ejemplos: 'al 6' = '2025-07-06', '15 de julio' = '2025-07-15'."
      }
    },
    "required": ["startDate", "endDate"],
    "additionalProperties": false
  }
}
```

### Función Simplificada (Alternativa)

Si prefieres una versión más simple para empezar:

```json
{
  "type": "function", 
  "name": "check_availability",
  "description": "Consulta disponibilidad de apartamentos en tiempo real desde Beds24. Retorna opciones priorizadas.",
  "parameters": {
    "type": "object",
    "properties": {
      "startDate": {
        "type": "string",
        "description": "Fecha inicio en formato YYYY-MM-DD"
      },
      "endDate": {
        "type": "string", 
        "description": "Fecha fin en formato YYYY-MM-DD"
      }
    },
    "required": ["startDate", "endDate"],
    "additionalProperties": false
  },
  "strict": true
}
```

### Instrucciones CRÍTICAS para el Assistant (Agrega al inicio)

```
CONTEXTO TEMPORAL OBLIGATORIO:
- HOY ES: 2 de julio de 2025 (2025-07-02)
- AÑO ACTUAL: 2025
- NUNCA uses años anteriores a 2025

INTERPRETACIÓN DE FECHAS:
- "hoy 2 Jul al 6" = check_availability("2025-07-02", "2025-07-06")  
- "mañana 3 noches" = check_availability("2025-07-03", "2025-07-06")
- "10 al 15 julio" = check_availability("2025-07-10", "2025-07-15")

ANTES de llamar check_availability, SIEMPRE piensa:
"El usuario dijo [fecha], en 2025 esto significa [fecha convertida]"
```

## CONTEXTO TEMPORAL CRÍTICO
- Año actual: 2025
- SIEMPRE usa el año 2025 para todas las fechas
- Fecha de hoy: 2 de julio de 2025 (2025-07-02)

## FUNCIÓN PRINCIPAL
- USA check_availability(startDate, endDate) para TODAS las consultas de disponibilidad
- NUNCA inventes disponibilidad - solo usa datos reales de la función
- SIEMPRE convierte fechas al formato YYYY-MM-DD usando el año 2025

## MANEJO DE FECHAS - EJEMPLOS CRÍTICOS
Conversiones OBLIGATORIAS (usar 2025):
- "desde hoy 2 Jul al 6" → check_availability("2025-07-02", "2025-07-06") 
- "Del 10 al 15 de julio" → check_availability("2025-07-10", "2025-07-15")
- "mañana por 3 noches" → check_availability("2025-07-03", "2025-07-06")
- "Este fin de semana" → Pregunta fechas exactas: "¿Te refieres al fin de semana del 5-6 de julio de 2025?"
- "La próxima semana" → "¿Podrías especificar las fechas exactas? Por ejemplo: 'del 7 al 10 de julio de 2025'"
- "Del 15 de julio por 3 noches" → check_availability("2025-07-15", "2025-07-18")

## VALIDACIÓN DE FECHAS
- SIEMPRE verifica que las fechas sean en 2025 o futuro
- Si el usuario menciona un año pasado, corrígelo: "Te ayudo con fechas de 2025 en adelante"
- Para fechas ambiguas, especifica el año: "¿Te refieres a julio de 2025?"

## INTERPRETACIÓN DE RESPUESTAS
1. **"DISPONIBILIDAD COMPLETA"**: Opciones SIN traslados (ideales)
   - Preséntelas como las mejores opciones
   - NO menciones "sin traslados" (es lo esperado)

2. **"ALTERNATIVAS CON TRASLADO"**: Opciones que requieren cambio de apartamento
   - Explica que incluyen cambio de apartamento durante la estadía
   - Menciona posibles descuentos por la "disponibilidad limitada"
   - Son opciones válidas pero requieren mayor flexibilidad

## RESPUESTAS A ERRORES DE LA FUNCIÓN
- Error de fechas → "Las fechas deben estar en formato correcto y ser en el futuro (2025 o posterior)"
- Error de validación → Explica el problema y pide corrección
- Error de API → "Tenemos un problema técnico consultando disponibilidad. Intenta en unos minutos"

## CASOS ESPECIALES
- Si preguntan por fechas muy lejanas (>6 meses): "Puedo consultar hasta 6 meses adelante desde julio 2025"
- Si piden más de 30 noches: "Para estadías largas podemos hacer arreglos especiales"
- Si no hay disponibilidad: "No hay disponibilidad para esas fechas. ¿Te interesan fechas alternativas en 2025?"

## TONO Y ESTILO
- Amigable y profesional
- Usa emojis relevantes (📅 🏠 💰)
- Sé específico con precios y fechas
- Ofrece alternativas cuando sea apropiado
- SIEMPRE menciona el año 2025 cuando hables de fechas

## NUNCA HAGAS
- Inventar disponibilidad sin consultar la función
- Usar años anteriores a 2025 en las fechas
- Mencionar precios sin datos reales
- Prometer disponibilidad sin confirmar
- Usar fechas en formatos incorrectos en la función

---

## 🧮 Algoritmo Multi-Estrategia Implementado

### Estrategia 1: Maximizar Noches Consecutivas
- **Objetivo**: Minimizar traslados
- **Lógica**: Busca la mayor cantidad de noches consecutivas por propiedad

### Estrategia 2: Minimizar Precio Total
- **Objetivo**: Encontrar combinación más económica
- **Lógica**: Prioriza propiedades con menor precio por noche

### Estrategia 3: Diversificar Propiedades
- **Objetivo**: Ofrecer alternativas diferentes
- **Lógica**: Empieza con propiedades no usadas en otras estrategias

---

## 📤 Formatos de Respuesta

### Caso 1: Opciones Completas Disponibles
```
📅 **Consulta: 15 Jul - 18 Jul (3 noches)**

🥇 **DISPONIBILIDAD COMPLETA (3 opciones)**
✅ **Opción 1**: 1317 - 3 noches
   💰 Total: $540,000
   📊 Promedio: $180,000/noche

✅ **Opción 2**: 2005 A - 3 noches
   💰 Total: $615,000
   📊 Promedio: $205,000/noche

🔄 *Datos en tiempo real desde Beds24*
```

### Caso 2: Solo Opciones con Traslados
```
📅 **Consulta: 10 Jul - 20 Jul (10 noches)**

🥈 **ALTERNATIVAS CON TRASLADO** (por disponibilidad limitada - posible descuento)
🔄 **Opción 1**: 1 traslado - $1,560,000
   🏠 1421 B: 2025-07-10 a 2025-07-13 (4 noches) - $480,000
   🔄 1001: 2025-07-14 a 2025-07-19 (6 noches) - $1,080,000

🔄 **Opción 2**: 2 traslados - $1,410,000
   🏠 1722 A: 2025-07-10 (1 noche) - $0
   🔄 1818: 2025-07-11 a 2025-07-16 (6 noches) - $900,000
   🔄 1722 B: 2025-07-17 a 2025-07-19 (3 noches) - $510,000

🔄 *Datos en tiempo real desde Beds24*
```

---

## 📁 Archivos Implementados

### ✅ Código Principal
- `src/handlers/integrations/beds24-availability.ts` - **Handler principal con 3 estrategias**
- `src/handlers/function-handler.ts` - **Integración con OpenAI**
- `src/services/beds24/beds24.service.ts` - **Servicio Beds24**
- `src/services/beds24/beds24.types.ts` - **Tipos TypeScript**

### ✅ Tests Esenciales
- `integrations/beds24/tests/test-new-algorithm.mjs` - **Test del algoritmo multi-estrategia**
- `integrations/beds24/tests/test-format-output.mjs` - **Simulación de outputs**
- `integrations/beds24/tests/manual.md` - **Documentación de tests manuales**

### ✅ Documentación
- `docs/BEDS24_PRIORITY_LOGIC.md` - **Lógica de priorización**
- `docs/BEDS24_INTEGRATION_COMPLETE.md` - **Este archivo (guía completa)**

---

## 🔧 Variables de Entorno

```bash
# Beds24 (REQUERIDO)
BEDS24_TOKEN=NPYMgbAIjwWRgBg40noyUysPRWwSbqlOTj1ms6c86IMqNyK5hih7Bd76E+JIV74yokryJ8yVWEMw49pv5nTnaxxQwzFrhxd6/8F7+GyIIE7hSPz9d2tQ2kmUS/dXcqICx7BC1trE3E+E4dDov0Ajzw==

# OpenAI (REQUERIDO)
OPENAI_API_KEY=sk-...
ASSISTANT_ID=asst_...
```

---

## 🧪 INSTRUCCIONES PARA PRUEBA EN OPENAI

### 1. **Actualizar la Función en OpenAI**
Ve a tu Assistant en OpenAI y **reemplaza** la función `check_availability` con:

```json
{
  "name": "check_availability",
  "description": "Consulta disponibilidad en tiempo real desde Beds24. Retorna opciones priorizadas.",
  "parameters": {
    "type": "object",
    "properties": {
      "startDate": {
        "type": "string",
        "description": "Fecha de inicio en formato YYYY-MM-DD"
      },
      "endDate": {
        "type": "string",
        "description": "Fecha de fin en formato YYYY-MM-DD"
      }
    },
    "required": ["startDate", "endDate"]
  }
}
```

### 2. **Frases de Prueba**

#### Prueba A: Opciones Completas (3 noches)
```
"¿Tienen disponibilidad del 15 al 18 de julio?"
```
**Resultado Esperado**: Opciones completas sin traslados

#### Prueba B: Opciones con Traslados (10 noches)
```
"Necesito un apartamento del 10 al 20 de julio"
```
**Resultado Esperado**: 2 opciones con traslados, con explicación de descuentos

#### Prueba C: Fechas Futuras
```
"¿Qué tienen disponible para mediados de agosto?"
```
**Resultado Esperado**: Bot pregunta fechas exactas

---

## ✅ Ventajas del Nuevo Sistema

### Para el Negocio
- ✅ **Control total** sobre estrategia comercial
- ✅ **Priorización automática** de opciones sin traslados
- ✅ **Explicación comercial** de traslados con descuentos
- ✅ **Datos en tiempo real** siempre actualizados

### Para OpenAI
- ✅ **Respuestas consistentes** y predecibles
- ✅ **Información estructurada** fácil de interpretar
- ✅ **Menos tokens** necesarios para procesar
- ✅ **Formato optimizado** para conversaciones

### Para el Cliente
- ✅ **Opciones priorizadas** automáticamente
- ✅ **Información clara** con precios totales
- ✅ **Alternativas inteligentes** con mínimos traslados
- ✅ **Respuesta inmediata** con datos reales

---

## 🚀 Estado: LISTO PARA PRODUCCIÓN

La integración está **completamente funcional** y probada. Solo necesitas:

1. ✅ **Actualizar función en OpenAI** (JSON arriba)
2. ✅ **Verificar variables de entorno**
3. ✅ **Hacer pruebas** con las frases sugeridas

**🎯 El sistema aplicará automáticamente la estrategia comercial de priorización** 