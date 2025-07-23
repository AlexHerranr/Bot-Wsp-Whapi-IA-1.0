# 🧩 Inventario de Funcionalidades - app-unified.ts (Enero 2025)

## Cambios recientes (Enero 2025)
- 🔥 **Eliminada toda lógica de análisis de contexto y disponibilidad arbitraria.**
- 🤖 **OpenAI ahora decide cuándo necesita contexto histórico o detalles adicionales usando function calling.**
- 🧹 Código más limpio, sin reglas rígidas ni thresholds manuales.
- 💾 **Unificación de caches completada**: Eliminados caches duplicados, centralizados en `historyInjection.ts`.

---

## Decisiones delegadas a OpenAI
- El bot ya no analiza ni decide cuándo inyectar contexto ni cuándo pedir detalles de disponibilidad.
- OpenAI puede solicitar contexto histórico con diferentes niveles (muy corto, corto, medio, largo) usando la función `get_conversation_context`.
- Si OpenAI necesita detalles para disponibilidad, los pide directamente al usuario.

---

## Optimizaciones de memoria implementadas
- ✅ **Caches unificados**: `historyCache` y `contextInjectionCache` centralizados en `historyInjection.ts`
- ✅ **Eliminación de duplicados**: No más caches redundantes en `app-unified.ts`
- ✅ **Cleanup centralizado**: Una sola función `cleanupExpiredCaches()` para todos los caches
- ✅ **Menor uso de memoria**: Eliminación de instancias duplicadas de caches

---

## Funcionalidades principales (actualizadas)
- Procesamiento de mensajes agrupados y envío a OpenAI
- Sincronización de perfil y etiquetas antes de cada procesamiento
- Manejo de buffer y colas de usuario
- Logging estructurado y métricas
- Manejo de locks y recuperación de runs huérfanos
- **Sin lógica de análisis de contexto ni disponibilidad**
- **Caches centralizados para optimización de memoria**

---

## Recomendaciones
- Mantener la delegación de decisiones a OpenAI para máxima flexibilidad y robustez.
- Revisar periódicamente los logs para detectar si OpenAI requiere ajustes en las funciones disponibles.
- Monitorear el uso de memoria después de la unificación de caches. 