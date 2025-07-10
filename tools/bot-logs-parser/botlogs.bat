@echo off
REM botlogs.bat - Acceso rápido a logs detallados del bot (Windows)
REM
REM MOTIVACIÓN:
REM ===========
REM Google Cloud Console es excelente para muchas cosas, pero pésimo para debugging rápido.
REM Este script es nuestra "puerta trasera" para obtener logs REALES, COMPLETOS y ÚTILES
REM en segundos, no minutos.
REM
REM PROBLEMA PRINCIPAL QUE RESUELVE:
REM ================================
REM En Cloud Console: Click → Expandir → Leer → Click → Expandir → Leer... (x100)
REM Con este script: botlogs → TODO visible instantáneamente
REM
REM EJEMPLOS DE USO REAL:
REM ====================
REM "El bot está lento hoy" → botlogs --hours 1
REM "Usuario X tiene problemas" → botlogs user 573003913251
REM "Hubo errores hace 3 horas" → botlogs errors --hours 3
REM "Necesito logs para el reporte" → botlogs --hours 24 > reporte.txt

set SCRIPT_DIR=%~dp0
set PYTHON_SCRIPT=%SCRIPT_DIR%parse_bot_logs.py

REM Verificar que el script Python existe
if not exist "%PYTHON_SCRIPT%" (
    echo ❌ Error: No se encuentra parse_bot_logs.py en %SCRIPT_DIR%
    exit /b 1
)

REM Verificar que Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Python no está instalado o no está en PATH
    echo Instalar Python desde: https://www.python.org/downloads/
    exit /b 1
)

REM Configurar PATH para incluir Python y gcloud si es necesario
set PATH=C:\Users\alex-\AppData\Local\Programs\Python\Python311;C:\Users\alex-\AppData\Local\Programs\Python\Python311\Scripts;C:\Users\alex-\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;%PATH%

REM Procesar argumentos
if "%1"=="help" goto :show_help
if "%1"=="--help" goto :show_help
if "%1"=="-h" goto :show_help
if "%1"=="errors" goto :errors_mode
if "%1"=="user" goto :user_mode

REM Verificar si el primer argumento es un número (horas)
echo %1| findstr /r "^[0-9][0-9]*$" >nul
if not errorlevel 1 (
    python "%PYTHON_SCRIPT%" --hours %1 %2 %3 %4 %5 %6 %7 %8 %9
    goto :end
)

REM Modo por defecto - pasar todos los argumentos
python "%PYTHON_SCRIPT%" %*
goto :end

:show_help
echo 🤖 Bot Logs Parser - Herramienta de análisis rápido
echo.
echo Uso básico:
echo   botlogs                    # últimas 2 horas
echo   botlogs 6                  # últimas 6 horas
echo   botlogs errors             # solo errores
echo   botlogs user 573003913251  # logs de usuario específico
echo.
echo Opciones avanzadas:
echo   botlogs --hours 12 --errors-only
echo   botlogs --user 573003913251 --hours 4
echo   botlogs --session session-123456
echo.
echo Flags especiales:
echo   --no-copy     No copiar al portapapeles
echo   --no-save     No guardar en archivo
echo   --help        Mostrar esta ayuda
echo.
echo 💡 Tip: Todos los logs se copian automáticamente al portapapeles
goto :end

:errors_mode
python "%PYTHON_SCRIPT%" --errors-only %2 %3 %4 %5 %6 %7 %8 %9
goto :end

:user_mode
if "%2"=="" (
    echo ❌ Error: Especifica el ID de usuario
    echo Ejemplo: botlogs user 573003913251
    exit /b 1
)
python "%PYTHON_SCRIPT%" --user %2 %3 %4 %5 %6 %7 %8 %9
goto :end

:end 