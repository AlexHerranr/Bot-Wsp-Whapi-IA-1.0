/**
 * Integración de Qwen Code CLI con Bot de WhatsApp
 * 
 * Este archivo demuestra cómo integrar Qwen3-Coder con tu bot existente
 * para proporcionar capacidades de análisis y generación de código.
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * Clase para manejar la integración con Qwen Code CLI
 */
class QwenCodeIntegration {
    constructor(config = {}) {
        this.config = {
            scriptPath: path.join(__dirname, '../scripts/qwen-launcher.ps1'),
            defaultProvider: 'openrouter',
            timeout: 300000, // 5 minutos
            maxTokens: 65536,
            temperature: 0.7,
            ...config
        };
        
        this.isAvailable = false;
        this.checkAvailability();
    }
    
    /**
     * Verifica si Qwen CLI está disponible
     */
    async checkAvailability() {
        try {
            const result = await this.runCommand('--version');
            this.isAvailable = result.success;
            console.log(`🤖 Qwen CLI disponible: ${result.success}`);
        } catch (error) {
            console.log('❌ Qwen CLI no disponible:', error.message);
            this.isAvailable = false;
        }
    }
    
    /**
     * Ejecuta un comando de Qwen CLI
     * @param {string} prompt - Prompt a ejecutar
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Object>} - Resultado de la ejecución
     */
    async runQwenCode(prompt, options = {}) {
        if (!this.isAvailable) {
            throw new Error('Qwen CLI no está disponible');
        }
        
        const {
            provider = this.config.defaultProvider,
            model = '',
            maxTokens = this.config.maxTokens,
            temperature = this.config.temperature,
            debug = false
        } = options;
        
        const args = [
            '-ExecutionPolicy', 'Bypass',
            '-File', this.config.scriptPath,
            '-Prompt', prompt,
            '-Provider', provider,
            '-MaxTokens', maxTokens.toString(),
            '-Temperature', temperature.toString()
        ];
        
        if (model) {
            args.push('-Model', model);
        }
        
        if (debug) {
            args.push('-Debug');
        }
        
        return this.runCommand(args);
    }
    
    /**
     * Ejecuta un comando de PowerShell
     * @param {string|Array} args - Argumentos del comando
     * @returns {Promise<Object>} - Resultado de la ejecución
     */
    runCommand(args) {
        return new Promise((resolve, reject) => {
            const process = spawn('powershell', args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: this.config.timeout
            });
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        output: stdout.trim(),
                        error: stderr.trim(),
                        code
                    });
                } else {
                    resolve({
                        success: false,
                        output: stdout.trim(),
                        error: stderr.trim(),
                        code
                    });
                }
            });
            
            process.on('error', (error) => {
                reject(error);
            });
            
            process.on('timeout', () => {
                process.kill();
                reject(new Error('Comando Qwen CLI expiró'));
            });
        });
    }
    
    /**
     * Analiza código usando Qwen3-Coder
     * @param {string} code - Código a analizar
     * @param {string} language - Lenguaje del código
     * @returns {Promise<string>} - Análisis del código
     */
    async analyzeCode(code, language = 'javascript') {
        const prompt = `Analiza este código ${language} y proporciona:
1. Explicación de lo que hace
2. Posibles mejoras
3. Problemas de seguridad o rendimiento
4. Sugerencias de optimización

Código:
\`\`\`${language}
${code}
\`\`\``;
        
        const result = await this.runQwenCode(prompt);
        return result.success ? result.output : `Error: ${result.error}`;
    }
    
    /**
     * Genera tests unitarios para una función
     * @param {string} functionCode - Código de la función
     * @param {string} language - Lenguaje del código
     * @returns {Promise<string>} - Tests generados
     */
    async generateTests(functionCode, language = 'javascript') {
        const prompt = `Genera tests unitarios completos para esta función ${language}.
Incluye casos de prueba para:
- Casos normales
- Casos edge
- Casos de error
- Validación de entrada

Función:
\`\`\`${language}
${functionCode}
\`\`\``;
        
        const result = await this.runQwenCode(prompt);
        return result.success ? result.output : `Error: ${result.error}`;
    }
    
    /**
     * Refactoriza código para mejorar legibilidad
     * @param {string} code - Código a refactorizar
     * @param {string} language - Lenguaje del código
     * @returns {Promise<string>} - Código refactorizado
     */
    async refactorCode(code, language = 'javascript') {
        const prompt = `Refactoriza este código ${language} para mejorar:
1. Legibilidad
2. Mantenibilidad
3. Rendimiento
4. Estructura

Código original:
\`\`\`${language}
${code}
\`\`\`

Proporciona el código refactorizado con explicaciones de los cambios.`;
        
        const result = await this.runQwenCode(prompt);
        return result.success ? result.output : `Error: ${result.error}`;
    }
    
    /**
     * Debuggea código y encuentra errores
     * @param {string} code - Código a debuggear
     * @param {string} language - Lenguaje del código
     * @returns {Promise<string>} - Análisis de debugging
     */
    async debugCode(code, language = 'javascript') {
        const prompt = `Encuentra y corrige los errores en este código ${language}.
Proporciona:
1. Lista de errores encontrados
2. Explicación de cada error
3. Código corregido
4. Sugerencias para evitar errores similares

Código:
\`\`\`${language}
${code}
\`\`\``;
        
        const result = await this.runQwenCode(prompt);
        return result.success ? result.output : `Error: ${result.error}`;
    }
    
    /**
     * Genera documentación para una función
     * @param {string} functionCode - Código de la función
     * @param {string} language - Lenguaje del código
     * @returns {Promise<string>} - Documentación generada
     */
    async generateDocumentation(functionCode, language = 'javascript') {
        const prompt = `Genera documentación completa para esta función ${language}.
Incluye:
1. Descripción de la función
2. Parámetros con tipos
3. Valor de retorno
4. Ejemplos de uso
5. Casos edge
6. Notas importantes

Función:
\`\`\`${language}
${functionCode}
\`\`\``;
        
        const result = await this.runQwenCode(prompt);
        return result.success ? result.output : `Error: ${result.error}`;
    }
}

