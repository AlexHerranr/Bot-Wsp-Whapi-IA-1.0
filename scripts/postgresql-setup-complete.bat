@echo off
echo ========================================
echo   CONFIGURACION COMPLETA DE POSTGRESQL
echo ========================================
echo.

set PGPATH=C:\Program Files\PostgreSQL\16\bin
set PGDATA=C:\Program Files\PostgreSQL\16\data
set PATH=%PGPATH%;%PATH%

echo 1. INICIALIZANDO BASE DE DATOS...
echo.

REM Verificar si ya existe data directory
if exist "%PGDATA%" (
    echo Base de datos ya inicializada en: %PGDATA%
    echo Procediendo a iniciar el servicio...
    goto START_SERVICE
) else (
    echo Inicializando nueva base de datos...
    "%PGPATH%\initdb" -D "%PGDATA%" -U postgres --auth-local=trust --auth-host=md5 --encoding=UTF8 --locale=C
    if errorlevel 1 (
        echo ERROR: No se pudo inicializar la base de datos
        pause
        exit /b 1
    )
)

:START_SERVICE
echo.
echo 2. INICIANDO SERVICIO POSTGRESQL...
echo.

REM Intentar iniciar PostgreSQL
"%PGPATH%\pg_ctl" -D "%PGDATA%" -l "%PGDATA%\logfile" start
if errorlevel 1 (
    echo PostgreSQL ya esta ejecutandose o hay un error
    echo Verificando estado...
    "%PGPATH%\pg_ctl" -D "%PGDATA%" status
)

timeout /t 3 >nul

echo.
echo 3. CONFIGURANDO CONTRASEÑA PARA POSTGRES...
echo.

REM Configurar contraseña para usuario postgres
"%PGPATH%\psql" -U postgres -c "ALTER USER postgres PASSWORD 'postgres123';"
if errorlevel 1 (
    echo Intentando con createuser...
    "%PGPATH%\createuser" -s postgres
    "%PGPATH%\psql" -U postgres -c "ALTER USER postgres PASSWORD 'postgres123';"
)

echo.
echo 4. CREANDO BASE DE DATOS Y USUARIO...
echo.

REM Crear base de datos
"%PGPATH%\createdb" -U postgres tealquilamos_bot
if errorlevel 1 (
    echo La base de datos ya existe o hubo un error
)

REM Crear usuario para la aplicación
"%PGPATH%\psql" -U postgres -c "CREATE USER tealquilamos WITH ENCRYPTED PASSWORD 'tealquilamos2025';"
if errorlevel 1 (
    echo El usuario ya existe o hubo un error
)

REM Dar permisos
"%PGPATH%\psql" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE tealquilamos_bot TO tealquilamos;"
"%PGPATH%\psql" -U postgres -d tealquilamos_bot -c "GRANT ALL ON SCHEMA public TO tealquilamos;"

echo.
echo 5. VERIFICANDO CONFIGURACION...
echo.

"%PGPATH%\psql" -U tealquilamos -d tealquilamos_bot -c "SELECT 'Conexion exitosa como tealquilamos!' as status;"

echo.
echo ========================================
echo CONFIGURACION COMPLETADA
echo ========================================
echo.
echo Credenciales:
echo - Usuario admin: postgres / postgres123
echo - Usuario app:   tealquilamos / tealquilamos2025  
echo - Base de datos: tealquilamos_bot
echo - Host: localhost
echo - Puerto: 5432
echo.
echo URL de conexion:
echo postgresql://tealquilamos:tealquilamos2025@localhost:5432/tealquilamos_bot
echo.
pause