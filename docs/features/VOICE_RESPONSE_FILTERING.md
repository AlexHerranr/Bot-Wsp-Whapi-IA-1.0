# Sistema de Filtrado de Respuestas por Voz

## Descripción
Sistema inteligente que decide automáticamente cuándo responder en voz o texto, interceptando contenido sensible (precios, números, enlaces) para forzar respuestas en texto.

## Funcionalidad

### Flujo de Decisión
1. **Entrada de usuario**: Si es mensaje de voz → `userState.lastInputVoice = true`
2. **Generación de respuesta**: OpenAI procesa y genera respuesta
3. **Análisis de contenido**: Sistema evalúa si contiene información sensible
4. **Decisión final**: Mantiene voz o fuerza texto según contenido

### Contenido que Fuerza Texto
- **Precios**: `$840.000`, `210,000 COP`
- **Números específicos**: `4 noches`, `3 personas`
- **Enlaces**: `https://wa.me/p/123456`, URLs generales
- **Enlaces de WhatsApp**: `wa.me/p`

### Contenido que Permite Voz
- Saludos y conversación general
- Palabras como "disponibilidad", "fotos", "imágenes" (sin números/enlaces)
- Respuestas sin información específica

## Implementación Técnica

### Archivo: `src/app-unified.ts`

#### Función Principal
```typescript
function isQuoteOrPriceMessage(message: string): boolean {
    const sensitivePatterns = [
        /\$\d+[.,]?\d*/g,           // $840.000, $210,000
        /\d+[.,]?\d*\s*(cop|pesos?)/gi,  // 840000 COP, 210 pesos
        /\d+\s*noches?/gi,         // 4 noches
        /https?:\/\/\S+/i,         // URLs (enlaces)
        /wa\.me\/p/i               // enlaces específicos de WhatsApp
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(message));
}
```

#### Lógica de Decisión
```typescript
// Verificar si debe responder con voz (si input fue voz)
const userState = globalUserStates.get(getShortUserId(chatId));
let shouldUseVoice = process.env.ENABLE_VOICE_RESPONSES === 'true' && 
    userState?.lastInputVoice === true;

// Forzar texto si es cotización/precio
if (shouldUseVoice && isQuoteOrPriceMessage(message)) {
    shouldUseVoice = false;  // Responder en texto
    logInfo('VOICE_FORCED_TO_TEXT', 'Respuesta forzada a texto por contenido sensible (precios/números/enlaces)', {
        userId: getShortUserId(chatId),
        messagePreview: message.substring(0, 50)
    });
}
```

## Beneficios

### UX Mejorada
- **Información importante en texto**: Precios y enlaces son más fáciles de leer que escuchar
- **Conversación natural en voz**: Saludos y charla general mantienen el flujo de audio
- **Accesibilidad**: Enlaces clicables en texto vs no funcionales en audio

### Casos de Uso
- Usuario pregunta por voz → Bot responde cotización en texto (fácil de leer)
- Usuario saluda por voz → Bot responde saludo en voz (natural)
- Usuario consulta fotos → Bot envía enlaces en texto (clicables)

## Logs y Monitoreo
- Log `VOICE_FORCED_TO_TEXT` cuando se detecta contenido sensible
- Preview del mensaje para debugging
- Tracking de decisiones para optimización

## Configuración
- Variable de entorno: `ENABLE_VOICE_RESPONSES=true`
- Funciona solo si las respuestas de voz están habilitadas
- Respeta preferencia del usuario (input de voz)

---
**Implementado**: 2025-07-26  
**Versión**: 1.0  
**Archivo**: `src/app-unified.ts:1111-1142`