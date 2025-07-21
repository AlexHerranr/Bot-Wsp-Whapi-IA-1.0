# Script para sincronizar con cambios de Cursor Agent
Write-Host "🔄 Sincronizando con cambios de Cursor Agent..." -ForegroundColor Yellow

# Obtener cambios del remoto
& "C:\Program Files\Git\bin\git.exe" fetch origin

# Verificar si hay cambios
$status = & "C:\Program Files\Git\bin\git.exe" status --porcelain
$behind = & "C:\Program Files\Git\bin\git.exe" rev-list --count HEAD..origin/master

if ($behind -gt 0) {
    Write-Host "📥 Hay $behind commits nuevos de Cursor Agent" -ForegroundColor Green
    
    # Guardar cambios locales si existen
    if ($status) {
        Write-Host "💾 Guardando cambios locales..." -ForegroundColor Yellow
        & "C:\Program Files\Git\bin\git.exe" stash
    }
    
    # Actualizar master
    & "C:\Program Files\Git\bin\git.exe" checkout master
    & "C:\Program Files\Git\bin\git.exe" pull origin master
    
    # Actualizar rama de desarrollo
    & "C:\Program Files\Git\bin\git.exe" checkout desarrollo-local
    & "C:\Program Files\Git\bin\git.exe" merge master
    
    # Restaurar cambios locales si existían
    if ($status) {
        Write-Host "📤 Restaurando cambios locales..." -ForegroundColor Yellow
        & "C:\Program Files\Git\bin\git.exe" stash pop
    }
    
    Write-Host "✅ Sincronización completada" -ForegroundColor Green
} else {
    Write-Host "✅ Ya estás actualizado" -ForegroundColor Green
} 