/**
 * Middleware para integrar Qwen Code con el bot de WhatsApp
 */
function createQwenMiddleware(config = {}) {
    const qwenIntegration = new QwenCodeIntegration(config);
    
    return async (req, res, next) => {
        // Agregar Qwen a req para uso en handlers
        req.qwen = qwenIntegration;
        
        // Middleware para detectar comandos de código
        if (req.body && req.body.message) {
            const message = req.body.message.toLowerCase();
            
            // Comandos de Qwen Code
            if (message.includes('/qwen') || message.includes('/code')) {
                try {
                    const codeMatch = message.match(/```(\w+)?\n([\s\S]*?)```/);
                    if (codeMatch) {
                        const language = codeMatch[1] || 'javascript';
                        const code = codeMatch[2];
                        
                        let response = '';
                        
                        if (message.includes('analizar') || message.includes('analyze')) {
                            response = await qwenIntegration.analyzeCode(code, language);
                        } else if (message.includes('test') || message.includes('tests')) {
                            response = await qwenIntegration.generateTests(code, language);
                        } else if (message.includes('refactor') || message.includes('refactorizar')) {
                            response = await qwenIntegration.refactorCode(code, language);
                        } else if (message.includes('debug') || message.includes('error')) {
                            response = await qwenIntegration.debugCode(code, language);
                        } else if (message.includes('doc') || message.includes('documentar')) {
                            response = await qwenIntegration.generateDocumentation(code, language);
                        } else {
                            // Análisis por defecto
                            response = await qwenIntegration.analyzeCode(code, language);
                        }
                        
                        // Enviar respuesta
                        res.json({
                            success: true,
                            response: response,
                            source: 'qwen-code'
                        });
                        return;
                    }
                } catch (error) {
                    console.error('Error en Qwen Code middleware:', error);
                }
            }
        }
        
        next();
    };
}

/**
 * Handler específico para comandos de Qwen Code
 */
async function handleQwenCodeCommand(message, qwenIntegration) {
    const commands = {
        '/qwen-analyze': 'analizar',
        '/qwen-test': 'generar tests',
        '/qwen-refactor': 'refactorizar',
        '/qwen-debug': 'debuggear',
        '/qwen-doc': 'generar documentación'
    };
    
    for (const [command, action] of Object.entries(commands)) {
        if (message.toLowerCase().includes(command)) {
            const codeMatch = message.match(/```(\w+)?\n([\s\S]*?)```/);
            if (codeMatch) {
                const language = codeMatch[1] || 'javascript';
                const code = codeMatch[2];
                
                let response = '';
                switch (action) {
                    case 'analizar':
                        response = await qwenIntegration.analyzeCode(code, language);
                        break;
                    case 'generar tests':
                        response = await qwenIntegration.generateTests(code, language);
                        break;
                    case 'refactorizar':
                        response = await qwenIntegration.refactorCode(code, language);
                        break;
                    case 'debuggear':
                        response = await qwenIntegration.debugCode(code, language);
                        break;
                    case 'generar documentación':
                        response = await qwenIntegration.generateDocumentation(code, language);
                        break;
                }
                
                return {
                    success: true,
                    response: response,
                    action: action,
                    language: language
                };
            }
        }
    }
    
    return { success: false, error: 'Comando no reconocido' };
}

module.exports = {
    QwenCodeIntegration,
    createQwenMiddleware,
    handleQwenCodeCommand
}; 