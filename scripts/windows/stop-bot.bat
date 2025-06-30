@echo off
echo 🛑 Deteniendo Bot WhatsApp y ngrok...
echo.

REM Detener procesos de Node.js (bot)
echo 🔄 Deteniendo procesos de Node.js...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo ✅ Procesos de Node.js detenidos
) else (
    echo ℹ️  No había procesos de Node.js corriendo
)

REM Detener procesos de ngrok
echo 🔄 Deteniendo procesos de ngrok...
taskkill /F /IM ngrok.exe 2>nul
if %errorlevel% equ 0 (
    echo ✅ Procesos de ngrok detenidos
) else (
    echo ℹ️  No había procesos de ngrok corriendo
)

REM Verificar que el puerto 3008 esté libre
echo 🔍 Verificando que el puerto 3008 esté libre...
netstat -ano | findstr :3008 > nul
if %errorlevel% equ 0 (
    echo ⚠️  El puerto 3008 aún está en uso
    echo 💡 Puede que necesites cerrar las ventanas manualmente
) else (
    echo ✅ Puerto 3008 liberado correctamente
)

echo.
echo 🎉 Todos los procesos han sido detenidos
echo 💡 Para reiniciar, ejecuta: start-bot.bat
echo.
pause 