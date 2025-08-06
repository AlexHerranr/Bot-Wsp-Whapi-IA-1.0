@echo off
echo 📥 Descargando logs de Railway...
set timestamp=%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%
set timestamp=%timestamp: =0%
set filename=logs\railway\railway-logs-%timestamp%.log

echo ⏳ Ejecutando railway logs...
railway logs --deployment | head -1000 > %filename%

echo ✅ Logs guardados en: %filename%
dir %filename%