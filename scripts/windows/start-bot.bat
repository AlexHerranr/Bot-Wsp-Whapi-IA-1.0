@echo off
echo 🤖 Iniciando Bot TeAlquilamos con IA...
echo.

REM Detener procesos existentes si los hay
echo 🛑 Deteniendo procesos existentes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
timeout /t 2 /nobreak > nul

REM Iniciar el bot en segundo plano
echo 🚀 Iniciando bot en nueva ventana...
start "Bot WhatsApp" cmd /k "cd /d %CD% && npm run dev"

REM Esperar a que el bot se inicie completamente
echo ⏳ Esperando que el bot se inicie (10 segundos)...
timeout /t 10 /nobreak > nul

REM Verificar que el puerto 3008 esté en uso
echo 🔍 Verificando que el bot esté corriendo...
netstat -ano | findstr :3008 > nul
if %errorlevel% neq 0 (
    echo ❌ Error: El bot no se inició correctamente
    echo ⏳ Esperando 5 segundos más...
    timeout /t 5 /nobreak > nul
    netstat -ano | findstr :3008 > nul
    if %errorlevel% neq 0 (
        echo ❌ Error: El bot no está corriendo en el puerto 3008
        pause
        exit /b 1
    )
)

echo ✅ Bot iniciado correctamente en puerto 3008

REM Iniciar ngrok con el dominio fijo
echo 🌐 Iniciando ngrok con dominio fijo...
start "ngrok" cmd /k "cd /d %CD% && ngrok http 3008 --domain=actual-bobcat-handy.ngrok-free.app"

echo.
echo 🎉 ¡Bot iniciado correctamente!
echo 📱 URL del bot: https://actual-bobcat-handy.ngrok-free.app
echo 🔍 Monitoreo: http://localhost:4040
echo.
echo 💡 Para detener todo, ejecuta: stop-bot.bat
echo.
pause 