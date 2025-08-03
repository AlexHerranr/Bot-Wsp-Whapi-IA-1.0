# 🤖 Qwen Code CLI - Documentación Técnica

## 📋 Información General

**Qwen3-Coder** es un modelo de inteligencia artificial especializado en codificación desarrollado por Alibaba, con capacidades agenticas avanzadas para desarrollo de software.

### 🎯 Características Principales

- **480B parámetros** con 35B parámetros activos (tecnología MOE)
- **Ventana de contexto**: 256K tokens nativos, extensible a 1M
- **358 lenguajes de programación** soportados
- **Capacidades agenticas** para coding, browsing y tool-use
- **Compatibilidad OpenAI** para fácil integración

## 🚀 Instalación y Configuración

### Requisitos Previos

```bash
# Verificar Node.js (requiere 20.19.4+)
node --version  # Debe ser >= 20.19.4
npm --version
```

### Instalación de Qwen CLI

```bash
# Instalar Qwen Code CLI globalmente
npm install -g @qwen-code/qwen-code

# Verificar instalación
qwen --version
```

### Configuración de Variables de Entorno

El sistema usa variables de entorno compatibles con OpenAI para facilitar la integración:

```bash
# Variables requeridas
OPENAI_API_KEY=tu_api_key_de_qwen
OPENAI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3-coder-plus
```

## 🔧 Proveedores Soportados

### 1. 🌐 OpenRouter (Recomendado para pruebas)
```bash
OPENAI_API_KEY=tu_api_key_de_openrouter
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=qwen/qwen3-coder-plus
```

### 2. 🏢 Alibaba Cloud (Directo)
```bash
OPENAI_API_KEY=tu_api_key_de_alibaba
OPENAI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3-coder-plus
```

### 3. 🤗 HuggingFace
```bash
OPENAI_API_KEY=tu_api_key_de_huggingface
OPENAI_BASE_URL=https://api-inference.huggingface.co/models/Qwen/Qwen3-Coder-Plus
OPENAI_MODEL=Qwen/Qwen3-Coder-Plus
```

## 📁 Estructura de Archivos

```
qwen/
├── README.md                    # Esta documentación
├── config/
│   ├── qwen-config.env         # Configuración de variables
│   └── settings.json           # Configuración avanzada
├── scripts/
│   ├── qwen-launcher.ps1       # Wrapper principal (PowerShell)
│   ├── qwen-wrapper.ps1        # Wrapper básico
│   └── qwen-test.ps1           # Script de pruebas
├── examples/
│   ├── coding-examples/        # Ejemplos de código
│   ├── prompts/                # Prompts de ejemplo
│   └── integrations/           # Integraciones con el proyecto
└── docs/
    ├── api-reference.md        # Referencia de API
    ├── troubleshooting.md      # Solución de problemas
    └── best-practices.md       # Mejores prácticas
```

## 🎯 Integración con el Proyecto

### Uso Básico

```powershell
# Modo interactivo
.\qwen\scripts\qwen-launcher.ps1 -Interactive -Provider openrouter

# Comando directo
.\qwen\scripts\qwen-launcher.ps1 -Prompt "Analiza este código" -Provider openrouter
```

### Integración con el Bot

```javascript
// Ejemplo de integración en el bot
const { spawn } = require('child_process');

async function runQwenCode(prompt) {
    return new Promise((resolve, reject) => {
        const qwenProcess = spawn('powershell', [
            '-ExecutionPolicy', 'Bypass',
            '-File', './qwen/scripts/qwen-launcher.ps1',
            '-Prompt', prompt,
            '-Provider', 'openrouter'
        ]);

        let output = '';
        qwenProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        qwenProcess.on('close', (code) => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(`Qwen process exited with code ${code}`));
            }
        });
    });
}
```

## 🔍 Capacidades Técnicas

### Lenguajes Soportados (358 totales)

