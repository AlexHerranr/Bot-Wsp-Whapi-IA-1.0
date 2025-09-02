#!/usr/bin/env node
/**
 * Conversor de dataset Pa'Cartagena a formato OpenAI JSONL
 * Basado en las mejores prácticas de fine-tuning de OpenAI
 */

const fs = require('fs');
const path = require('path');

// Configuración
const INPUT_FILE = './preguntasyreptuestastipicas_completo.json';
const OUTPUT_DIR = './openai-training-data';
const MAX_TOKENS = 65536; // Límite para gpt-4o-mini

// Crear directorio de salida
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Función para estimar tokens (aproximación)
 */
function estimateTokens(text) {
    // Aproximación: ~4 caracteres = 1 token en español
    return Math.ceil(text.length / 4);
}

/**
 * Convertir ejemplo a formato OpenAI Chat Completion
 */
function convertToOpenAIFormat(ejemplo, categoria) {
    const userMessage = ejemplo.pregunta_estandarizada;
    const assistantMessage = ejemplo.respuesta_ideal;
    
    // Calcular tokens
    const totalTokens = estimateTokens(userMessage + assistantMessage);
    
    // Validar límite de tokens
    if (totalTokens > MAX_TOKENS) {
        console.warn(`Ejemplo excede límite de tokens: ${totalTokens} > ${MAX_TOKENS}`);
        return null;
    }
    
    return {
        messages: [
            {
                role: "user",
                content: userMessage
            },
            {
                role: "assistant", 
                content: assistantMessage
            }
        ],
        // Metadatos para tracking (no se usan en entrenamiento)
        metadata: {
            categoria: categoria,
            tipo: ejemplo.tipo,
            confidence: ejemplo.confidence,
            year: ejemplo.year,
            tokens_estimated: totalTokens,
            apartment: ejemplo.apartment || null,
            amount_cop: ejemplo.amount_cop || null
        }
    };
}

/**
 * Función principal de conversión
 */
