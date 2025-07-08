# Configuración automática de Git para PowerShell
# Ejecutar: .\scripts\windows\git-setup.ps1

Write-Host "🔧 Configurando Git para PowerShell..." -ForegroundColor Green

# Crear función Git permanente
function git { & "C:\Program Files\Git\bin\git.exe" $args }

# Agregar la función al perfil de PowerShell
$ProfilePath = $PROFILE
if (!(Test-Path $ProfilePath)) {
    New-Item -Path $ProfilePath -Type File -Force
}

$GitFunction = 'function git { & "C:\Program Files\Git\bin\git.exe" $args }'
if (!(Get-Content $ProfilePath | Select-String "function git")) {
    Add-Content $ProfilePath $GitFunction
    Write-Host "✅ Función Git agregada al perfil de PowerShell" -ForegroundColor Green
} else {
    Write-Host "✅ Función Git ya existe en el perfil" -ForegroundColor Yellow
}

Write-Host "🎉 Git configurado correctamente!" -ForegroundColor Green
Write-Host "💡 Reinicia PowerShell para usar 'git' directamente" -ForegroundColor Cyan