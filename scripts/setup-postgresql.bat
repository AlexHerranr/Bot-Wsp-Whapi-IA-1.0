@echo off
echo ========================================
echo    CONFIGURACION DE POSTGRESQL
echo ========================================
echo.

set PGPATH="C:\Program Files\PostgreSQL\16\bin"
set PATH=%PGPATH%;%PATH%

echo 1. Verificando instalacion...
psql --version
echo.

echo 2. Intentando conectar como postgres...
echo    (Si solicita contraseña, usa la que configuraste durante la instalacion)
echo.

echo Comando para crear la base de datos:
echo %PGPATH%\createdb -U postgres tealquilamos_bot
echo.

echo Comando para crear usuario:
echo %PGPATH%\psql -U postgres -c "CREATE USER tealquilamos WITH ENCRYPTED PASSWORD 'tealquilamos2025';"
echo.

echo Comando para dar permisos:
echo %PGPATH%\psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE tealquilamos_bot TO tealquilamos;"
echo.

echo ========================================
echo Por favor ejecuta estos comandos manualmente:
echo.
echo 1. %PGPATH%\createdb -U postgres tealquilamos_bot
echo 2. %PGPATH%\psql -U postgres -c "CREATE USER tealquilamos WITH ENCRYPTED PASSWORD 'tealquilamos2025';"
echo 3. %PGPATH%\psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE tealquilamos_bot TO tealquilamos;"
echo.
echo Despues ejecuta: %PGPATH%\psql -U tealquilamos -d tealquilamos_bot -c "SELECT 'Conexion exitosa!' as status;"
echo ========================================
pause