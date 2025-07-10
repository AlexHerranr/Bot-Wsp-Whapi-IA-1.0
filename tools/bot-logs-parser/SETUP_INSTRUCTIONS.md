# Instrucciones de Instalación - Bot Logs Parser

## Estado Actual
- ✅ Scripts creados: `parse_bot_logs.py`, `botlogs.bat`
- ❌ Python no está instalado en el sistema
- ❌ Dependencias pendientes

## Instalación Paso a Paso

### 1. Instalar Python
```
1. Ir a https://www.python.org/downloads/
2. Descargar Python 3.9+ (recomendado)
3. Durante la instalación, MARCAR "Add Python to PATH"
4. Verificar instalación abriendo nueva terminal:
   python --version
```

### 2. Instalar Google Cloud SDK
```
1. Ir a https://cloud.google.com/sdk/docs/install
2. Descargar Google Cloud SDK
3. Seguir el instalador
4. Abrir nueva terminal y ejecutar:
   gcloud init
5. Autenticar con tu cuenta de Google
6. Seleccionar proyecto: gen-lang-client-0318357688
```

### 3. Instalar dependencias Python
```cmd
# Una vez Python esté instalado:
python -m pip install pyperclip
```

### 4. Verificar instalación
```cmd
# Verificar Python
python --version

# Verificar gcloud
gcloud --version

# Verificar acceso al proyecto
gcloud config get-value project

# Probar el script
python parse_bot_logs.py --help
```

## Uso después de la instalación

### Comandos básicos
```cmd
# Usar el script batch (recomendado)
botlogs.bat

# O directamente con Python
python parse_bot_logs.py

# Ejemplos
botlogs.bat 6                    # últimas 6 horas
botlogs.bat errors               # solo errores
botlogs.bat user 573003913251    # logs de usuario
```

## Solución de Problemas

### Python no se encuentra
- Reinstalar Python marcando "Add to PATH"
- Reiniciar terminal/PowerShell
- Usar `py` en lugar de `python` si es necesario

### gcloud no funciona
- Verificar que Google Cloud SDK esté instalado
- Ejecutar `gcloud auth login`
- Configurar proyecto: `gcloud config set project gen-lang-client-0318357688`

### pyperclip no funciona
- En Windows debería funcionar automáticamente
- Si hay problemas, el script funcionará sin copia al portapapeles

## Archivos Creados

1. **parse_bot_logs.py** - Script principal con todas las funcionalidades
2. **botlogs.bat** - Script batch para Windows (uso fácil)
3. **botlogs** - Script bash para Linux/Mac (si es necesario)
4. **requirements.txt** - Dependencias Python
5. **README_BOT_LOGS.md** - Documentación completa

## Próximos Pasos

1. Instalar Python + Google Cloud SDK
2. Ejecutar `python parse_bot_logs.py --help` para verificar
3. Probar con `botlogs.bat` para obtener logs reales
4. Reportar cualquier problema para ajustar el script

## Objetivo Final

Transformar esto:
```
😫 15 minutos navegando en Cloud Console
😫 Clicks infinitos expandiendo logs
😫 Contexto perdido
😫 Imposible copiar/compartir
```

En esto:
```
😎 botlogs.bat
😎 Logs completos en 10 segundos
😎 Contexto automático
😎 Copia al portapapeles lista
```

¡El debugging en producción será TAN FÁCIL como en desarrollo local! 