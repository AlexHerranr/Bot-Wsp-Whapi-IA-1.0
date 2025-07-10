#!/usr/bin/env python3
"""
Script simple para analizar logs crudos de Cloud Run
y encontrar información técnica oculta
"""

import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone

def analyze_raw_logs():
    """Analiza logs crudos para encontrar patrones técnicos"""
    
    print("=== ANALIZANDO LOGS CRUDOS DE CLOUD RUN ===")
    
    # Configuración
    service_name = "bot-wsp-whapi-ia"
    project_id = "bot-wsp-whapi-ia"
    hours = 2
    limit = 100
    
    # Obtener logs crudos
    start_time = datetime.now(timezone.utc) - timedelta(hours=hours)
    timestamp_filter = start_time.strftime('%Y-%m-%dT%H:%M:%SZ')
    
    gcloud_cmd = r'C:\Users\alex-\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
    
    cmd = [
        gcloud_cmd, 'logging', 'read',
        f'resource.type=cloud_run_revision AND resource.labels.service_name={service_name} AND timestamp>="{timestamp_filter}"',
        '--format=json',
        f'--project={project_id}',
        f'--limit={limit}',
        '--order=asc'
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        raw_logs = json.loads(result.stdout)
        print(f"✅ Obtenidos {len(raw_logs)} logs crudos")
        
        # Patrones técnicos que buscamos
        technical_patterns = [
            'FUNCTION_CALLING_START',
            'FUNCTION_EXECUTING', 
            'FUNCTION_HANDLER',
            'BEDS24_REQUEST',
            'BEDS24_RESPONSE_DETAIL',
            'OPENAI_REQUEST',
            'OPENAI_RUN_COMPLETED',
            'adding_message',
            'creating_run',
            'run_started',
            'thread_',
            'run_',
            'check_availability',
            'fullResponse',
            'args',
            'arguments'
        ]
        
        found_patterns = {}
        
        for i, log in enumerate(raw_logs):
            log_str = json.dumps(log, ensure_ascii=False)
            
            for pattern in technical_patterns:
                if pattern.lower() in log_str.lower():
                    if pattern not in found_patterns:
                        found_patterns[pattern] = []
                    
                    found_patterns[pattern].append({
                        'index': i,
                        'timestamp': log.get('timestamp', 'unknown'),
                        'severity': log.get('severity', 'unknown'),
                        'sample': log_str[:500] + '...' if len(log_str) > 500 else log_str
                    })
        
        # Mostrar resultados
        print(f"\n=== PATRONES TÉCNICOS ENCONTRADOS ===")
        for pattern, occurrences in found_patterns.items():
            print(f"\n🔍 {pattern}: {len(occurrences)} ocurrencias")
            for i, occurrence in enumerate(occurrences[:2]):  # Mostrar solo 2 ejemplos
                print(f"  Ejemplo {i+1}: {occurrence['timestamp']}")
                print(f"  Sample: {occurrence['sample']}")
        
        print(f"\n=== ESTADÍSTICAS ===")
        print(f"Total logs analizados: {len(raw_logs)}")
        print(f"Patrones únicos encontrados: {len(found_patterns)}")
        
        # Guardar un ejemplo completo para análisis
        if raw_logs:
            with open('sample_raw_log.json', 'w', encoding='utf-8') as f:
                json.dump(raw_logs[0], f, indent=2, ensure_ascii=False)
            print(f"📄 Ejemplo completo guardado en: sample_raw_log.json")
        
        return found_patterns
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Error ejecutando gcloud: {e}")
        return {}
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing JSON: {e}")
        return {}

if __name__ == "__main__":
    analyze_raw_logs() 