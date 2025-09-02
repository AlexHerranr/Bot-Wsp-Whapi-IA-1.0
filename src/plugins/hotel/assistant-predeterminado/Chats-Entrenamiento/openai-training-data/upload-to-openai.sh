#!/bin/bash
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
openai api fine_tuning.jobs.create \
    -m gpt-4o-mini \
    --training_file $TRAIN_FILE_ID \
    --validation_file $VALID_FILE_ID \
    --hyperparameters n_epochs=4

echo "✅ Fine-tuning job creado. Revisa el progreso en OpenAI Dashboard."
