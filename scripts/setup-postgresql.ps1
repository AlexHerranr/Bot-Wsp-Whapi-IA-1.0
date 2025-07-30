# Setup PostgreSQL desde PowerShell
Write-Host "🐘 CONFIGURANDO POSTGRESQL DESDE POWERSHELL" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

$PGPATH = "C:\Program Files\PostgreSQL\16\bin"
$PGDATA = "C:\Program Files\PostgreSQL\16\data"
$env:PATH = "$PGPATH;$env:PATH"

# 1. Verificar si data directory ya existe
if (Test-Path $PGDATA) {
    Write-Host "✅ Data directory ya existe: $PGDATA" -ForegroundColor Yellow
    Write-Host "Saltando inicialización..." -ForegroundColor Yellow
} else {
    Write-Host "📂 Inicializando cluster PostgreSQL..." -ForegroundColor Cyan
    & "$PGPATH\initdb.exe" -D $PGDATA -U postgres --auth-local=trust --auth-host=md5 --encoding=UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error inicializando PostgreSQL" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ PostgreSQL inicializado correctamente" -ForegroundColor Green
}

# 2. Iniciar PostgreSQL
Write-Host "🚀 Iniciando servicio PostgreSQL..." -ForegroundColor Cyan
& "$PGPATH\pg_ctl.exe" -D $PGDATA -l "$PGDATA\logfile" start
Start-Sleep -Seconds 3

# 3. Verificar que esté ejecutándose
$status = & "$PGPATH\pg_ctl.exe" -D $PGDATA status
Write-Host "📊 Estado: $status" -ForegroundColor Yellow

# 4. Crear base de datos
Write-Host "📋 Creando base de datos 'tealquilamos_bot'..." -ForegroundColor Cyan
& "$PGPATH\createdb.exe" -U postgres tealquilamos_bot
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Base de datos creada exitosamente" -ForegroundColor Green
} else {
    Write-Host "⚠️ Base de datos ya existe o hubo un error" -ForegroundColor Yellow
}

# 5. Crear usuario y dar permisos
Write-Host "👤 Creando usuario 'tealquilamos'..." -ForegroundColor Cyan

$createUserSQL = "CREATE USER tealquilamos WITH ENCRYPTED PASSWORD 'tealquilamos2025';"
$grantSQL = "GRANT ALL PRIVILEGES ON DATABASE tealquilamos_bot TO tealquilamos;"
$grantSchemaSQL = "GRANT ALL ON SCHEMA public TO tealquilamos;"

& "$PGPATH\psql.exe" -U postgres -c $createUserSQL
& "$PGPATH\psql.exe" -U postgres -c $grantSQL
& "$PGPATH\psql.exe" -U postgres -d tealquilamos_bot -c $grantSchemaSQL

# 6. Verificar conexión
Write-Host "🔍 Verificando conexión..." -ForegroundColor Cyan
$testSQL = "SELECT 'Conexion exitosa desde PowerShell!' as status;"
& "$PGPATH\psql.exe" -U tealquilamos -d tealquilamos_bot -c $testSQL

Write-Host "" 
Write-Host "🎉 CONFIGURACION COMPLETADA" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host "URL de conexión:" -ForegroundColor Yellow
Write-Host "postgresql://tealquilamos:tealquilamos2025@localhost:5432/tealquilamos_bot" -ForegroundColor White
Write-Host ""