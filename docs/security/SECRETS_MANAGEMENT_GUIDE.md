# 🔐 Guía de Gestión de Secretos

## 📋 Estado Actual

### Secretos en Variables de Entorno ✅
- `OPENAI_API_KEY` - Correctamente gestionado en .env
- `WHAPI_TOKEN` - Correctamente gestionado en .env
- `BEDS24_TOKEN` - Correctamente gestionado en .env
- `ASSISTANT_ID` - Actualmente en config/assistant-config.json

### Datos de Ejemplo en Código 📝
Los siguientes son **datos de ejemplo** usados en funciones de testing y NO son secretos reales:
- `src/utils/logging/data-sanitizer.ts:324` - Ejemplo: `sk-1234567890abcdef1234567890abcdef`
- `src/utils/logging/data-sanitizer.ts:326` - Ejemplo: `whapi_abcd1234efgh5678ijkl9012mnop3456`

Estos son utilizados en la función `testSanitization()` para verificar que el sanitizador funciona correctamente.

### IDs en Documentación 📚
- `docs/ASSISTANT_MANAGEMENT.md` - Contiene ejemplos con assistant ID
- `docs/SISTEMA_ACTUALIZACION_RAG.md` - Contiene ejemplos con assistant ID

## 🛡️ Mejores Prácticas

### 1. Variables de Entorno
- Usar archivo `.env` para todos los secretos
- Nunca commitear `.env` al repositorio
- Usar `env.example` como plantilla

### 2. En Producción
- Usar Google Secret Manager (ya configurado)
- Configurar secretos en Railway Dashboard
- Rotar claves regularmente

### 3. En Documentación
- Usar placeholders como `[API_KEY]` o `[ASSISTANT_ID]`
- Marcar claramente qué son ejemplos
- No incluir IDs reales en documentación pública

## 📝 Recomendaciones Futuras

1. **Mover ASSISTANT_ID a variables de entorno**
   - Actualmente en `config/assistant-config.json`
   - Considerar moverlo a `.env` para consistencia

2. **Actualizar documentación con placeholders**
   - Reemplazar IDs reales con `[ASSISTANT_ID]` en docs
   - Agregar nota sobre dónde encontrar los valores reales

3. **Implementar validación de secretos al inicio**
   - Verificar que todas las variables requeridas estén presentes
   - Mostrar mensaje claro si faltan secretos
