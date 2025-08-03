# Qwen Code Test Script - PowerShell
# Script para verificar la instalación y configuración de Qwen Code CLI

param(
    [switch]$Verbose = $false,
    [switch]$All = $false
)

# Colores para output
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Cyan = "Cyan"
$Gray = "Gray"

# Función para escribir con color
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

# Función para verificar Node.js
function Test-NodeJS {
    Write-ColorOutput "🔍 Verificando Node.js..." $Cyan
    
    try {
        $nodeVersion = node --version 2>$null
        $npmVersion = npm --version 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Node.js: $nodeVersion" $Green
            Write-ColorOutput "✅ npm: $npmVersion" $Green
            
            # Verificar versión mínima (20.19.4)
            $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\.\d+\.\d+', '$1')
            $nodeMinor = [int]($nodeVersion -replace 'v\d+\.(\d+)\.\d+', '$1')
            $nodePatch = [int]($nodeVersion -replace 'v\d+\.\d+\.(\d+)', '$1')
            
            if ($nodeMajor -gt 20 -or ($nodeMajor -eq 20 -and $nodeMinor -gt 19) -or ($nodeMajor -eq 20 -and $nodeMinor -eq 19 -and $nodePatch -ge 4)) {
                Write-ColorOutput "✅ Versión de Node.js compatible" $Green
                return $true
            } else {
                Write-ColorOutput "❌ Node.js debe ser >= 20.19.4" $Red
                return $false
            }
        } else {
            Write-ColorOutput "❌ Node.js no está instalado" $Red
            return $false
        }
    } catch {
        Write-ColorOutput "❌ Error verificando Node.js: $($_.Exception.Message)" $Red
        return $false
    }
}

# Función para verificar Qwen CLI
function Test-QwenCLI {
    Write-ColorOutput "🔍 Verificando Qwen CLI..." $Cyan
    
    try {
        $version = qwen --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Qwen CLI instalado: $version" $Green
            return $true
        } else {
            Write-ColorOutput "❌ Qwen CLI no está instalado" $Red
            Write-ColorOutput "💡 Instala con: npm install -g @qwen-code/qwen-code" $Yellow
            return $false
        }
    } catch {
        Write-ColorOutput "❌ Error verificando Qwen CLI: $($_.Exception.Message)" $Red
        return $false
    }
}

# Función para verificar archivos de configuración
function Test-ConfigurationFiles {
    Write-ColorOutput "🔍 Verificando archivos de configuración..." $Cyan
    
    $configFiles = @(
        "qwen/config/qwen-config.env",
        "qwen/config/settings.json"
    )
    
    $allExist = $true
    foreach ($file in $configFiles) {
        if (Test-Path $file) {
            Write-ColorOutput "✅ $file" $Green
        } else {
            Write-ColorOutput "❌ $file (no encontrado)" $Red
            $allExist = $false
        }
    }
    
    return $allExist
}

# Función para verificar variables de entorno
function Test-EnvironmentVariables {
    Write-ColorOutput "🔍 Verificando variables de entorno..." $Cyan
    
    $requiredVars = @("QWEN_API_KEY", "QWEN_BASE_URL", "QWEN_MODEL")
    $allSet = $true
    
    foreach ($var in $requiredVars) {
        $value = (Get-Variable -Name $var -ErrorAction SilentlyContinue).Value
        if ($value) {
            if ($var -eq "QWEN_API_KEY") {
                Write-ColorOutput "✅ $var: $($value.Substring(0,10))..." $Green
            } else {
                Write-ColorOutput "✅ $var: $value" $Green
            }
        } else {
            Write-ColorOutput "❌ $var (no configurada)" $Red
            $allSet = $false
        }
    }
    
    return $allSet
}

