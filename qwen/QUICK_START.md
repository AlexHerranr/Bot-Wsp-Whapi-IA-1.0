# 🚀 Inicio Rápido - Qwen Code CLI

## ✅ Instalación Completada

Qwen CLI ya está instalado en tu sistema (versión 0.0.1-alpha.12).

## 🔧 Configuración Rápida

### Paso 1: Obtener API Key Gratuita
1. Ve a https://openrouter.ai/
2. Crea una cuenta gratuita
3. Obtén tu API key
4. Tienes créditos gratuitos para pruebas

### Paso 2: Configurar Variables
Edita `qwen/config/qwen-config.env`:
```env
QWEN_API_KEY=tu_api_key_de_openrouter_aqui
QWEN_BASE_URL=https://openrouter.ai/api/v1
QWEN_MODEL=qwen/qwen3-coder-plus
```

### Paso 3: Probar Instalación
```powershell
.\qwen\scripts\qwen-test.ps1
```

## 🎯 Uso Básico

### Modo Interactivo
```powershell
.\qwen\scripts\qwen-launcher.ps1 -Interactive -Provider openrouter
```

### Comando Directo
```powershell
.\qwen\scripts\qwen-launcher.ps1 -Prompt "Crea una función en JavaScript" -Provider openrouter
```

## 📋 Comandos Útiles

| Comando | Descripción |
|---------|-------------|
| `.\qwen\scripts\qwen-launcher.ps1 -Help` | Mostrar ayuda |
| `.\qwen\scripts\qwen-test.ps1` | Probar instalación |
| `.\qwen\scripts\qwen-launcher.ps1 -Interactive` | Modo interactivo |
| `.\qwen\scripts\qwen-launcher.ps1 -Prompt "texto"` | Comando directo |

## 🔍 Verificación

### Verificar Instalación
```powershell
qwen --version
# Debe mostrar: 0.0.1-alpha.12
```

### Verificar Configuración
```powershell
.\qwen\scripts\qwen-test.ps1 -Verbose
```

## 🎯 Casos de Uso

### 1. Análisis de Código
```powershell
.\qwen\scripts\qwen-launcher.ps1 -Prompt "Analiza este código JavaScript y sugiere mejoras" -Provider openrouter
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

## 🛡️ Aislamiento de Variables

El script `qwen-launcher.ps1`:
- ✅ **Guarda** tus variables actuales de OpenAI
- ✅ **Configura** temporalmente las variables para Qwen
- ✅ **Ejecuta** Qwen Code
- ✅ **Restaura** automáticamente tus variables originales

## 📁 Estructura de Archivos

```
qwen/
├── README.md                    # Documentación completa
├── QUICK_START.md              # Esta guía
├── config/
│   ├── qwen-config.env         # Configuración de variables
│   └── settings.json           # Configuración avanzada
├── scripts/
│   ├── qwen-launcher.ps1       # Script principal
│   └── qwen-test.ps1           # Script de pruebas
├── examples/
│   └── coding-examples/        # Ejemplos de código
├── integrations/
│   └── bot-integration.js      # Integración con bot
└── docs/
    └── api-reference.md        # Referencia de API
```

## 🚨 Solución de Problemas

### Error: "API key not found"
- Verifica que tu API key esté en `qwen/config/qwen-config.env`
- Asegúrate de que no tenga espacios extra

### Error: "Connection failed"
- Verifica tu conexión a internet
- Confirma que el proveedor esté activo

### Error: "Model not found"
- Verifica que el nombre del modelo sea correcto
- Usa el proveedor correcto para cada modelo

## 📚 Recursos

- [Documentación Completa](qwen/README.md)
- [Referencia de API](qwen/docs/api-reference.md)
- [Integración con Bot](qwen/integrations/bot-integration.js)
- [Ejemplos de Código](qwen/examples/coding-examples/)

## 🎉 ¡Listo!

**Qwen Code CLI está configurado y listo para usar con tu proyecto.**

### Próximos Pasos:
1. **Obtén tu API key** de OpenRouter
2. **Configura** las variables en `qwen/config/qwen-config.env`
3. **Prueba** con: `.\qwen\scripts\qwen-launcher.ps1 -Interactive`
4. **¡Disfruta** de Qwen3-Coder sin conflictos!

---

**Para más información, consulta la documentación completa en `qwen/README.md`** 📖 