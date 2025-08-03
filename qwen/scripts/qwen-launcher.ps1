# Qwen Code Launcher - PowerShell
# Script principal para ejecutar Qwen Code CLI con aislamiento completo
# Lee configuración desde qwen/config/qwen-config.env y aísla completamente de tu bot OpenAI

param(
    [string]$Prompt = "",
    [switch]$Interactive = $false,
    [string]$Provider = "openrouter",  # openrouter, alibaba, huggingface
    [string]$Model = "",
    [int]$MaxTokens = 65536,
    [double]$Temperature = 0.7,
    [switch]$Debug = $false,
    [switch]$Help = $false
)

# Función para mostrar ayuda
function Show-Help {
    Write-Host "🤖 Qwen Code CLI Launcher" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Uso:" -ForegroundColor Yellow
    Write-Host "  .\qwen\scripts\qwen-launcher.ps1 [opciones]" -ForegroundColor White
    Write-Host ""
    Write-Host "Opciones:" -ForegroundColor Yellow
    Write-Host "  -Prompt <texto>        Prompt específico para ejecutar" -ForegroundColor White
    Write-Host "  -Interactive           Modo interactivo" -ForegroundColor White
    Write-Host "  -Provider <proveedor>  Proveedor: openrouter, alibaba, huggingface" -ForegroundColor White
    Write-Host "  -Model <modelo>        Modelo específico" -ForegroundColor White
    Write-Host "  -MaxTokens <número>    Máximo de tokens (default: 65536)" -ForegroundColor White
    Write-Host "  -Temperature <valor>   Temperatura (default: 0.7)" -ForegroundColor White
    Write-Host "  -Debug                 Modo debug" -ForegroundColor White
    Write-Host "  -Help                  Mostrar esta ayuda" -ForegroundColor White
    Write-Host ""
    Write-Host "Ejemplos:" -ForegroundColor Yellow
    Write-Host "  .\qwen\scripts\qwen-launcher.ps1 -Interactive -Provider openrouter" -ForegroundColor Cyan
    Write-Host "  .\qwen\scripts\qwen-launcher.ps1 -Prompt 'Analiza este código' -Provider alibaba" -ForegroundColor Cyan
    Write-Host "  .\qwen\scripts\qwen-launcher.ps1 -Prompt 'Genera tests' -Debug" -ForegroundColor Cyan
}

# Función para cargar configuración desde archivo
function Load-QwenConfig {
    $configFile = "qwen/config/qwen-config.env"
    if (Test-Path $configFile) {
        Get-Content $configFile | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                Set-Variable -Name $name -Value $value -Scope Global
            }
        }
        if ($Debug) {
            Write-Host "✅ Configuración cargada desde $configFile" -ForegroundColor Green
        }
    } else {
        Write-Host "⚠️  Archivo $configFile no encontrado. Usando configuración por defecto." -ForegroundColor Yellow
    }
}

# Función para configurar según el proveedor
function Set-QwenProvider {
    param([string]$Provider, [string]$Model)
    
    switch ($Provider.ToLower()) {
        "openrouter" {
            $env:OPENAI_API_KEY = $QWEN_API_KEY
            $env:OPENAI_BASE_URL = "https://openrouter.ai/api/v1"
            $env:OPENAI_MODEL = if ($Model) { $Model } else { "qwen/qwen3-coder-plus" }
            Write-Host "🔧 Configurado: OpenRouter" -ForegroundColor Green
        }
        "alibaba" {
            $env:OPENAI_API_KEY = $QWEN_API_KEY
            $env:OPENAI_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
            $env:OPENAI_MODEL = if ($Model) { $Model } else { "qwen3-coder-plus" }
            Write-Host "🔧 Configurado: Alibaba Cloud" -ForegroundColor Green
        }
        "huggingface" {
            $env:OPENAI_API_KEY = $QWEN_API_KEY
            $env:OPENAI_BASE_URL = "https://api-inference.huggingface.co/models/Qwen/Qwen3-Coder-Plus"
            $env:OPENAI_MODEL = if ($Model) { $Model } else { "Qwen/Qwen3-Coder-Plus" }
            Write-Host "🔧 Configurado: HuggingFace" -ForegroundColor Green
        }
        default {
            Write-Host "❌ Proveedor no válido: $Provider" -ForegroundColor Red
            Write-Host "Proveedores válidos: openrouter, alibaba, huggingface" -ForegroundColor Yellow
            exit 1
        }
    }
}

