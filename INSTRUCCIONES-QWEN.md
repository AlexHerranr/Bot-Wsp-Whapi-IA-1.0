# 🚀 Instrucciones para Qwen-Code CLI

## ✅ Instalación Completada

Qwen-Code ya está instalado correctamente en tu sistema:
- **Versión**: 0.0.4
- **Comando**: `qwen`

## 🔑 Configuración de API Key

### Paso 1: Obtener API Key de Alibaba Cloud ModelStudio

1. **Ve a**: https://modelstudio.console.alibabacloud.com/
2. **Regístrate/Inicia sesión** (necesitarás tarjeta de crédito para verificación, pero es gratis)
3. **Activa ModelStudio** - te dan tokens gratis para probar
4. **Ve a API Key** y genera una nueva API key
5. **Copia la API key**

### Paso 2: Configurar las Variables

**Opción A: Usar el script automático (Recomendado)**

1. Edita el archivo `start-qwen.ps1`
2. Reemplaza `your_api_key_here` con tu API key real
3. Ejecuta: `.\start-qwen.ps1`

**Opción B: Configurar manualmente**

```powershell
$env:OPENAI_API_KEY = "tu_api_key_aqui"
$env:OPENAI_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
$env:OPENAI_MODEL = "qwen3-coder-plus"
qwen
```

## 🎯 Uso de Qwen-Code

### Comandos Básicos

```bash
# Iniciar Qwen-Code
qwen

# Comandos dentro de Qwen-Code
/help          # Ver comandos disponibles
/clear         # Limpiar historial
/compress      # Comprimir historial para ahorrar tokens
/status        # Ver uso de tokens
/exit          # Salir
```

### Ejemplos de Uso

```bash
# Analizar código
> Describe la arquitectura de este proyecto
> Encuentra todos los endpoints de la API
> Refactoriza esta función para mejorar rendimiento

# Generar código
> Crea un endpoint REST para gestión de usuarios
> Genera tests unitarios para el módulo de autenticación
> Implementa un rate limiter middleware

# Automatizar tareas
> Analiza commits de los últimos 7 días
> Encuentra todos los TODO y crea issues de GitHub
> Convierte todas las imágenes a PNG
```

## 🔧 Configuración Avanzada

### Límite de Tokens por Sesión

Crea el archivo: `C:\Users\alex-\.qwen\settings.json`

```json
{
  "sessionTokenLimit": 32000
}
```

### Variables de Entorno Permanentes

Si quieres configurar las variables permanentemente (opcional):

```powershell
# Agregar al perfil de PowerShell
notepad $PROFILE

# Agregar estas líneas:
$env:QWEN_OPENAI_API_KEY = "tu_api_key_aqui"
$env:QWEN_OPENAI_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
$env:QWEN_OPENAI_MODEL = "qwen3-coder-plus"
```

## 🎮 Pruebas del Tutorial

Según el youtuber, puedes probar estos comandos:

1. **Simulador de Asteroides**:
   ```
   > Crea un website que muestre una simulación en 3D de distintos asteroides golpeando a la Tierra
   ```

2. **App de Fútbol**:
   ```
   > Crea un clon de Letterboxd pero para hacer reviews y compartir opiniones de partidos de fútbol
   ```

3. **Juego Snake**:
   ```
   > Crea un juego del Snake en JavaScript
   ```

## ⚠️ Notas Importantes

- **Tokens**: Qwen-Code puede hacer múltiples llamadas API por ciclo, resultando en mayor uso de tokens
- **Gratis**: ModelStudio te da tokens gratis para probar
- **Regional**: Para usuarios internacionales usa la URL `dashscope-intl.aliyuncs.com`
- **Modelo**: Usa `qwen3-coder-plus` para mejores resultados

## 🆘 Solución de Problemas

### Error de API Key
- Verifica que la API key esté correcta
- Asegúrate de que ModelStudio esté activado
- Verifica que estés usando la URL correcta para tu región

### Error de Conexión
- Verifica tu conexión a internet
- Intenta con una VPN si hay problemas de conectividad

### Error de Tokens
- Usa `/compress` para comprimir el historial
- Usa `/clear` para empezar una nueva sesión
- Verifica tu límite de tokens en ModelStudio

## 📚 Recursos Adicionales

- **Documentación oficial**: https://github.com/QwenLM/qwen-code
- **ModelStudio**: https://modelstudio.console.alibabacloud.com/
- **Precios**: https://www.alibabacloud.com/help/en/... 