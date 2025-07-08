# Configuracion Git para PowerShell - Version Simple
# Ejecutar UNA SOLA VEZ

Write-Host "Configurando Git para PowerShell..." -ForegroundColor Green

# Agregar Git al PATH del usuario
$GitPath = "C:\Program Files\Git\bin"
$CurrentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($CurrentPath -notlike "*$GitPath*") {
    $NewPath = $CurrentPath + ";" + $GitPath
    [Environment]::SetEnvironmentVariable("PATH", $NewPath, "User")
    Write-Host "Git agregado al PATH del usuario" -ForegroundColor Green
} else {
    Write-Host "Git ya esta en el PATH" -ForegroundColor Yellow
}

# Crear perfil si no existe
$ProfilePath = $PROFILE
if (!(Test-Path $ProfilePath)) {
    New-Item -Path $ProfilePath -Type File -Force
    Write-Host "Perfil de PowerShell creado" -ForegroundColor Green
}

# Funciones Git
$GitFunctions = @"
# Funciones Git automaticas
function git { & "C:\Program Files\Git\bin\git.exe" `$args }

function gitpush {
    Write-Host "Haciendo push automatico..." -ForegroundColor Green
    & "C:\Program Files\Git\bin\git.exe" add .
    `$commitMessage = if (`$args.Count -gt 0) { `$args -join " " } else { "Auto commit - `$(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
    & "C:\Program Files\Git\bin\git.exe" commit -m `$commitMessage
    & "C:\Program Files\Git\bin\git.exe" push origin master
    Write-Host "Push completado!" -ForegroundColor Green
}

function gitstatus {
    & "C:\Program Files\Git\bin\git.exe" status
}
"@

# Verificar si las funciones ya existen
$ProfileContent = if (Test-Path $ProfilePath) { Get-Content $ProfilePath -Raw } else { "" }
if ($ProfileContent -notlike "*function git*") {
    Add-Content $ProfilePath $GitFunctions
    Write-Host "Funciones Git agregadas al perfil" -ForegroundColor Green
} else {
    Write-Host "Funciones Git ya existen en el perfil" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "CONFIGURACION COMPLETADA!" -ForegroundColor Green
Write-Host "Comandos disponibles:" -ForegroundColor Cyan
Write-Host "  git - Comando git normal" -ForegroundColor White
Write-Host "  gitpush - Push automatico" -ForegroundColor White
Write-Host "  gitstatus - Ver estado" -ForegroundColor White
Write-Host ""
Write-Host "Reinicia PowerShell para usar los comandos" -ForegroundColor Yellow 