async function convertDataset() {
    try {
        console.log('🚀 Iniciando conversión de dataset Pa\'Cartagena a formato OpenAI...');
        
        // Leer archivo JSON
        const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
        const dataset = JSON.parse(rawData);
        
        console.log(`📊 Dataset cargado: ${dataset.metadata.total_messages_analyzed} mensajes analizados`);
        console.log(`📋 Categorías: ${Object.keys(dataset.categorias).length}`);
        
        let allExamples = [];
        let statsPerCategory = {};
        
        // Procesar cada categoría
        for (const [categoryName, categoryData] of Object.entries(dataset.categorias)) {
            console.log(`\n🔄 Procesando categoría: ${categoryName}`);
            
            let validExamples = 0;
            let invalidExamples = 0;
            
            for (const ejemplo of categoryData.ejemplos) {
                const openAIFormat = convertToOpenAIFormat(ejemplo, categoryName);
                
                if (openAIFormat) {
                    allExamples.push(openAIFormat);
                    validExamples++;
                } else {
                    invalidExamples++;
                }
            }
            
            statsPerCategory[categoryName] = {
                valid: validExamples,
                invalid: invalidExamples,
                total: categoryData.ejemplos.length
            };
            
            console.log(`  ✅ Válidos: ${validExamples}`);
            console.log(`  ❌ Inválidos: ${invalidExamples}`);
        }
        
        console.log(`\n📈 Total ejemplos convertidos: ${allExamples.length}`);
        
        // Mezclar ejemplos aleatoriamente
        const shuffled = allExamples.sort(() => Math.random() - 0.5);
        
        // Dividir dataset según recomendaciones OpenAI
        const trainSize = Math.floor(shuffled.length * 0.80);
        const validSize = Math.floor(shuffled.length * 0.15);
        
        const trainData = shuffled.slice(0, trainSize);
        const validData = shuffled.slice(trainSize, trainSize + validSize);
        const testData = shuffled.slice(trainSize + validSize);
        
        // Guardar archivos JSONL
        const files = [
            { data: trainData, name: 'train.jsonl', desc: 'Entrenamiento' },
            { data: validData, name: 'validation.jsonl', desc: 'Validación' },
            { data: testData, name: 'test.jsonl', desc: 'Pruebas' }
        ];
        
        for (const file of files) {
            const filepath = path.join(OUTPUT_DIR, file.name);
            const jsonlContent = file.data
                .map(example => JSON.stringify({
                    messages: example.messages
                    // Solo messages para entrenamiento, metadatos se omiten
                }))
                .join('\\n');
            
            fs.writeFileSync(filepath, jsonlContent);
            console.log(`💾 ${file.desc}: ${file.data.length} ejemplos → ${file.name}`);
        }
        
        // Guardar estadísticas y metadatos
        const stats = {
            generated_at: new Date().toISOString(),
            source_metadata: dataset.metadata,
            conversion_stats: {
                total_examples_processed: allExamples.length,
                train_examples: trainData.length,
                validation_examples: validData.length,
                test_examples: testData.length,
                categories_stats: statsPerCategory
            },
            openai_format_validation: {
                max_tokens_limit: MAX_TOKENS,
                format_version: "chat_completions",
                compatible_models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]
            },
            recommended_hyperparameters: {
                n_epochs: trainData.length < 100 ? 4 : trainData.length < 1000 ? 2 : 1,
                batch_size: "auto",
                learning_rate_multiplier: 1.0
            }
        };
        
        fs.writeFileSync(
            path.join(OUTPUT_DIR, 'conversion_stats.json'),
            JSON.stringify(stats, null, 2)
        );
        
        // Crear archivo de comandos para upload a OpenAI
        const uploadScript = `#!/bin/bash
# Script para upload de archivos de entrenamiento a OpenAI
# Requiere: pip install openai

echo "🚀 Subiendo archivos de entrenamiento a OpenAI..."

# Upload training file
echo "📤 Subiendo train.jsonl..."
TRAIN_FILE_ID=$(openai api files.create -f train.jsonl -p fine-tune | jq -r '.id')
echo "✅ Training file uploaded: $TRAIN_FILE_ID"

# Upload validation file (opcional)
echo "📤 Subiendo validation.jsonl..."
VALID_FILE_ID=$(openai api files.create -f validation.jsonl -p fine-tune | jq -r '.id')
echo "✅ Validation file uploaded: $VALID_FILE_ID"

# Create fine-tuning job
echo "🎯 Creando job de fine-tuning..."
openai api fine_tuning.jobs.create \\
    -m gpt-4o-mini \\
    --training_file $TRAIN_FILE_ID \\
    --validation_file $VALID_FILE_ID \\
    --hyperparameters n_epochs=${stats.recommended_hyperparameters.n_epochs}

echo "✅ Fine-tuning job creado. Revisa el progreso en OpenAI Dashboard."
`;
        
        fs.writeFileSync(path.join(OUTPUT_DIR, 'upload-to-openai.sh'), uploadScript);
        fs.chmodSync(path.join(OUTPUT_DIR, 'upload-to-openai.sh'), 0o755);
        
        console.log(`\n🎉 ¡Conversión completada exitosamente!`);
        console.log(`📂 Archivos generados en: ${OUTPUT_DIR}`);
        console.log(`\n📋 Resumen:`);
        console.log(`   • Entrenamiento: ${trainData.length} ejemplos`);
        console.log(`   • Validación: ${validData.length} ejemplos`);
        console.log(`   • Pruebas: ${testData.length} ejemplos`);
        console.log(`\n🚀 Para continuar:`);
        console.log(`   1. cd ${OUTPUT_DIR}`);
        console.log(`   2. ./upload-to-openai.sh`);
        console.log(`\n💡 Hiperparámetros recomendados:`);
        console.log(`   • Epochs: ${stats.recommended_hyperparameters.n_epochs}`);
        console.log(`   • Learning rate: ${stats.recommended_hyperparameters.learning_rate_multiplier}`);
        
    } catch (error) {
        console.error('❌ Error durante la conversión:', error.message);
        process.exit(1);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    convertDataset();
}

module.exports = { convertDataset, convertToOpenAIFormat };