```python
# Lista completa de lenguajes soportados
languages = [
    'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go',
    'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'Scala', 'R',
    'MATLAB', 'Julia', 'Haskell', 'Erlang', 'Elixir', 'Clojure',
    'Lisp', 'Prolog', 'Assembly', 'C', 'C#', 'Objective-C',
    # ... y muchos más
]
```

### Funciones Especiales

1. **Fill-in-the-Middle (FIM)**
   ```python
   prompt = '<|fim_prefix|>' + prefix_code + '<|fim_suffix|>' + suffix_code + '<|fim_middle|>'
   ```

2. **Function Calling**
   - Soporte para llamadas de función estructuradas
   - Parser especializado: `qwen3coder_tool_parser.py`

3. **Contexto Extendido**
   - 256K tokens nativos
   - Extensible a 1M tokens con Yarn

## 📊 Comparación de Modelos

| Modelo | Parámetros | Activos | Contexto | Tipo |
|--------|------------|---------|----------|------|
| Qwen3-Coder-480B-A35B-Instruct | 480B | 35B | 256K | Instruct |
| Qwen3-Coder-30B-A3B-Instruct | 30B | 3B | 256K | Instruct |

## 🛠️ Scripts de Utilidad

### qwen-launcher.ps1
Script principal que maneja:
- Carga de configuración desde archivo
- Aislamiento de variables de entorno
- Soporte para múltiples proveedores
- Restauración automática de configuración

### qwen-test.ps1
Script de pruebas que verifica:
- Conexión con el modelo
- Configuración de variables
- Funcionalidad básica

## 🔧 Configuración Avanzada

### settings.json
```json
{
    "providers": {
        "openrouter": {
            "api_key": "env:OPENAI_API_KEY",
            "base_url": "https://openrouter.ai/api/v1",
            "model": "qwen/qwen3-coder-plus"
        },
        "alibaba": {
            "api_key": "env:OPENAI_API_KEY",
            "base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
            "model": "qwen3-coder-plus"
        }
    },
    "default_provider": "openrouter",
    "max_tokens": 65536,
    "temperature": 0.7
}
```

## 🚨 Solución de Problemas

### Error: "API key not found"
```bash
# Verificar variables de entorno
echo $env:OPENAI_API_KEY
echo $env:OPENAI_BASE_URL
echo $env:OPENAI_MODEL
```

### Error: "Connection failed"
```bash
# Probar conectividad
curl -X GET "https://openrouter.ai/api/v1/models" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Error: "Model not found"
- Verificar nombre del modelo según proveedor
- Confirmar que el modelo esté disponible en el proveedor

## 📚 Recursos Adicionales

- [Documentación Oficial](https://qwen.readthedocs.io/)
- [Blog Técnico](https://qwenlm.github.io/blog/qwen3-coder)
- [Hugging Face](https://huggingface.co/collections/Qwen/qwen3-coder-687fc861e53c939e52d52d10)
- [ModelScope](https://modelscope.cn/organization/qwen)
- [Paper Técnico](https://arxiv.org/abs/2505.09388)

## 🎯 Casos de Uso

### 1. Análisis de Código
```powershell
.\qwen\scripts\qwen-launcher.ps1 -Prompt "Analiza este código y sugiere mejoras" -Provider openrouter
```

### 2. Generación de Tests
```powershell
.\qwen\scripts\qwen-launcher.ps1 -Prompt "Genera tests unitarios para esta función" -Provider openrouter
```

### 3. Refactorización
```powershell
.\qwen\scripts\qwen-launcher.ps1 -Prompt "Refactoriza este código para mejorar la legibilidad" -Provider openrouter
```

### 4. Debugging
```powershell
.\qwen\scripts\qwen-launcher.ps1 -Prompt "Encuentra y corrige los errores en este código" -Provider openrouter
```

---

**¡Listo para usar Qwen Code CLI en tu proyecto!** 🚀 