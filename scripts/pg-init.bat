@echo off
echo Configurando PostgreSQL...

set PGPATH=C:\Program Files\PostgreSQL\16\bin
set PGDATA=C:\Program Files\PostgreSQL\16\data

echo 1. Inicializando PostgreSQL...
"%PGPATH%\initdb" -D "%PGDATA%" -U postgres --auth-local=trust --auth-host=md5 --encoding=UTF8 --locale=C

echo 2. Iniciando servicio...
"%PGPATH%\pg_ctl" -D "%PGDATA%" -l "%PGDATA%\logfile" start

timeout /t 3 >nul

echo 3. Creando base de datos...
"%PGPATH%\createdb" -U postgres tealquilamos_bot

echo 4. Creando usuario...
"%PGPATH%\psql" -U postgres -c "CREATE USER tealquilamos WITH ENCRYPTED PASSWORD 'tealquilamos2025';"

echo 5. Dando permisos...
"%PGPATH%\psql" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE tealquilamos_bot TO tealquilamos;"
"%PGPATH%\psql" -U postgres -d tealquilamos_bot -c "GRANT ALL ON SCHEMA public TO tealquilamos;"

echo 6. Verificando...
"%PGPATH%\psql" -U tealquilamos -d tealquilamos_bot -c "SELECT 'Conexion exitosa!' as status;"

echo.
echo CONFIGURACION COMPLETADA
echo URL: postgresql://tealquilamos:tealquilamos2025@localhost:5432/tealquilamos_bot