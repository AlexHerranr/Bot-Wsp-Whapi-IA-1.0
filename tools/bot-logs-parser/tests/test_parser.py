#!/usr/bin/env python3
"""
Test script para verificar el parser de logs
"""

import json
import re
from datetime import datetime

# Simulamos algunos logs de ejemplo para probar el parser
test_logs = [
    # Log de mensaje de usuario (formato Cloud Run)
    {
        'message': '{"httpRequest":{"latency":"0.003s","protocol":"HTTP/1.1","requestMethod":"POST","status":200},"textPayload":"7/10 [14:10] 📱 573003913251: \\"Me gustaría consultar disponibilidad\\"","severity":"INFO","timestamp":"2025-07-10T19:10:20.000Z"}',
        'expected_type': 'message_received',
        'expected_content': 'Me gustaría consultar disponibilidad'
    },
    
    # Log de procesamiento de mensajes
    {
        'message': '{"textPayload":"7/10 [14:10] [BOT] → 2 msgs → OpenAI","severity":"INFO","timestamp":"2025-07-10T19:10:36.000Z"}',
        'expected_type': 'message_process',
        'expected_content': 'Procesando mensajes agrupados'
    },
    
    # Log de función de Beds24
    {
        'message': '{"textPayload":"[INFO] FUNCTION_CALLING_START: OpenAI requiere ejecutar función: check_availability con args: {\\"startDate\\":\\"2025-07-15\\",\\"endDate\\":\\"2025-07-20\\"}","severity":"INFO","timestamp":"2025-07-10T19:10:38.000Z"}',
        'expected_type': 'function_calling',
        'expected_function': 'check_availability'
    },
    
    # Log de respuesta de Beds24
    {
        'message': '{"textPayload":"[INFO] BEDS24_RESPONSE_DETAIL: Respuesta completa enviada a OpenAI: {\\"fullResponse\\":\\"📅 **15/07/2025 - 20/07/2025 (5 noches)**\\\\n\\\\n🥇 **Apartamentos Disponibles**\\\\n✅ **Aparta-Estudio 2005-B** - $850.000\\"}","severity":"INFO","timestamp":"2025-07-10T19:10:39.000Z"}',
        'expected_type': 'beds24_response',
        'expected_data': True
    }
]

def test_log_extraction():
    """Prueba la extracción de contenido útil de logs contaminados"""
    print("🧪 PROBANDO EXTRACCIÓN DE LOGS CONTAMINADOS")
    print("=" * 50)
    
    for i, test_log in enumerate(test_logs, 1):
        print(f"\n📋 TEST {i}: {test_log['expected_type'].upper()}")
        print(f"Log original: {test_log['message'][:100]}...")
        
        # Extraer textPayload
        text_match = re.search(r'"textPayload":\s*"([^"]+)"', test_log['message'])
        if text_match:
            extracted = text_match.group(1).replace('\\n', '\n').replace('\\"', '"')
            print(f"✅ Contenido extraído: {extracted}")
            
            # Verificar si contiene información esperada
            if test_log['expected_type'] == 'message_received':
                if test_log['expected_content'] in extracted:
                    print("✅ Mensaje de usuario detectado correctamente")
                else:
                    print("❌ Mensaje de usuario NO detectado")
            
            elif test_log['expected_type'] == 'function_calling':
                if test_log['expected_function'] in extracted:
                    print("✅ Función detectada correctamente")
                else:
                    print("❌ Función NO detectada")
            
            elif test_log['expected_type'] == 'beds24_response':
                if 'fullResponse' in extracted:
                    print("✅ Respuesta de Beds24 detectada correctamente")
                else:
                    print("❌ Respuesta de Beds24 NO detectada")
        else:
            print("❌ No se pudo extraer textPayload")

def test_format_output():
    """Prueba el formato de salida esperado"""
    print("\n\n🎨 PROBANDO FORMATO DE SALIDA")
    print("=" * 50)
    
    # Formato esperado vs actual
    expected_format = """
[2025-07-10T19:10:20.000Z] [INFO] MESSAGE_RECEIVED [webhook]: Usuario 573003913251: "Me gustaría consultar disponibilidad" | {"from":"573003913251","type":"text","body":"Me gustaría consultar disponibilidad","timestamp":1752156620}
[2025-07-10T19:10:36.000Z] [INFO] MESSAGE_PROCESS [app-unified.ts]: Procesando mensajes agrupados | {"userId":"573003913251","messageCount":2}
[2025-07-10T19:10:38.000Z] [INFO] FUNCTION_CALLING_START [app-unified.ts]: OpenAI requiere ejecutar función: check_availability | {"functions":[{"name":"check_availability","args":{"startDate":"2025-07-15","endDate":"2025-07-20"}}]}
[2025-07-10T19:10:39.000Z] [INFO] BEDS24_RESPONSE_DETAIL [beds24-availability.ts]: Respuesta completa de Beds24 enviada a OpenAI | {"fullResponse":"📅 **15/07/2025 - 20/07/2025 (5 noches)**\\n\\n🥇 **Apartamentos Disponibles**\\n✅ **Aparta-Estudio 2005-B** - $850.000","responseLength":150}
"""
    
    print("📝 FORMATO ESPERADO:")
    print(expected_format.strip())
    
    print("\n✅ El parser debería generar logs en este formato exacto")

if __name__ == "__main__":
    test_log_extraction()
    test_format_output()
    
    print("\n\n🎯 RESUMEN DE OBJETIVOS")
    print("=" * 50)
    print("✅ ETAPA 1: Filtrar metadata HTTP - COMPLETADO")
    print("✅ ETAPA 2: Formato logs locales - EN PROGRESO")
    print("⏳ ETAPA 3: Parser inteligente - PARCIAL")
    print("⏳ ETAPA 4: Resultado final - PARCIAL")
    print("❌ ETAPA 5: Configuración - PENDIENTE")
    
    print("\n🔧 PRÓXIMOS PASOS:")
    print("1. Mejorar extracción de contenido útil")
    print("2. Detectar más tipos de logs técnicos")
    print("3. Mostrar datos completos de Beds24")
    print("4. Agregar configuración de filtros") 