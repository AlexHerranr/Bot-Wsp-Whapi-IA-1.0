# 📚 Referencia de API - Qwen Code CLI

## 🤖 Comandos Principales

### qwen --version
Verifica la versión instalada de Qwen CLI.

```bash
qwen --version
# Output: 0.0.1-alpha.12
```

### qwen --help
Muestra la ayuda del comando.

```bash
qwen --help
```

### qwen --prompt <texto> -c
Ejecuta un prompt específico en modo de completación.

```bash
qwen --prompt "Crea una función en JavaScript" -c
```

### qwen (modo interactivo)
Inicia el modo interactivo de Qwen CLI.

```bash
qwen
```

## 🔧 Variables de Entorno

### Variables Requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `OPENAI_API_KEY` | API key del proveedor | `sk-or-v1-...` |
| `OPENAI_BASE_URL` | URL base del proveedor | `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | Modelo a usar | `qwen/qwen3-coder-plus` |

### Variables Opcionales

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `QWEN_MAX_TOKENS` | Máximo de tokens | `65536` |
| `QWEN_TEMPERATURE` | Temperatura de generación | `0.7` |
| `QWEN_TOP_P` | Parámetro top_p | `0.9` |

## 🌐 Proveedores Soportados

### OpenRouter
```bash
OPENAI_API_KEY=sk-or-v1-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=qwen/qwen3-coder-plus
```

### Alibaba Cloud
```bash
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3-coder-plus
```

### HuggingFace
```bash
OPENAI_API_KEY=hf_...
OPENAI_BASE_URL=https://api-inference.huggingface.co/models/Qwen/Qwen3-Coder-Plus
OPENAI_MODEL=Qwen/Qwen3-Coder-Plus
```

## 📊 Modelos Disponibles

### Qwen3-Coder-Plus (480B parámetros)
- **Parámetros totales**: 480B
- **Parámetros activos**: 35B
- **Contexto**: 256K tokens
- **Lenguajes**: 358
- **Características**: Agentic coding, function calling, fill-in-middle

### Qwen3-Coder-30B (30B parámetros)
- **Parámetros totales**: 30B
- **Parámetros activos**: 3B
- **Contexto**: 256K tokens
- **Lenguajes**: 358
- **Características**: Agentic coding, function calling

## 🎯 Casos de Uso Específicos

### 1. Análisis de Código
```bash
qwen --prompt "Analiza este código y sugiere mejoras de rendimiento" -c
```

### 2. Generación de Tests
```bash
qwen --prompt "Genera tests unitarios para esta función JavaScript" -c
```

### 3. Refactorización
```bash
qwen --prompt "Refactoriza este código para mejorar la legibilidad" -c
```

### 4. Debugging
```bash
qwen --prompt "Encuentra y corrige los errores en este código" -c
```

### 5. Documentación
```bash
qwen --prompt "Genera documentación JSDoc para esta función" -c
```

## 🔍 Funciones Especiales

### Fill-in-the-Middle (FIM)
```python
prompt = '<|fim_prefix|>' + prefix_code + '<|fim_suffix|>' + suffix_code + '<|fim_middle|>'
```

### Function Calling
```python
# El modelo puede generar llamadas de función estructuradas
# usando el parser especializado qwen3coder_tool_parser.py
```

## 📝 Formatos de Respuesta

### Respuesta de Completación
```json
{
    "text": "código generado",
    "tokens_used": 150,
    "model": "qwen3-coder-plus"
}
```

### Respuesta de Error
```json
{
    "error": "descripción del error",
    "code": "ERROR_CODE",
    "details": "información adicional"
}
```

## ⚡ Optimizaciones

### Configuración de Tokens
```bash
# Para respuestas cortas
QWEN_MAX_TOKENS=1024

# Para respuestas largas
QWEN_MAX_TOKENS=65536
```

### Configuración de Temperatura
```bash
# Para código determinístico
QWEN_TEMPERATURE=0.1

# Para código creativo
QWEN_TEMPERATURE=0.8
```

## 🚨 Códigos de Error

| Código | Descripción | Solución |
|--------|-------------|----------|
| `API_KEY_MISSING` | API key no configurada | Configurar `OPENAI_API_KEY` |
| `INVALID_MODEL` | Modelo no válido | Verificar `OPENAI_MODEL` |
| `CONNECTION_FAILED` | Error de conexión | Verificar red y URL |
| `RATE_LIMIT` | Límite de velocidad | Esperar y reintentar |
| `CONTEXT_TOO_LONG` | Contexto muy largo | Reducir input |

## 🔧 Integración con Scripts

### PowerShell
```powershell
# Ejecutar con configuración específica
.\qwen\scripts\qwen-launcher.ps1 -Prompt "tu prompt" -Provider openrouter
```

### JavaScript/Node.js
```javascript
const { spawn } = require('child_process');

const qwenProcess = spawn('qwen', ['--prompt', 'tu prompt', '-c']);
```

### Python
```python
import subprocess

result = subprocess.run(['qwen', '--prompt', 'tu prompt', '-c'], 
                       capture_output=True, text=True)
```

## 📊 Métricas y Monitoreo

### Logs
Los logs se guardan en `qwen/logs/qwen-cli.log` con formato:
```
[2025-01-31 10:30:15] [INFO] Iniciando Qwen Code CLI con proveedor: openrouter
[2025-01-31 10:30:20] [INFO] Variables de OpenAI restauradas
```

### Métricas Recomendadas
- Tiempo de respuesta promedio
- Tasa de éxito de requests
- Uso de tokens por request
- Errores por proveedor

## 🔐 Seguridad

### Mejores Prácticas
1. **Nunca** committear API keys al repositorio
2. Usar variables de entorno para configuración
3. Rotar API keys regularmente
4. Monitorear uso de tokens
5. Implementar rate limiting

### Configuración Segura
```bash
# En .env (no committear)
OPENAI_API_KEY=tu_api_key_secreta

# En .gitignore
.env
qwen/config/qwen-config.env
```

---

**Para más información, consulta la documentación oficial de Qwen3-Coder.** 