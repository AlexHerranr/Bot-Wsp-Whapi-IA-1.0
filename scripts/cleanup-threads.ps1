# 🗑️ SCRIPT DE LIMPIEZA DE THREADS OPENAI
# Utilidad para gestionar threads problemáticos

param(
    [Parameter(Position=0, Mandatory=$false)]
    [string]$Action = "help",
    
    [Parameter(Position=1, Mandatory=$false)]
    [string]$UserId = ""
)

$ErrorActionPreference = "Stop"

# Verificar que Node.js está disponible
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Node.js no encontrado" -ForegroundColor Red
    exit 1
}

# Cambiar al directorio del proyecto
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
Set-Location $projectRoot

Write-Host "🔧 UTILIDAD DE LIMPIEZA DE THREADS OPENAI" -ForegroundColor Cyan
Write-Host "Directorio del proyecto: $projectRoot" -ForegroundColor Gray
Write-Host ""

switch ($Action.ToLower()) {
    "help" {
        Write-Host "📋 COMANDOS DISPONIBLES:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  📊 Listar threads actuales:" -ForegroundColor Green
        Write-Host "     .\scripts\cleanup-threads.ps1 list" -ForegroundColor White
        Write-Host ""
        Write-Host "  🎯 Eliminar thread específico:" -ForegroundColor Green
        Write-Host "     .\scripts\cleanup-threads.ps1 user [USER_ID]" -ForegroundColor White
        Write-Host "     Ejemplo: .\scripts\cleanup-threads.ps1 user 573003913251" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  🗑️ Eliminar TODOS los threads:" -ForegroundColor Red
        Write-Host "     .\scripts\cleanup-threads.ps1 all" -ForegroundColor White
        Write-Host "     ⚠️  PRECAUCIÓN: Elimina todas las conversaciones" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  ❓ Mostrar esta ayuda:" -ForegroundColor Green
        Write-Host "     .\scripts\cleanup-threads.ps1 help" -ForegroundColor White
        Write-Host ""
    }
    
    "list" {
        Write-Host "📊 LISTANDO THREADS ACTUALES..." -ForegroundColor Yellow
        Write-Host ""
        
        try {
            & node -r ts-node/register src/utils/thread-cleanup.ts list
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "✅ Listado completado exitosamente" -ForegroundColor Green
            } else {
                Write-Host "❌ Error al listar threads" -ForegroundColor Red
            }
        } catch {
            Write-Host "Error ejecutando comando: $_" -ForegroundColor Red
        }
    }
    
    "user" {
        if ([string]::IsNullOrEmpty($UserId)) {
            Write-Host "❌ Error: Debes especificar un USER_ID" -ForegroundColor Red
            Write-Host "Ejemplo: .\scripts\cleanup-threads.ps1 user 573003913251" -ForegroundColor Gray
            exit 1
        }
        
        Write-Host "🎯 ELIMINANDO THREAD ESPECÍFICO..." -ForegroundColor Yellow
        Write-Host "Usuario: $UserId" -ForegroundColor Gray
        Write-Host ""
        
        # Confirmar acción
        $confirm = Read-Host "¿Estás seguro de eliminar el thread de $UserId? (y/N)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Host "❌ Operación cancelada" -ForegroundColor Yellow
            exit 0
        }
        
        try {
            & node -r ts-node/register src/utils/thread-cleanup.ts cleanup-user $UserId
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "✅ Thread eliminado exitosamente" -ForegroundColor Green
            } else {
                Write-Host "❌ Error al eliminar thread" -ForegroundColor Red
            }
        } catch {
            Write-Host "Error ejecutando comando: $_" -ForegroundColor Red
        }
    }
    
    "all" {
        Write-Host "🚨 ELIMINANDO TODOS LOS THREADS..." -ForegroundColor Red
        Write-Host ""
        Write-Host "⚠️  ADVERTENCIA: Esta acción eliminará TODAS las conversaciones activas" -ForegroundColor Yellow
        Write-Host "⚠️  Todos los usuarios tendrán que empezar conversaciones nuevas" -ForegroundColor Yellow
        Write-Host ""
        
        # Doble confirmación
        $confirm1 = Read-Host "¿Estás COMPLETAMENTE seguro? Escribe 'ELIMINAR TODO' para confirmar"
        if ($confirm1 -ne "ELIMINAR TODO") {
            Write-Host "❌ Operación cancelada (confirmación incorrecta)" -ForegroundColor Yellow
            exit 0
        }
        
        $confirm2 = Read-Host "Última confirmación. ¿Proceder con la eliminación? (y/N)"
        if ($confirm2 -ne "y" -and $confirm2 -ne "Y") {
            Write-Host "❌ Operación cancelada" -ForegroundColor Yellow
            exit 0
        }
        
        Write-Host ""
        Write-Host "🗑️ Eliminando todos los threads..." -ForegroundColor Red
        
        try {
            & node -r ts-node/register src/utils/thread-cleanup.ts cleanup-all
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "✅ Limpieza completa exitosa" -ForegroundColor Green
            } else {
                Write-Host "❌ Error en la limpieza" -ForegroundColor Red
            }
        } catch {
            Write-Host "Error ejecutando comando: $_" -ForegroundColor Red
        }
    }
    
    default {
        Write-Host "❌ Acción no reconocida: $Action" -ForegroundColor Red
        Write-Host "Usa: .\scripts\cleanup-threads.ps1 help" -ForegroundColor Gray
        exit 1
    }
}

Write-Host ""
Write-Host "🏁 Script completado" -ForegroundColor Gray 