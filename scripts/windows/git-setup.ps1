# Configuración automática de Git para PowerShell - SOLUCIÓN PERMANENTE
# Ejecutar UNA SOLA VEZ: .\scripts\windows\git-setup.ps1

Write-Host "🔧 Configurando Git PERMANENTEMENTE para PowerShell..." -ForegroundColor Green

# 1. Agregar Git al PATH del sistema
$GitPath = "C:\Program Files\Git\bin"
$CurrentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($CurrentPath -notlike "*$GitPath*") {
    $NewPath = "$CurrentPath;$GitPath"
    [Environment]::SetEnvironmentVariable("PATH", $NewPath, "User")
    Write-Host "✅ Git agregado al PATH del usuario" -ForegroundColor Green
} else {
    Write-Host "✅ Git ya está en el PATH" -ForegroundColor Yellow
}

# 2. Crear funciones útiles en el perfil de PowerShell
$ProfilePath = $PROFILE
if (!(Test-Path $ProfilePath)) {
    New-Item -Path $ProfilePath -Type File -Force
    Write-Host "✅ Perfil de PowerShell creado" -ForegroundColor Green
}

# 3. Funciones Git mejoradas
$GitFunctions = @'
# Funciones Git automáticas
function git { & "C:\Program Files\Git\bin\git.exe" $args }

function gitpush {
    Write-Host "🚀 Haciendo push automático..." -ForegroundColor Green
    & "C:\Program Files\Git\bin\git.exe" add .
    $commitMessage = if ($args.Count -gt 0) { $args -join " " } else { "Auto commit - $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
    & "C:\Program Files\Git\bin\git.exe" commit -m $commitMessage
    & "C:\Program Files\Git\bin\git.exe" push origin master
    Write-Host "✅ Push completado!" -ForegroundColor Green
}

function gitstatus {
    & "C:\Program Files\Git\bin\git.exe" status
}

function gitlog {
    & "C:\Program Files\Git\bin\git.exe" log --oneline -10
}
'@

# 4. Verificar si las funciones ya existen
$ProfileContent = if (Test-Path $ProfilePath) { Get-Content $ProfilePath -Raw } else { "" }
if ($ProfileContent -notlike "*function git*") {
    Add-Content $ProfilePath $GitFunctions
    Write-Host "✅ Funciones Git agregadas al perfil" -ForegroundColor Green
} else {
    Write-Host "✅ Funciones Git ya existen en el perfil" -ForegroundColor Yellow
}

# 5. Recargar el perfil actual
. $ProfilePath

Write-Host ""
Write-Host "🎉 CONFIGURACIÓN COMPLETADA!" -ForegroundColor Green
Write-Host "📋 Comandos disponibles:" -ForegroundColor Cyan
Write-Host "   • git          - Comando git normal" -ForegroundColor White
Write-Host "   • gitpush      - Push automático (add + commit + push)" -ForegroundColor White
Write-Host "   • gitstatus    - Ver estado del repositorio" -ForegroundColor White
Write-Host "   • gitlog       - Ver últimos 10 commits" -ForegroundColor White
Write-Host ""
Write-Host "💡 Ejemplo de uso: gitpush 'Mi mensaje de commit'" -ForegroundColor Yellow
Write-Host "💡 O simplemente: gitpush (usará mensaje automático)" -ForegroundColor Yellow