# Función para verificar instalación
function Test-QwenInstallation {
    try {
        $version = qwen --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Qwen CLI instalado: $version" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Qwen CLI no está instalado" -ForegroundColor Red
            Write-Host "Instala con: npm install -g @qwen-code/qwen-code" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "❌ Error verificando instalación de Qwen CLI" -ForegroundColor Red
        return $false
    }
}

# Función para crear directorios necesarios
function Initialize-QwenDirectories {
    $directories = @(
        "qwen/logs",
        "qwen/cache", 
        "qwen/workspace",
        "qwen/examples"
    )
    
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            if ($Debug) {
                Write-Host "📁 Creado directorio: $dir" -ForegroundColor Cyan
            }
        }
    }
}

# Función para log
function Write-QwenLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    if ($Debug) {
        Write-Host $logEntry -ForegroundColor Gray
    }
    
    # Guardar en archivo de log
    $logFile = "qwen/logs/qwen-cli.log"
    Add-Content -Path $logFile -Value $logEntry
}

# Función principal
function Start-QwenCode {
    param([string]$Prompt, [switch]$Interactive, [string]$Provider, [string]$Model, [int]$MaxTokens, [double]$Temperature)
    
    # Verificar instalación
    if (-not (Test-QwenInstallation)) {
        exit 1
    }
    
    # Inicializar directorios
    Initialize-QwenDirectories
    
    # Cargar configuración
    Load-QwenConfig
    
    # Guardar variables actuales
    $CURRENT_OPENAI_API_KEY = $env:OPENAI_API_KEY
    $CURRENT_OPENAI_BASE_URL = $env:OPENAI_BASE_URL
    $CURRENT_OPENAI_MODEL = $env:OPENAI_MODEL
    
    try {
        # Configurar proveedor
        Set-QwenProvider $Provider $Model
        
        # Configurar parámetros adicionales
        $env:QWEN_MAX_TOKENS = $MaxTokens
        $env:QWEN_TEMPERATURE = $Temperature
        
        if ($Debug) {
            Write-Host "📋 API Key: $($env:OPENAI_API_KEY.Substring(0,10))..." -ForegroundColor Yellow
            Write-Host "🌐 Base URL: $($env:OPENAI_BASE_URL)" -ForegroundColor Yellow
            Write-Host "🤖 Modelo: $($env:OPENAI_MODEL)" -ForegroundColor Yellow
            Write-Host "🔢 Max Tokens: $MaxTokens" -ForegroundColor Yellow
            Write-Host "🌡️ Temperature: $Temperature" -ForegroundColor Yellow
            Write-Host ""
        }
        
        Write-QwenLog "Iniciando Qwen Code CLI con proveedor: $Provider"
        
        if ($Interactive) {
            Write-Host "🚀 Iniciando Qwen Code en modo interactivo..." -ForegroundColor Green
            Write-Host "💡 Presiona Ctrl+C para salir" -ForegroundColor Cyan
            Write-Host ""
            qwen
        } elseif ($Prompt) {
            Write-Host "💬 Ejecutando prompt: $Prompt" -ForegroundColor Green
            Write-Host ""
            qwen --prompt $Prompt -c
        } else {
            Write-Host "❌ Error: Debes especificar -Prompt 'tu mensaje' o -Interactive" -ForegroundColor Red
            Show-Help
        }
    }
    catch {
        Write-Host "❌ Error ejecutando Qwen Code: $($_.Exception.Message)" -ForegroundColor Red
        Write-QwenLog "Error: $($_.Exception.Message)" "ERROR"
    }
    finally {
        # Restaurar variables originales
        if ($CURRENT_OPENAI_API_KEY) {
            $env:OPENAI_API_KEY = $CURRENT_OPENAI_API_KEY
        } else {
            Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
        }
        
        if ($CURRENT_OPENAI_BASE_URL) {
            $env:OPENAI_BASE_URL = $CURRENT_OPENAI_BASE_URL
        } else {
            Remove-Item Env:OPENAI_BASE_URL -ErrorAction SilentlyContinue
        }
        
        if ($CURRENT_OPENAI_MODEL) {
            $env:OPENAI_MODEL = $CURRENT_OPENAI_MODEL
        } else {
            Remove-Item Env:OPENAI_MODEL -ErrorAction SilentlyContinue
        }
        
        Write-QwenLog "Variables de OpenAI restauradas"
        if ($Debug) {
            Write-Host "✅ Variables de OpenAI restauradas" -ForegroundColor Green
        }
    }
}

# Script principal
if ($Help) {
    Show-Help
    exit 0
}

# Ejecutar Qwen Code
Start-QwenCode -Prompt $Prompt -Interactive $Interactive -Provider $Provider -Model $Model -MaxTokens $MaxTokens -Temperature $Temperature 