# Función para probar conexión con proveedores
function Test-ProviderConnection {
    param([string]$Provider)
    
    Write-ColorOutput "🔍 Probando conexión con $Provider..." $Cyan
    
    # Cargar configuración
    $configFile = "qwen/config/qwen-config.env"
    if (Test-Path $configFile) {
        Get-Content $configFile | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                Set-Variable -Name $name -Value $value -Scope Global
            }
        }
    }
    
    # Configurar según proveedor
    switch ($Provider.ToLower()) {
        "openrouter" {
            $baseUrl = "https://openrouter.ai/api/v1"
            $apiKey = $QWEN_API_KEY
        }
        "alibaba" {
            $baseUrl = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
            $apiKey = $QWEN_API_KEY
        }
        "huggingface" {
            $baseUrl = "https://api-inference.huggingface.co/models/Qwen/Qwen3-Coder-Plus"
            $apiKey = $QWEN_API_KEY
        }
    }
    
    if (-not $apiKey -or $apiKey -eq "tu_api_key_de_openrouter_aqui") {
        Write-ColorOutput "❌ API key no configurada para $Provider" $Red
        return $false
    }
    
    try {
        # Probar conexión básica
        $headers = @{
            "Authorization" = "Bearer $apiKey"
            "Content-Type" = "application/json"
        }
        
        $response = Invoke-RestMethod -Uri "$baseUrl/models" -Headers $headers -Method GET -TimeoutSec 10
        Write-ColorOutput "✅ Conexión exitosa con $Provider" $Green
        return $true
    } catch {
        Write-ColorOutput "❌ Error conectando con $Provider: $($_.Exception.Message)" $Red
        return $false
    }
}

# Función para probar comando básico
function Test-BasicCommand {
    Write-ColorOutput "🔍 Probando comando básico..." $Cyan
    
    try {
        $testPrompt = "console.log('Hello World');"
        $result = qwen --prompt $testPrompt -c 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Comando básico funcionando" $Green
            if ($Verbose) {
                Write-ColorOutput "📝 Respuesta: $result" $Gray
            }
            return $true
        } else {
            Write-ColorOutput "❌ Error en comando básico" $Red
            return $false
        }
    } catch {
        Write-ColorOutput "❌ Error probando comando: $($_.Exception.Message)" $Red
        return $false
    }
}

# Función para generar reporte
function Write-TestReport {
    param([hashtable]$Results)
    
    Write-ColorOutput "`n📊 REPORTE DE PRUEBAS" $Cyan
    Write-ColorOutput "================================" $Cyan
    
    $total = $Results.Count
    $passed = ($Results.Values | Where-Object { $_ -eq $true }).Count
    $failed = $total - $passed
    
    Write-ColorOutput "✅ Pruebas exitosas: $passed/$total" $Green
    if ($failed -gt 0) {
        Write-ColorOutput "❌ Pruebas fallidas: $failed/$total" $Red
    }
    
    Write-ColorOutput "`nDetalles:" $Cyan
    foreach ($test in $Results.Keys) {
        $status = if ($Results[$test]) { "✅" } else { "❌" }
        Write-ColorOutput "$status $test" $(if ($Results[$test]) { $Green } else { $Red })
    }
    
    if ($failed -eq 0) {
        Write-ColorOutput "`n🎉 ¡Todas las pruebas pasaron! Qwen Code CLI está listo para usar." $Green
    } else {
        Write-ColorOutput "`n⚠️  Algunas pruebas fallaron. Revisa la configuración." $Yellow
    }
}

# Función principal
function Start-QwenTests {
    $results = @{}
    
    Write-ColorOutput "🤖 INICIANDO PRUEBAS DE QWEN CODE CLI" $Cyan
    Write-ColorOutput "=====================================" $Cyan
    Write-ColorOutput ""
    
    # Pruebas básicas
    $results["Node.js"] = Test-NodeJS
    $results["Qwen CLI"] = Test-QwenCLI
    $results["Archivos de configuración"] = Test-ConfigurationFiles
    $results["Variables de entorno"] = Test-EnvironmentVariables
    
    if ($All -or $Verbose) {
        # Pruebas avanzadas
        $results["Comando básico"] = Test-BasicCommand
        
        # Probar proveedores si están configurados
        $providers = @("openrouter", "alibaba", "huggingface")
        foreach ($provider in $providers) {
            $results["Conexión $provider"] = Test-ProviderConnection $provider
        }
    }
    
    # Generar reporte
    Write-TestReport $results
    
    # Retornar código de salida
    $failedTests = ($results.Values | Where-Object { $_ -eq $false }).Count
    if ($failedTests -gt 0) {
        exit 1
    } else {
        exit 0
    }
}

# Ejecutar pruebas
Start-QwenTests 