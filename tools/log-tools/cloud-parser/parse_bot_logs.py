#!/usr/bin/env python3
"""
parse_bot_logs.py - Sistema de Análisis de Logs MEJORADO para Bot WhatsApp en Google Cloud Run

OBJETIVO PRINCIPAL:
==================
Resolver la limitación crítica de Google Cloud Logging que hace extremadamente tedioso
analizar logs detallados. En la interfaz web, cada log debe expandirse individualmente,
haciendo imposible ver el flujo completo de una conversación o detectar patrones de error.

PROBLEMA QUE RESUELVE:
=====================
1. Google Cloud Logging muestra logs "colapsados" - hay que hacer clic en cada uno
2. No hay forma fácil de copiar todos los logs con sus detalles completos
3. Es imposible ver el contexto de un error (qué pasó antes y después)
4. No se pueden identificar fácilmente las "sesiones" del bot
5. Dificulta enormemente el debugging de conversaciones con usuarios

SOLUCIÓN MEJORADA:
=================
Este script replica la experiencia de logs locales donde todo es visible de inmediato,
permitiendo:
- Ver logs completos sin clicks adicionales
- Copiar todo el detalle al portapapeles instantáneamente  
- Analizar sesiones completas del bot de principio a fin
- Identificar rápidamente errores y su contexto
- Debuggear conversaciones específicas con usuarios

NUEVAS MEJORAS TÉCNICAS:
========================
✅ FUNCTION CALLING COMPLETO:
- Detecta cuando se ejecuta check_availability, make_booking, etc.
- Extrae argumentos COMPLETOS (fechas, propiedades, etc)
- Muestra respuesta COMPLETA de Beds24, no solo preview

✅ ESTADOS DE OPENAI DETALLADOS:
- Captura: adding_message, creating_run, run_started, function_calling_start
- Incluye IDs de runs y threads
- Muestra duración de cada etapa

✅ INFORMACIÓN DE THREADS:
- Thread creado/reutilizado con su ID
- Estado del thread (activo, cancelado, etc)

✅ CONTEXTO DE ERRORES:
- No solo "Error" sino el mensaje completo
- Qué estaba haciendo cuando falló
- Usuario afectado y thread ID

✅ LOGS HTTP PARSEADOS:
- Los {'httpRequest':...} se parsean para extraer solo mensaje útil
- Elimina completamente metadata HTTP innecesaria

FILTRADO INTELIGENTE MEJORADO:
=============================
Nuevo: Filtra automáticamente metadata HTTP innecesaria para mostrar solo:
- Flujo de comunicación real: Usuario → OpenAI → Beds24 → Respuesta
- Datos crudos de APIs (Beds24, OpenAI) con argumentos COMPLETOS
- Estados de procesamiento importantes con IDs de threads/runs
- Errores y warnings con contexto COMPLETO
- Elimina: httpRequest, latency, IPs, traces, spans, etc.

USO ESPERADO:
============
Cuando el bot falle o actúe de forma inesperada:
1. Ejecutar: ./botlogs
2. Obtener instantáneamente logs formateados y organizados
3. Copiar/pegar para análisis o para compartir con el equipo
4. Identificar el error exacto sin perder tiempo navegando en Cloud Console

BENEFICIOS CLAVE:
================
- De 10-15 minutos navegando en Cloud Console → 10 segundos con este script
- Logs organizados por sesiones como en desarrollo local
- Contexto completo de errores para debugging efectivo
- Formato legible y fácil de compartir
- Análisis de patrones y métricas por sesión
- Filtrado inteligente de ruido HTTP
- MISMA información técnica que logs locales, sin basura HTTP
"""

import json
import subprocess
import argparse
import sys
import os
import re
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
import pyperclip
import time
import hashlib
try:
    from colorama import Fore, Style
except ImportError:
    # Fallback si colorama no está disponible
    class Fore:
        BLUE = ''
        GREEN = ''
        RED = ''
        YELLOW = ''
        CYAN = ''
        WHITE = ''
        LIGHTBLACK_EX = ''
    
    class Style:
        RESET_ALL = ''

# Configuración de colores ANSI
class Colors:
    GREEN = '\033[92m'    # Éxito/Inicio
    YELLOW = '\033[93m'   # Warnings
    RED = '\033[91m'      # Errores
    BLUE = '\033[94m'     # Mensajes de usuarios
    CYAN = '\033[96m'     # Información
    GRAY = '\033[90m'     # Logs informativos
    BOLD = '\033[1m'      # Texto en negrita
    UNDERLINE = '\033[4m' # Subrayado
    END = '\033[0m'       # Reset color

# ============================================================================
# PATRONES MEJORADOS PARA EXTRACCIÓN TÉCNICA COMPLETA
# ============================================================================

class EnhancedPatterns:
    """Patrones mejorados para capturar información técnica completa - ACTUALIZADO CON NUEVAS CATEGORÍAS"""
    
    # ✨ NUEVAS CATEGORÍAS DE LOGGING - Según README actualizado
    NEW_CATEGORY_PATTERNS = {
        # Mensajes y Comunicación
        'message_received': r'\[MESSAGE_RECEIVED\].*Mensaje recibido.*userId["\']:\s*["\']([^"\']+)["\']',
        'message_process': r'\[MESSAGE_PROCESS\].*Procesando mensajes agrupados.*messageCount["\']:\s*(\d+)',
        'whatsapp_send': r'\[WHATSAPP_SEND\].*Enviando.*userId["\']:\s*["\']([^"\']+)["\']',
        'whatsapp_chunks_complete': r'\[WHATSAPP_CHUNKS_COMPLETE\].*párrafos enviados.*totalChunks["\']:\s*(\d+)',
        
        # OpenAI y Funciones  
        'openai_request': r'\[OPENAI_REQUEST\].*userId["\']:\s*["\']([^"\']+)["\'].*state["\']:\s*["\']([^"\']+)["\']',
        'openai_response': r'\[OPENAI_RESPONSE\].*userId["\']:\s*["\']([^"\']+)["\'].*threadId["\']:\s*["\']([^"\']+)["\']',
        'function_calling_start': r'\[FUNCTION_CALLING_START\].*userId["\']:\s*["\']([^"\']+)["\'].*toolCallsCount["\']:\s*(\d+)',
        'function_executing': r'\[FUNCTION_EXECUTING\].*userId["\']:\s*["\']([^"\']+)["\'].*functionName["\']:\s*["\']([^"\']+)["\']',
        'function_handler': r'\[FUNCTION_HANDLER\].*función.*([a-zA-Z_][a-zA-Z0-9_]*)',
        
        # Integración Beds24
        'beds24_request': r'\[BEDS24_REQUEST\].*startDate["\']:\s*["\']([^"\']+)["\'].*endDate["\']:\s*["\']([^"\']+)["\']',
        'beds24_api_call': r'\[BEDS24_API_CALL\].*method["\']:\s*["\']([^"\']+)["\'].*endpoint["\']:\s*["\']([^"\']+)["\']',
        'beds24_response_detail': r'\[BEDS24_RESPONSE_DETAIL\].*status["\']:\s*(\d+).*dataCount["\']:\s*(\d+)',
        'beds24_processing': r'\[BEDS24_PROCESSING\].*processingStage["\']:\s*["\']([^"\']+)["\']',
        
        # Sistema y Threads
        'thread_created': r'\[THREAD_CREATED\].*userId["\']:\s*["\']([^"\']+)["\'].*threadId["\']:\s*["\']([^"\']+)["\']',
        'thread_persist': r'\[THREAD_PERSIST\].*threadsCount["\']:\s*(\d+).*source["\']:\s*["\']([^"\']+)["\']',
        'thread_cleanup': r'\[THREAD_CLEANUP\].*operation["\']:\s*["\']([^"\']+)["\'].*success["\']:\s*(true|false)',
        'server_start': r'\[SERVER_START\].*host["\']:\s*["\']([^"\']+)["\'].*port["\']:\s*(\d+)',
        'bot_ready': r'\[BOT_READY\].*environment["\']:\s*["\']([^"\']+)["\']',
    }
    
    # FUNCTION CALLING PATTERNS - Captura argumentos completos (ACTUALIZADO)
    FUNCTION_CALL_PATTERNS = {
        'function_start': r'FUNCTION_CALLING_START.*OpenAI requiere ejecutar.*función.*"([^"]+)"',
        'function_executing': r'Ejecutando función[:\s]*([a-zA-Z_][a-zA-Z0-9_]*)',
        'function_args': r'"args":\s*(\{[^}]*\}|\{[^}]*\{[^}]*\}[^}]*\})',  # Captura JSON anidado
        'function_complete': r'FUNCTION_CALLING_COMPLETE.*función\s*([a-zA-Z_][a-zA-Z0-9_]*)',
        'function_result': r'FUNCTION_RESULT.*"result":\s*"([^"]*)"',
        'function_output': r'OPENAI_FUNCTION_OUTPUT.*"([^"]*)"',
        # Patrones específicos del manual ACTUALIZADOS
        'function_handler': r'FUNCTION_HANDLER.*Ejecutando función:\s*([a-zA-Z_][a-zA-Z0-9_]*)',
        'function_args_detail': r'FUNCTION_HANDLER.*Argumentos:\s*(\{.*?\})',
        'function_executed': r'FUNCTION_EXECUTED.*función\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*ejecutada exitosamente',
        # NUEVOS patrones para categorías específicas
        'new_function_calling_start': r'\[FUNCTION_CALLING_START\].*OpenAI requiere ejecutar.*función',
        'new_function_executing': r'\[FUNCTION_EXECUTING\].*Ejecutando función.*functionName["\']:\s*["\']([^"\']+)["\']',
        'new_function_handler': r'\[FUNCTION_HANDLER\].*función.*([a-zA-Z_][a-zA-Z0-9_]*)',
    }
    
    # BEDS24 PATTERNS - Captura respuestas completas
    BEDS24_PATTERNS = {
        'request_start': r'BEDS24_REQUEST.*consultando disponibilidad.*desde\s*([0-9-]+).*hasta\s*([0-9-]+)',
        'api_call': r'BEDS24_API_CALL.*propId:\s*(\d+).*startDate:\s*([0-9-]+).*endDate:\s*([0-9-]+)',
        'response_detail': r'BEDS24_RESPONSE_DETAIL.*fullResponse["\']:\s*["\']([^"\']+)["\']',
        'response_summary': r'BEDS24_RESPONSE_SUMMARY.*(\d+)\s*propiedad(?:es)?.*disponible(?:s)?',
        'response_error': r'BEDS24_ERROR.*error["\']:\s*["\']([^"\']+)["\']',
        'response_raw': r'BEDS24_RAW_RESPONSE.*(\{.*\})',
    }
    
    # OPENAI PATTERNS - Estados detallados con IDs
    OPENAI_PATTERNS = {
        'adding_message': r'OPENAI_REQUEST.*adding_message.*thread[_\s]*([a-zA-Z0-9_]+)',
        'creating_run': r'OPENAI_REQUEST.*creating_run.*thread[_\s]*([a-zA-Z0-9_]+)',
        'run_started': r'OPENAI_REQUEST.*run_started.*run[_\s]*([a-zA-Z0-9_]+)',
        'function_calling_start': r'OPENAI_REQUEST.*function_calling_start.*run[_\s]*([a-zA-Z0-9_]+)',
        'run_completed': r'OPENAI_RUN_COMPLETED.*run[_\s]*([a-zA-Z0-9_]+).*duration:\s*(\d+(?:\.\d+)?)',
        'response_received': r'OPENAI_RESPONSE.*thread[_\s]*([a-zA-Z0-9_]+).*"([^"]*)"',
        'token_usage': r'OPENAI_TOKENS.*prompt:\s*(\d+).*completion:\s*(\d+).*total:\s*(\d+)',
    }
    
    # THREAD PATTERNS - Manejo de threads
    THREAD_PATTERNS = {
        'thread_found': r'Thread encontrado.*thread[_\s]*([a-zA-Z0-9_]+)',
        'thread_created': r'Thread creado.*thread[_\s]*([a-zA-Z0-9_]+)',
        'thread_reused': r'Thread reutilizado.*thread[_\s]*([a-zA-Z0-9_]+)',
        'thread_cleanup': r'Thread cleanup.*thread[_\s]*([a-zA-Z0-9_]+)',
        'thread_error': r'Thread error.*thread[_\s]*([a-zA-Z0-9_]+).*error:\s*([^|]+)',
    }
    
    # ERROR PATTERNS - Contexto completo de errores
    ERROR_PATTERNS = {
        'openai_timeout': r'Error.*OpenAI.*timeout.*(\d+)ms.*thread[_\s]*([a-zA-Z0-9_]+)',
        'beds24_error': r'Error.*Beds24.*([^|]+).*usuario:\s*(\d+)',
        'function_error': r'Error.*función\s*([a-zA-Z_][a-zA-Z0-9_]*).*([^|]+)',
        'rate_limit': r'Error.*rate limit.*([^|]+)',
        'network_error': r'Error.*network.*([^|]+)',
        'validation_error': r'Error.*validación.*([^|]+)',
        'system_error': r'Error.*sistema.*([^|]+)',
    }
    
    # USER INTERACTION PATTERNS - Interacciones completas
    USER_PATTERNS = {
        'message_received': r'MESSAGE_RECEIVED.*Usuario\s*(\d+):\s*"([^"]*)"',
        'message_grouped': r'MESSAGE_PROCESS.*mensajes agrupados.*messageCount["\']:\s*(\d+)',
        'user_intent': r'USER_INTENT.*intent["\']:\s*["\']([^"\']+)["\'].*confidence:\s*(\d+(?:\.\d+)?)',
        'user_context': r'USER_CONTEXT.*context["\']:\s*["\']([^"\']+)["\']',
    }
    
    # SYSTEM PATTERNS - Estados del sistema
    SYSTEM_PATTERNS = {
        'bot_started': r'Bot iniciado.*puerto\s*(\d+)',
        'openai_configured': r'OpenAI configurado.*timeout:\s*(\d+).*retries:\s*(\d+)',
        'deployment_info': r'Deployment.*([a-zA-Z0-9-]+)',
        'memory_usage': r'Memory.*(\d+)MB.*CPU.*(\d+)%',
        'session_start': r'NUEVA SESIÓN.*session[_\s]*([a-zA-Z0-9_]+)',
        'session_end': r'FIN DE SESIÓN.*session[_\s]*([a-zA-Z0-9_]+)',
    }

class LogEntry:
    """Representa una entrada de log individual con extracción técnica mejorada"""
    def __init__(self, timestamp: str, severity: str, message: str, raw_data: dict):
        self.timestamp = timestamp
        self.severity = severity
        self.message = message
        self.raw_data = raw_data
        self.colombia_time = self._convert_to_colombia_time()
        self.parsed_content = self._parse_log_content_enhanced()
    
    def _convert_to_colombia_time(self) -> datetime:
        """Convierte timestamp UTC a hora Colombia (UTC-5)"""
        try:
            # Parsear timestamp de Google Cloud (formato ISO)
            utc_time = datetime.fromisoformat(self.timestamp.replace('Z', '+00:00'))
            # Convertir a Colombia (UTC-5)
            colombia_time = utc_time - timedelta(hours=5)
            return colombia_time
        except Exception as e:
            print(f"Error parsing timestamp {self.timestamp}: {e}")
            return datetime.now() - timedelta(hours=5)
    
    def _parse_log_content_enhanced(self) -> Dict[str, Any]:
        """Parsea el contenido del log con extracción técnica mejorada"""
        parsed = {
            'type': 'unknown',
            'user_id': None,
            'content': self.message,
            'function_name': None,
            'function_args': None,
            'function_result': None,
            'openai_state': None,
            'openai_run_id': None,
            'openai_thread_id': None,
            'beds24_data': None,
            'beds24_full_response': None,
            'response_preview': None,
            'duration': None,
            'error_context': None,
            'thread_info': None,
            'is_http_metadata': False,
            'log_category': None,
            'source_file': None,
            'json_data': {},
            'raw_useful_content': None,
            'technical_details': {}
        }
        
        # Detectar si es solo metadata HTTP (para filtrar)
        if self._is_http_metadata_only():
            parsed['is_http_metadata'] = True
            return parsed
        
        # EXTRACCIÓN INTELIGENTE: Buscar contenido útil dentro de logs contaminados
        useful_content = self._extract_useful_content_from_contaminated_log()
        if useful_content:
            parsed['raw_useful_content'] = useful_content
            # Re-parsear con el contenido limpio
            clean_message = useful_content
        else:
            clean_message = self.message
        
        # Extraer información de usuario
        user_match = re.search(r'(573\d{9}|57\d{10})', clean_message)
        if user_match:
            parsed['user_id'] = user_match.group(1)
        
        # ============================================================================
        # ✨ NUEVAS CATEGORÍAS DE LOGGING - PARSING ACTUALIZADO
        # ============================================================================
        
        # NUEVAS CATEGORÍAS - Parsing específico
        for pattern_name, pattern in EnhancedPatterns.NEW_CATEGORY_PATTERNS.items():
            match = re.search(pattern, clean_message, re.IGNORECASE | re.DOTALL)
            if match:
                parsed['log_category'] = pattern_name.upper()
                parsed['technical_details']['new_category'] = True
                
                # Parsing específico por categoría
                if pattern_name == 'message_received':
                    parsed['type'] = 'message_received'
                    parsed['user_id'] = match.group(1)
                    parsed['technical_details']['category_type'] = 'messaging'
                
                elif pattern_name == 'message_process':
                    parsed['type'] = 'message_process'
                    parsed['technical_details']['message_count'] = int(match.group(1))
                    parsed['technical_details']['category_type'] = 'messaging'
                
                elif pattern_name == 'whatsapp_send':
                    parsed['type'] = 'whatsapp_send'
                    parsed['user_id'] = match.group(1)
                    parsed['technical_details']['category_type'] = 'messaging'
                
                elif pattern_name == 'whatsapp_chunks_complete':
                    parsed['type'] = 'whatsapp_chunks_complete'
                    parsed['technical_details']['total_chunks'] = int(match.group(1))
                    parsed['technical_details']['category_type'] = 'messaging'
                
                elif pattern_name == 'openai_request':
                    parsed['type'] = 'openai_request'
                    parsed['user_id'] = match.group(1)
                    parsed['openai_state'] = match.group(2)
                    parsed['technical_details']['category_type'] = 'ai_processing'
                
                elif pattern_name == 'openai_response':
                    parsed['type'] = 'openai_response'
                    parsed['user_id'] = match.group(1)
                    parsed['openai_thread_id'] = match.group(2)
                    parsed['technical_details']['category_type'] = 'ai_processing'
                
                elif pattern_name == 'function_calling_start':
                    parsed['type'] = 'function_calling_start'
                    parsed['user_id'] = match.group(1)
                    parsed['technical_details']['tool_calls_count'] = int(match.group(2))
                    parsed['technical_details']['category_type'] = 'function_calling'
                
                elif pattern_name == 'function_executing':
                    parsed['type'] = 'function_executing'
                    parsed['user_id'] = match.group(1)
                    parsed['function_name'] = match.group(2)
                    parsed['technical_details']['category_type'] = 'function_calling'
                
                elif pattern_name == 'beds24_request':
                    parsed['type'] = 'beds24_request'
                    parsed['technical_details']['start_date'] = match.group(1)
                    parsed['technical_details']['end_date'] = match.group(2)
                    parsed['technical_details']['category_type'] = 'beds24_integration'
                
                elif pattern_name == 'beds24_api_call':
                    parsed['type'] = 'beds24_api_call'
                    parsed['technical_details']['method'] = match.group(1)
                    parsed['technical_details']['endpoint'] = match.group(2)
                    parsed['technical_details']['category_type'] = 'beds24_integration'
                
                elif pattern_name == 'beds24_response_detail':
                    parsed['type'] = 'beds24_response_detail'
                    parsed['technical_details']['status'] = int(match.group(1))
                    parsed['technical_details']['data_count'] = int(match.group(2))
                    parsed['technical_details']['category_type'] = 'beds24_integration'
                
                elif pattern_name == 'beds24_processing':
                    parsed['type'] = 'beds24_processing'
                    parsed['technical_details']['processing_stage'] = match.group(1)
                    parsed['technical_details']['category_type'] = 'beds24_integration'
                
                elif pattern_name == 'thread_created':
                    parsed['type'] = 'thread_created'
                    parsed['user_id'] = match.group(1)
                    parsed['openai_thread_id'] = match.group(2)
                    parsed['technical_details']['category_type'] = 'thread_management'
                
                elif pattern_name == 'thread_persist':
                    parsed['type'] = 'thread_persist'
                    parsed['technical_details']['threads_count'] = int(match.group(1))
                    parsed['technical_details']['source'] = match.group(2)
                    parsed['technical_details']['category_type'] = 'thread_management'
                
                elif pattern_name == 'thread_cleanup':
                    parsed['type'] = 'thread_cleanup'
                    parsed['technical_details']['operation'] = match.group(1)
                    parsed['technical_details']['success'] = match.group(2) == 'true'
                    parsed['technical_details']['category_type'] = 'thread_management'
                
                elif pattern_name == 'server_start':
                    parsed['type'] = 'server_start'
                    parsed['technical_details']['host'] = match.group(1)
                    parsed['technical_details']['port'] = int(match.group(2))
                    parsed['technical_details']['category_type'] = 'system'
                
                elif pattern_name == 'bot_ready':
                    parsed['type'] = 'bot_ready'
                    parsed['technical_details']['environment'] = match.group(1)
                    parsed['technical_details']['category_type'] = 'system'
                
                break  # Solo procesar la primera categoría que coincida
        
        # ============================================================================
        # EXTRACCIÓN TÉCNICA MEJORADA - FUNCTION CALLING COMPLETO (FALLBACK)
        # ============================================================================
        
        # FUNCTION CALLING - Argumentos completos (solo si no se detectó nueva categoría)
        if parsed['type'] == 'unknown':
            for pattern_name, pattern in EnhancedPatterns.FUNCTION_CALL_PATTERNS.items():
                match = re.search(pattern, clean_message, re.IGNORECASE | re.DOTALL)
                if match:
                    parsed['type'] = 'function_calling'
                    parsed['log_category'] = 'FUNCTION_CALLING'
                    
                    if pattern_name == 'function_start':
                        parsed['function_name'] = match.group(1)
                        parsed['technical_details']['function_state'] = 'starting'
                    
                    elif pattern_name == 'function_executing':
                        parsed['function_name'] = match.group(1)
                        parsed['technical_details']['function_state'] = 'executing'
                    
                    elif pattern_name == 'function_args':
                        try:
                            parsed['function_args'] = json.loads(match.group(1))
                            parsed['technical_details']['args_parsed'] = True
                        except:
                            parsed['function_args'] = match.group(1)
                            parsed['technical_details']['args_parsed'] = False
                    
                    elif pattern_name == 'function_result':
                        parsed['function_result'] = match.group(1)
                        parsed['technical_details']['function_state'] = 'completed'
                    
                    break
        
        # ============================================================================
        # EXTRACCIÓN TÉCNICA MEJORADA - BEDS24 COMPLETO
        # ============================================================================
        
        # BEDS24 - Respuestas completas
        for pattern_name, pattern in EnhancedPatterns.BEDS24_PATTERNS.items():
            match = re.search(pattern, clean_message, re.IGNORECASE | re.DOTALL)
            if match:
                parsed['type'] = 'beds24_operation'
                parsed['log_category'] = 'BEDS24'
                
                if pattern_name == 'request_start':
                    parsed['technical_details']['start_date'] = match.group(1)
                    parsed['technical_details']['end_date'] = match.group(2)
                    parsed['technical_details']['operation'] = 'availability_check'
                
                elif pattern_name == 'response_detail':
                    parsed['beds24_full_response'] = match.group(1).replace('\\n', '\n')
                    parsed['technical_details']['response_type'] = 'full_response'
                    parsed['technical_details']['response_length'] = len(parsed['beds24_full_response'])
                
                elif pattern_name == 'response_summary':
                    parsed['technical_details']['available_properties'] = int(match.group(1))
                    parsed['technical_details']['response_type'] = 'summary'
                
                elif pattern_name == 'response_error':
                    parsed['technical_details']['beds24_error'] = match.group(1)
                    parsed['technical_details']['response_type'] = 'error'
                
                break
        
        # ============================================================================
        # EXTRACCIÓN TÉCNICA MEJORADA - OPENAI ESTADOS DETALLADOS
        # ============================================================================
        
        # OPENAI - Estados con IDs
        for pattern_name, pattern in EnhancedPatterns.OPENAI_PATTERNS.items():
            match = re.search(pattern, clean_message, re.IGNORECASE)
            if match:
                parsed['type'] = 'openai_operation'
                parsed['log_category'] = 'OPENAI'
                
                if pattern_name == 'adding_message':
                    parsed['openai_state'] = 'adding_message'
                    parsed['openai_thread_id'] = match.group(1)
                    parsed['technical_details']['openai_step'] = 'message_preparation'
                
                elif pattern_name == 'creating_run':
                    parsed['openai_state'] = 'creating_run'
                    parsed['openai_thread_id'] = match.group(1)
                    parsed['technical_details']['openai_step'] = 'run_creation'
                
                elif pattern_name == 'run_started':
                    parsed['openai_state'] = 'run_started'
                    parsed['openai_run_id'] = match.group(1)
                    parsed['technical_details']['openai_step'] = 'run_execution'
                
                elif pattern_name == 'function_calling_start':
                    parsed['openai_state'] = 'function_calling_start'
                    parsed['openai_run_id'] = match.group(1)
                    parsed['technical_details']['openai_step'] = 'function_calling'
                
                elif pattern_name == 'run_completed':
                    parsed['openai_state'] = 'run_completed'
                    parsed['openai_run_id'] = match.group(1)
                    parsed['duration'] = float(match.group(2)) if len(match.groups()) > 1 else None
                    parsed['technical_details']['openai_step'] = 'completed'
                
                elif pattern_name == 'response_received':
                    parsed['openai_state'] = 'response_received'
                    parsed['openai_thread_id'] = match.group(1)
                    parsed['response_preview'] = match.group(2)
                    parsed['technical_details']['openai_step'] = 'response_processing'
                
                break
        
        # ============================================================================
        # EXTRACCIÓN TÉCNICA MEJORADA - THREAD MANAGEMENT
        # ============================================================================
        
        # THREADS - Información completa
        for pattern_name, pattern in EnhancedPatterns.THREAD_PATTERNS.items():
            match = re.search(pattern, clean_message, re.IGNORECASE)
            if match:
                parsed['type'] = 'thread_management'
                parsed['log_category'] = 'THREAD'
                
                if pattern_name == 'thread_found':
                    parsed['thread_info'] = {'action': 'found', 'thread_id': match.group(1)}
                    parsed['technical_details']['thread_operation'] = 'reuse'
                
                elif pattern_name == 'thread_created':
                    parsed['thread_info'] = {'action': 'created', 'thread_id': match.group(1)}
                    parsed['technical_details']['thread_operation'] = 'creation'
                
                elif pattern_name == 'thread_error':
                    parsed['thread_info'] = {'action': 'error', 'thread_id': match.group(1)}
                    parsed['error_context'] = match.group(2).strip()
                    parsed['technical_details']['thread_operation'] = 'error'
                
                break
        
        # ============================================================================
        # EXTRACCIÓN TÉCNICA MEJORADA - ERROR CONTEXT COMPLETO
        # ============================================================================
        
        # ERRORS - Contexto completo
        for pattern_name, pattern in EnhancedPatterns.ERROR_PATTERNS.items():
            match = re.search(pattern, clean_message, re.IGNORECASE)
            if match:
                parsed['type'] = 'error'
                parsed['log_category'] = 'ERROR'
                
                if pattern_name == 'openai_timeout':
                    parsed['error_context'] = f"OpenAI timeout after {match.group(1)}ms"
                    parsed['technical_details']['error_type'] = 'timeout'
                    parsed['technical_details']['timeout_duration'] = match.group(1)
                    parsed['technical_details']['affected_thread'] = match.group(2)
                
                elif pattern_name == 'beds24_error':
                    parsed['error_context'] = match.group(1).strip()
                    parsed['technical_details']['error_type'] = 'beds24_api'
                    parsed['technical_details']['affected_user'] = match.group(2)
                
                elif pattern_name == 'function_error':
                    parsed['error_context'] = match.group(2).strip()
                    parsed['technical_details']['error_type'] = 'function_execution'
                    parsed['technical_details']['failed_function'] = match.group(1)
                
                else:
                    parsed['error_context'] = match.group(1).strip()
                    parsed['technical_details']['error_type'] = pattern_name
                
                break
        
        # ============================================================================
        # DETECTAR TIPOS DE LOGS ESPECÍFICOS (como logs locales)
        # ============================================================================
        
        # Si no se detectó ningún tipo específico, usar los detectores originales
        if parsed['type'] == 'unknown':
            if self._is_message_received(clean_message):
                parsed.update(self._parse_message_received(clean_message))
            
            elif self._is_message_process(clean_message):
                parsed.update(self._parse_message_process(clean_message))
            
            elif self._is_bot_response():
                parsed['type'] = 'bot_response'
                # Extraer duración y preview
                duration_match = re.search(r'Completado\s*\(([^)]+)\)', clean_message)
                if duration_match:
                    parsed['duration'] = duration_match.group(1)
                
                # Extraer preview de respuesta
                preview_patterns = [
                    r'→\s*"([^"]+)"',  # Formato: → "preview"
                    r'"([^"]+)"',  # Cualquier texto entre comillas
                ]
                for pattern in preview_patterns:
                    preview_match = re.search(pattern, clean_message)
                    if preview_match:
                        parsed['response_preview'] = preview_match.group(1)
                        break
        
        return parsed
    
    def _extract_useful_content_from_contaminated_log(self) -> Optional[str]:
        """Extrae contenido útil de logs contaminados con httpRequest - MEJORADO"""
        # Buscar en textPayload con mejor manejo de escape
        text_patterns = [
            r'"textPayload":\s*"([^"\\]*(\\.[^"\\]*)*)"',  # Maneja escapes correctamente
            r'"textPayload":\s*"([^"]+)"',  # Patrón simple como fallback
        ]
        
        for pattern in text_patterns:
            text_match = re.search(pattern, self.message)
            if text_match:
                content = text_match.group(1)
                # Decodificar escapes JSON correctamente
                content = content.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
                content = content.replace('\\t', '\t').replace('\\r', '\r')
                return content
        
        # Buscar en jsonPayload.message
        json_msg_match = re.search(r'"message":\s*"([^"\\]*(\\.[^"\\]*)*)"', self.message)
        if json_msg_match:
            content = json_msg_match.group(1)
            content = content.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
            return content
        
        # Buscar patrones de logs útiles embebidos (más específicos y mejorados)
        useful_patterns = [
            r'(7/10\s+\[[^\]]+\][^}]+(?:\}[^}]*)*)',  # Formato de timestamp del bot
            r'(\[INFO\][^}]+(?:\}[^}]*)*)',  # Logs con [INFO]
            r'(\[SUCCESS\][^}]+(?:\}[^}]*)*)',  # Logs con [SUCCESS]
            r'(\[ERROR\][^}]+(?:\}[^}]*)*)',  # Logs con [ERROR]
            r'(573\d{9}:[^}]+(?:\}[^}]*)*)',  # Mensajes de usuario
            r'(adding_message[^}]+(?:\}[^}]*)*)',  # OpenAI states
            r'(creating_run[^}]+(?:\}[^}]*)*)',
            r'(run_started[^}]+(?:\}[^}]*)*)',
            r'(function_calling[^}]+(?:\}[^}]*)*)',
            r'(BEDS24_[^}]+(?:\}[^}]*)*)',  # Beds24 logs
            r'(FUNCTION_CALLING[^}]+(?:\}[^}]*)*)',  # Function calling
            r'(OPENAI_[^}]+(?:\}[^}]*)*)',  # OpenAI logs
            r'(Thread\s+[a-zA-Z]+[^}]+(?:\}[^}]*)*)',  # Thread management
            r'(Error[^}]+(?:\}[^}]*)*)',  # Error logs
        ]
        
        for pattern in useful_patterns:
            match = re.search(pattern, self.message, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    # ============================================================================
    # PARSERS ESPECÍFICOS PARA CADA TIPO DE LOG - MEJORADOS
    # ============================================================================
    
    def _is_message_received(self, content: str) -> bool:
        """Detecta MESSAGE_RECEIVED"""
        patterns = [
            r'573\d{9}.*"[^"]+"',
            r'Mensaje recibido.*from',
            r'📱.*573\d{9}',
            r'MESSAGE_RECEIVED.*Usuario',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _parse_message_received(self, content: str) -> Dict[str, Any]:
        """Parsea logs de MESSAGE_RECEIVED - MEJORADO"""
        result = {
            'type': 'message_received',
            'log_category': 'MESSAGE_RECEIVED',
            'source_file': 'webhook',
            'technical_details': {}
        }
        
        # Extraer mensaje con mejor precisión
        msg_patterns = [
            r'Usuario\s*\d+:\s*"([^"]+)"',  # Formato: Usuario 573xxx: "mensaje"
            r'573\d{9}:\s*"([^"]+)"',       # Formato: 573xxx: "mensaje"
            r'"([^"]+)"',                   # Cualquier texto entre comillas
        ]
        for pattern in msg_patterns:
            match = re.search(pattern, content)
            if match:
                result['content'] = match.group(1)
                result['technical_details']['message_length'] = len(match.group(1))
                result['technical_details']['message_type'] = 'text'
                result['json_data'] = {
                    'from': result.get('user_id', 'unknown'),
                    'type': 'text',
                    'body': match.group(1),
                    'timestamp': int(self.colombia_time.timestamp())
                }
                break
        
        return result
    
    def _is_message_process(self, content: str) -> bool:
        """Detecta MESSAGE_PROCESS"""
        patterns = [
            r'Procesando mensajes agrupados',
            r'messageCount.*totalLength',
            r'\[BOT\].*msgs.*OpenAI',
            r'MESSAGE_PROCESS',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _parse_message_process(self, content: str) -> Dict[str, Any]:
        """Parsea logs de MESSAGE_PROCESS - MEJORADO"""
        result = {
            'type': 'message_process',
            'log_category': 'MESSAGE_PROCESS',
            'source_file': 'app-unified.ts',
            'technical_details': {}
        }
        
        # Extraer información de procesamiento con más detalle
        count_match = re.search(r'(\d+)\s+msgs', content)
        if count_match:
            result['technical_details']['message_count'] = int(count_match.group(1))
            result['json_data'] = {
                'messageCount': int(count_match.group(1)),
                'userId': result.get('user_id', 'unknown'),
            }
        
        # Detectar si va hacia OpenAI
        if 'OpenAI' in content:
            result['technical_details']['destination'] = 'OpenAI'
            result['technical_details']['processing_type'] = 'ai_processing'
        
        return result
    
    def _is_bot_response(self) -> bool:
        """Detecta si es una respuesta del bot"""
        patterns = [
            r'\[BOT\].*Completado',
            r'Bot.*completado.*\d+\.?\d*s',
            r'respuesta.*enviada.*usuario',
            r'WHATSAPP_CHUNKS_COMPLETE',
            r'\[32m\[BOT\].*Completado',
            r'Completado\s*\(\d+\.?\d*s\)',  # Formato: Completado (X.Xs)
        ]
        return any(re.search(pattern, self.message, re.IGNORECASE) for pattern in patterns)
    
    def _is_http_metadata_only(self) -> bool:
        """Detecta si el log contiene SOLO metadata HTTP sin información útil"""
        # ⚠️ FILTROS MEJORADOS - Eliminar logs gigantes de Cloud Audit y metadata
        http_only_patterns = [
            r'^{\s*["\']httpRequest["\']',  # Empieza con httpRequest
            r'latency.*protocol.*requestMethod.*responseSize',  # Contiene solo datos HTTP
            r'insertId.*labels.*gcb-build-id',  # Solo metadata de build
            r'spanId.*trace.*traceSampled.*timestamp.*severity.*INFO',  # Solo tracing
            r'receiveTimestamp.*resource.*labels.*configuration_name',  # Solo metadata de recurso
            
            # 🔥 NUEVOS FILTROS - Eliminar logs gigantes de Cloud Audit
            r'insertId.*logName.*projects.*cloudaudit\.googleapis\.com',  # Cloud Audit logs
            r'protoPayload.*@type.*google\.cloud\.audit\.AuditLog',  # Audit payload
            r'methodName.*Services\.ReplaceService.*resourceName.*namespaces',  # Service deployment
            r'response.*@type.*google\.cloud\.run\.v1\.Revision',  # Revision metadata
            r'metadata.*annotations.*autoscaling\.knative\.dev',  # Knative metadata
            r'containerStatuses.*imageDigest.*northamerica-northeast1-docker',  # Container metadata
            r'serviceName.*run\.googleapis\.com.*status.*message.*Ready',  # Service status
            r'labels.*gcb-build-id.*gcb-trigger-id.*managed-by.*gcp-cloud-build',  # Build metadata
            r'env.*WHAPI_TOKEN.*OPENAI_API_KEY.*ASSISTANT_ID',  # Environment variables (SECURITY!)
            r'spec.*containers.*image.*northamerica-northeast1-docker\.pkg\.dev',  # Container spec
            r'limits.*cpu.*memory.*startupProbe.*failureThreshold',  # Resource limits
        ]
        
        # Si contiene estos patrones Y no contiene información útil, filtrar
        has_http_metadata = any(re.search(pattern, self.message, re.IGNORECASE) for pattern in http_only_patterns)
        
        # Verificar que NO contenga información útil
        useful_patterns = [
            r'573\d{9}',  # Números de usuario
            r'OpenAI|Beds24|función|error|warning',  # Palabras clave importantes
            r'Bot.*completado|iniciado|respuesta',  # Estados del bot
            r'SERVER_START|BOT_READY|FUNCTION_',  # Eventos importantes
            r'adding_message|creating_run|run_completed',  # Estados OpenAI
            r'Servidor.*iniciado|completamente.*inicializado',  # Inicio del bot
            r'Buffer.*vacío|mensajes.*pendientes',  # Estados del sistema
            r'Usuario.*mensaje.*recibido',  # Mensajes de usuarios
            r'PROCESSING.*msgs.*OpenAI',  # Procesamiento
            r'recuperación.*post-reinicio',  # Recuperación después de reinicio
        ]
        
        has_useful_content = any(re.search(pattern, self.message, re.IGNORECASE) for pattern in useful_patterns)
        
        # Filtrar si tiene metadata HTTP Y NO tiene contenido útil
        return has_http_metadata and not has_useful_content
    
    def _is_user_message(self) -> bool:
        """Detecta si es un mensaje de usuario"""
        patterns = [
            r'👤\s*USER',
            r'573\d{9}.*"[^"]+"',  # Número colombiano seguido de mensaje en comillas
            r'Procesando mensaje de usuario',
            r'mensaje recibido.*from.*573',
            r'\[94m.*\[36m.*573\d{9}.*"[^"]+"',  # Formato específico de Cloud Run
            r'573\d{9}:[^"]*"[^"]+"',  # Formato directo: número: "mensaje"
        ]
        return any(re.search(pattern, self.message, re.IGNORECASE) for pattern in patterns)
    
    def _is_function_call(self) -> bool:
        """Detecta si es una llamada a función"""
        patterns = [
            r'función.*ejecut',
            r'FUNCTION_EXECUTING',
            r'FUNCTION_HANDLER',
            r'check_availability|get_booking|cancel_booking',
            r'Ejecutando función',
            r'OPENAI.*requiere.*función',
        ]
        return any(re.search(pattern, self.message, re.IGNORECASE) for pattern in patterns)
    
    def _is_beds24_data(self) -> bool:
        """Detecta si contiene datos de Beds24"""
        patterns = [
            r'BEDS24.*RESPONSE',
            r'fullResponse.*📅',
            r'Beds24.*enviada.*OpenAI',
            r'disponibilidad.*apartamento',
            r'OPENAI_FUNCTION_OUTPUT.*check_availability',
            r'Datos.*enviados.*OpenAI.*📅',  # Datos crudos de Beds24
        ]
        return any(re.search(pattern, self.message, re.IGNORECASE) for pattern in patterns)
    
    def _is_openai_state(self) -> bool:
        """Detecta estados de OpenAI"""
        patterns = [
            r'OPENAI_REQUEST',
            r'adding_message|message_added|creating_run|run_started|run_completed',
            r'OpenAI.*requiere.*función',
            r'FUNCTION_CALLING_START',
            r'\[BOT\].*msgs.*OpenAI',  # Formato: [BOT] X msgs → OpenAI
        ]
        return any(re.search(pattern, self.message, re.IGNORECASE) for pattern in patterns)
    
    def is_user_message(self) -> bool:
        """Detecta si es un mensaje de usuario (método público)"""
        return self.parsed_content['type'] == 'user_message'
    
    def is_error(self) -> bool:
        """Detecta si es un error"""
        return self.severity in ['ERROR', 'CRITICAL'] or any(
            pattern in self.message.lower() for pattern in [
                'error', 'exception', 'failed', 'timeout', 'crash'
            ]
        )
    
    def is_warning(self) -> bool:
        """Detecta si es un warning"""
        return self.severity == 'WARNING' or any(
            pattern in self.message.lower() for pattern in [
                'warning', 'warn', 'buffer vacío', 'retry', 'fallback'
            ]
        )
    
    def is_session_start(self) -> bool:
        """Detecta si marca el inicio de una sesión"""
        patterns = [
            r'Servidor HTTP iniciado',
            r'Bot completamente inicializado',
            r'SERVER_START',
            r'Starting server',
            r'Application started',
            r'Bot iniciado exitosamente',
            r'BOT_READY'
        ]
        return any(re.search(pattern, self.message, re.IGNORECASE) for pattern in patterns)
    
    def should_filter_out(self) -> bool:
        """Determina si este log debe filtrarse (no mostrarse)"""
        return self.parsed_content['is_http_metadata'] or self._is_http_metadata_only()
    
    def format_colored(self) -> str:
        """Formatea el log con colores y información técnica COMPLETA - VERSIÓN MEJORADA"""
        parsed = self.parsed_content
        
        # Filtrar logs de metadata HTTP
        if parsed.get('is_http_metadata', False):
            return ""
        
        # Timestamp en formato legible
        timestamp = self.colombia_time.strftime('%Y-%m-%d %H:%M:%S')
        
        # ============================================================================
        # FORMATEO TÉCNICO MEJORADO - INFORMACIÓN COMPLETA COMO LOGS LOCALES
        # ============================================================================
        
        # FUNCTION CALLING COMPLETO - Argumentos y resultados
        if parsed.get('type') == 'function_calling':
            func_name = parsed.get('function_name', 'unknown')
            func_args = parsed.get('function_args', {})
            func_state = parsed.get('technical_details', {}).get('function_state', 'unknown')
            func_result = parsed.get('function_result', '')
            
            if func_state == 'starting':
                return f"{Fore.YELLOW}[{timestamp}] ⚙️ FUNCIÓN: {func_name} (iniciando){Style.RESET_ALL}"
            
            elif func_state == 'executing' and func_args:
                # Mostrar argumentos completos como en logs locales
                if isinstance(func_args, dict):
                    args_formatted = json.dumps(func_args, ensure_ascii=False, indent=2)
                    return f"{Fore.YELLOW}[{timestamp}] ⚙️ FUNCIÓN: {func_name}{Style.RESET_ALL}\n{Fore.CYAN}           Args: {args_formatted}{Style.RESET_ALL}"
                else:
                    return f"{Fore.YELLOW}[{timestamp}] ⚙️ FUNCIÓN: {func_name}{Style.RESET_ALL}\n{Fore.CYAN}           Args: {func_args}{Style.RESET_ALL}"
            
            elif func_state == 'completed' and func_result:
                return f"{Fore.GREEN}[{timestamp}] ✅ FUNCIÓN: {func_name} completada{Style.RESET_ALL}\n{Fore.CYAN}           Resultado: {func_result[:200]}...{Style.RESET_ALL}"
            
            else:
                return f"{Fore.YELLOW}[{timestamp}] ⚙️ FUNCIÓN: {func_name}{Style.RESET_ALL}"
        
        # BEDS24 OPERATIONS COMPLETO - Respuestas completas
        elif parsed.get('type') == 'beds24_operation':
            operation = parsed.get('technical_details', {}).get('operation', 'unknown')
            response_type = parsed.get('technical_details', {}).get('response_type', 'unknown')
            
            if operation == 'availability_check':
                start_date = parsed.get('technical_details', {}).get('start_date', '?')
                end_date = parsed.get('technical_details', {}).get('end_date', '?')
                return f"{Fore.CYAN}[{timestamp}] 📊 BEDS24: Consultando disponibilidad{Style.RESET_ALL}\n{Fore.CYAN}           Fechas: {start_date} → {end_date}{Style.RESET_ALL}"
            
            elif response_type == 'full_response':
                beds24_response = parsed.get('beds24_full_response', '')
                response_length = parsed.get('technical_details', {}).get('response_length', 0)
                
                # Mostrar respuesta completa formateada como en logs locales
                if beds24_response:
                    # Mostrar primeras líneas de la respuesta
                    preview_lines = beds24_response.split('\n')[:5]
                    preview = '\n           '.join(preview_lines)
                    return f"{Fore.GREEN}[{timestamp}] ✅ BEDS24: Respuesta completa ({response_length} chars){Style.RESET_ALL}\n{Fore.CYAN}           Respuesta:{Style.RESET_ALL}\n{Fore.WHITE}           {preview}{Style.RESET_ALL}\n{Fore.LIGHTBLACK_EX}           ... (respuesta completa truncada){Style.RESET_ALL}"
                else:
                    return f"{Fore.GREEN}[{timestamp}] ✅ BEDS24: Respuesta completa ({response_length} chars){Style.RESET_ALL}"
            
            elif response_type == 'summary':
                available_props = parsed.get('technical_details', {}).get('available_properties', 0)
                return f"{Fore.GREEN}[{timestamp}] 📋 BEDS24: {available_props} propiedades disponibles{Style.RESET_ALL}"
            
            elif response_type == 'error':
                beds24_error = parsed.get('technical_details', {}).get('beds24_error', 'Unknown error')
                return f"{Fore.RED}[{timestamp}] 🔴 BEDS24 ERROR: {beds24_error}{Style.RESET_ALL}"
            
            else:
                return f"{Fore.CYAN}[{timestamp}] 📊 BEDS24: {operation}{Style.RESET_ALL}"
        
        # OPENAI OPERATIONS DETALLADO - Estados con IDs
        elif parsed.get('type') == 'openai_operation':
            openai_step = parsed.get('technical_details', {}).get('openai_step', 'unknown')
            openai_state = parsed.get('openai_state', 'unknown')
            thread_id = parsed.get('openai_thread_id', '')
            run_id = parsed.get('openai_run_id', '')
            duration = parsed.get('duration', 0)
            
            if openai_step == 'message_preparation':
                return f"{Fore.CYAN}[{timestamp}] 🔄 OPENAI: adding_message{Style.RESET_ALL}\n{Fore.CYAN}           Thread: {thread_id}{Style.RESET_ALL}"
            
            elif openai_step == 'run_creation':
                return f"{Fore.CYAN}[{timestamp}] 🔄 OPENAI: creating_run{Style.RESET_ALL}\n{Fore.CYAN}           Thread: {thread_id}{Style.RESET_ALL}"
            
            elif openai_step == 'run_execution':
                return f"{Fore.CYAN}[{timestamp}] 🔄 OPENAI: run_started{Style.RESET_ALL}\n{Fore.CYAN}           Run: {run_id}{Style.RESET_ALL}"
            
            elif openai_step == 'function_calling':
                return f"{Fore.YELLOW}[{timestamp}] 🔄 OPENAI: function_calling_start{Style.RESET_ALL}\n{Fore.CYAN}           Run: {run_id}{Style.RESET_ALL}"
            
            elif openai_step == 'completed':
                if duration and run_id:
                    return f"{Fore.GREEN}[{timestamp}] ✅ OPENAI: run_completed ({duration}ms){Style.RESET_ALL}\n{Fore.CYAN}           Run: {run_id}{Style.RESET_ALL}"
                else:
                    return f"{Fore.GREEN}[{timestamp}] ✅ OPENAI: run_completed{Style.RESET_ALL}"
            
            elif openai_step == 'response_processing':
                preview = parsed.get('response_preview', '')
                if preview and thread_id:
                    preview_short = preview[:100] + "..." if len(preview) > 100 else preview
                    return f"{Fore.GREEN}[{timestamp}] 📝 OPENAI: response_received{Style.RESET_ALL}\n{Fore.CYAN}           Thread: {thread_id}{Style.RESET_ALL}\n{Fore.WHITE}           Respuesta: \"{preview_short}\"{Style.RESET_ALL}"
                else:
                    return f"{Fore.GREEN}[{timestamp}] 📝 OPENAI: response_received{Style.RESET_ALL}"
            
            else:
                return f"{Fore.CYAN}[{timestamp}] 🔄 OPENAI: {openai_state}{Style.RESET_ALL}"
        
        # THREAD MANAGEMENT DETALLADO - IDs y estados
        elif parsed.get('type') == 'thread_management':
            thread_info = parsed.get('thread_info', {})
            thread_operation = parsed.get('technical_details', {}).get('thread_operation', 'unknown')
            
            if thread_operation == 'creation':
                thread_id = thread_info.get('thread_id', 'unknown')
                return f"{Fore.GREEN}[{timestamp}] 🆕 THREAD: Creado{Style.RESET_ALL}\n{Fore.CYAN}           ID: {thread_id}{Style.RESET_ALL}"
            
            elif thread_operation == 'reuse':
                thread_id = thread_info.get('thread_id', 'unknown')
                return f"{Fore.CYAN}[{timestamp}] 🔄 THREAD: Encontrado/Reutilizado{Style.RESET_ALL}\n{Fore.CYAN}           ID: {thread_id}{Style.RESET_ALL}"
            
            elif thread_operation == 'error':
                thread_id = thread_info.get('thread_id', 'unknown')
                error_context = parsed.get('error_context', 'Unknown error')
                return f"{Fore.RED}[{timestamp}] 🔴 THREAD ERROR{Style.RESET_ALL}\n{Fore.CYAN}           Thread: {thread_id}{Style.RESET_ALL}\n{Fore.RED}           Error: {error_context}{Style.RESET_ALL}"
            
            else:
                return f"{Fore.CYAN}[{timestamp}] 🧵 THREAD: {thread_operation}{Style.RESET_ALL}"
        
        # ERROR CONTEXT COMPLETO - Contexto y detalles
        elif parsed.get('type') == 'error':
            error_type = parsed.get('technical_details', {}).get('error_type', 'unknown')
            error_context = parsed.get('error_context', 'Unknown error')
            
            if error_type == 'timeout':
                timeout_duration = parsed.get('technical_details', {}).get('timeout_duration', '?')
                affected_thread = parsed.get('technical_details', {}).get('affected_thread', '?')
                return f"{Fore.RED}[{timestamp}] 🔴 ERROR: OpenAI timeout ({timeout_duration}ms){Style.RESET_ALL}\n{Fore.CYAN}           Thread afectado: {affected_thread}{Style.RESET_ALL}\n{Fore.RED}           Detalles: {error_context}{Style.RESET_ALL}"
            
            elif error_type == 'beds24_api':
                affected_user = parsed.get('technical_details', {}).get('affected_user', '?')
                return f"{Fore.RED}[{timestamp}] 🔴 BEDS24 ERROR{Style.RESET_ALL}\n{Fore.CYAN}           Usuario afectado: {affected_user}{Style.RESET_ALL}\n{Fore.RED}           Error: {error_context}{Style.RESET_ALL}"
            
            elif error_type == 'function_execution':
                failed_function = parsed.get('technical_details', {}).get('failed_function', '?')
                return f"{Fore.RED}[{timestamp}] 🔴 FUNCTION ERROR: {failed_function}{Style.RESET_ALL}\n{Fore.RED}           Detalles: {error_context}{Style.RESET_ALL}"
            
            else:
                return f"{Fore.RED}[{timestamp}] 🔴 ERROR: {error_type}{Style.RESET_ALL}\n{Fore.RED}           Detalles: {error_context}{Style.RESET_ALL}"
        
        # ============================================================================
        # TIPOS ORIGINALES MEJORADOS CON MÁS DETALLES
        # ============================================================================
        
        elif parsed.get('type') == 'message_received':
            user_id = parsed.get('user_id', 'unknown')
            content = parsed.get('content', 'mensaje')
            msg_length = parsed.get('technical_details', {}).get('message_length', 0)
            return f"{Fore.BLUE}[{timestamp}] 👤 USER: {user_id}: \"{content}\" ({msg_length} chars){Style.RESET_ALL}"
        
        elif parsed.get('type') == 'message_process':
            msg_count = parsed.get('technical_details', {}).get('message_count', '?')
            destination = parsed.get('technical_details', {}).get('destination', 'OpenAI')
            return f"{Fore.CYAN}[{timestamp}] 🔄 PROCESSING: {msg_count} mensajes → {destination}{Style.RESET_ALL}"
        
        elif parsed.get('type') == 'bot_response':
            duration = parsed.get('duration', '?')
            preview = parsed.get('response_preview', '')
            if preview:
                preview_short = preview[:100] + "..." if len(preview) > 100 else preview
                return f"{Fore.GREEN}[{timestamp}] 🤖 BOT: Completado ({duration}){Style.RESET_ALL}\n{Fore.WHITE}           Respuesta: \"{preview_short}\"{Style.RESET_ALL}"
            else:
                return f"{Fore.GREEN}[{timestamp}] 🤖 BOT: Completado ({duration}){Style.RESET_ALL}"
        
        else:
            # Log genérico - mostrar contenido útil extraído
            useful_content = parsed.get('raw_useful_content')
            if useful_content and useful_content.strip():
                # Detectar tipo específico en contenido útil y formatear apropiadamente
                if 'adding_message' in useful_content.lower():
                    return f"{Fore.CYAN}[{timestamp}] 🔄 OPENAI: adding_message{Style.RESET_ALL}"
                elif 'creating_run' in useful_content.lower():
                    return f"{Fore.CYAN}[{timestamp}] 🔄 OPENAI: creating_run{Style.RESET_ALL}"
                elif 'run_started' in useful_content.lower():
                    return f"{Fore.CYAN}[{timestamp}] 🔄 OPENAI: run_started{Style.RESET_ALL}"
                elif 'function_calling' in useful_content.lower():
                    return f"{Fore.YELLOW}[{timestamp}] ⚙️ OPENAI: function_calling_start{Style.RESET_ALL}"
                elif 'completado' in useful_content.lower():
                    # Extraer duración si está disponible
                    duration_match = re.search(r'(\d+\.?\d*)\s*s', useful_content)
                    duration_str = f"({duration_match.group(1)}s)" if duration_match else ""
                    return f"{Fore.GREEN}[{timestamp}] ✅ OPENAI: Completado {duration_str}{Style.RESET_ALL}"
                elif 'beds24' in useful_content.lower():
                    return f"{Fore.CYAN}[{timestamp}] 📊 BEDS24: {useful_content[:100]}...{Style.RESET_ALL}"
                else:
                    # Contenido genérico pero útil
                    display_content = useful_content[:150] + "..." if len(useful_content) > 150 else useful_content
                    return f"{Fore.LIGHTBLACK_EX}[{timestamp}] ℹ️ INFO: {display_content}{Style.RESET_ALL}"
            else:
                # Si no hay contenido útil, filtrar este log
                return ""

class BotSession:
    """Representa una sesión del bot"""
    def __init__(self, session_id: str, start_time: datetime):
        self.session_id = session_id
        self.start_time = start_time
        self.end_time: Optional[datetime] = None
        self.logs: List[LogEntry] = []
        self.users: set = set()
        self.errors: List[LogEntry] = []
        self.warnings: List[LogEntry] = []
        self.messages_processed = 0
        self.deployment_info = ""
    
    def add_log(self, log: LogEntry):
        """Añade un log a la sesión"""
        self.logs.append(log)
        
        if log.is_user_message():
            self.messages_processed += 1
            # Extraer ID de usuario si es posible
            user_match = re.search(r'(573\d{9}|57\d{10})', log.message)
            if user_match:
                self.users.add(user_match.group(1))
        
        if log.is_error():
            self.errors.append(log)
        elif log.is_warning():
            self.warnings.append(log)
    
    def finalize(self, end_time: datetime):
        """Finaliza la sesión"""
        self.end_time = end_time
    
    def duration(self) -> timedelta:
        """Calcula la duración de la sesión"""
        if self.end_time:
            return self.end_time - self.start_time
        return datetime.now() - timedelta(hours=5) - self.start_time
    
    def format_session(self) -> str:
        """Formatea la sesión completa"""
        output = []
        
        # Encabezado de sesión
        output.append(f"{Colors.BOLD}{Colors.GREEN}=== NUEVA SESIÓN DEL BOT ==={Colors.END}")
        output.append(f"{Colors.CYAN}Timestamp: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')} (Colombia){Colors.END}")
        output.append(f"{Colors.CYAN}Session ID: {self.session_id}{Colors.END}")
        if self.deployment_info:
            output.append(f"{Colors.CYAN}Deployment: {self.deployment_info}{Colors.END}")
        output.append(f"{Colors.BOLD}{'='*50}{Colors.END}")
        
        # Logs de la sesión (filtrar logs vacíos)
        for log in self.logs:
            formatted_log = log.format_colored()
            if formatted_log:  # Solo agregar si no está vacío
                output.append(formatted_log)
        
        # Pie de sesión
        output.append(f"{Colors.BOLD}{'='*50}{Colors.END}")
        output.append(f"{Colors.BOLD}{Colors.RED}=== FIN DE SESIÓN DEL BOT ==={Colors.END}")
        output.append(f"{Colors.CYAN}Timestamp: {(self.end_time or datetime.now() - timedelta(hours=5)).strftime('%Y-%m-%d %H:%M:%S')} (Colombia){Colors.END}")
        output.append(f"{Colors.CYAN}Session ID: {self.session_id}{Colors.END}")
        output.append(f"{Colors.CYAN}Duración: {self.duration()}{Colors.END}")
        output.append(f"{Colors.CYAN}Eventos procesados: {self.messages_processed}{Colors.END}")
        output.append(f"{Colors.CYAN}Usuarios únicos: {len(self.users)}{Colors.END}")
        output.append(f"{Colors.CYAN}Errores: {len(self.errors)}{Colors.END}")
        output.append(f"{Colors.CYAN}Warnings: {len(self.warnings)}{Colors.END}")
        output.append(f"{Colors.BOLD}{'='*50}{Colors.END}")
        
        return '\n'.join(output)

class CloudRunLogParser:
    """Parser principal de logs de Cloud Run"""
    
    def __init__(self):
        self.project_id = "gen-lang-client-0318357688"
        self.service_name = "bot-wsp-whapi-ia"
        self.cache_file = "/tmp/bot_logs_cache.json"
        self.cache_duration = 60  # 1 minuto
    
    def _get_cache_key(self, hours: int, limit: int) -> str:
        """Genera una clave única para el cache"""
        return hashlib.md5(f"{hours}_{limit}_{int(time.time() / self.cache_duration)}".encode()).hexdigest()
    
    def _load_from_cache(self, cache_key: str) -> Optional[List[Dict]]:
        """Carga logs desde cache si existe y es válido"""
        try:
            if os.path.exists(self.cache_file):
                with open(self.cache_file, 'r') as f:
                    cache_data = json.load(f)
                    if cache_data.get('key') == cache_key:
                        print(f"{Colors.YELLOW}📋 Usando logs desde cache...{Colors.END}")
                        return cache_data.get('logs', [])
        except Exception as e:
            print(f"{Colors.RED}Error loading cache: {e}{Colors.END}")
        return None
    
    def _save_to_cache(self, cache_key: str, logs: List[Dict]):
        """Guarda logs en cache"""
        try:
            cache_data = {
                'key': cache_key,
                'timestamp': time.time(),
                'logs': logs
            }
            with open(self.cache_file, 'w') as f:
                json.dump(cache_data, f)
        except Exception as e:
            print(f"{Colors.RED}Error saving cache: {e}{Colors.END}")
    
    def fetch_logs(self, hours: int = 2, limit: int = 5000) -> List[LogEntry]:
        """Obtiene logs de Google Cloud Run - MEJORADO para capturar logs técnicos"""
        cache_key = self._get_cache_key(hours, limit)
        
        # Intentar cargar desde cache
        cached_logs = self._load_from_cache(cache_key)
        if cached_logs:
            return self._parse_raw_logs(cached_logs)
        
        print(f"{Colors.CYAN}🔍 Obteniendo logs de Cloud Run (últimas {hours} horas)...{Colors.END}")
        
        # Calcular timestamp de inicio
        start_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        timestamp_filter = start_time.strftime('%Y-%m-%dT%H:%M:%SZ')
        
        # Comando gcloud - usar ruta completa en Windows
        import platform
        if platform.system() == "Windows":
            gcloud_cmd = r'C:\Users\alex-\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
        else:
            gcloud_cmd = 'gcloud'
        
        # CONSULTA MEJORADA: Obtener TODOS los logs, no solo HTTP
        # Incluir logs de aplicación donde están los patrones técnicos
        filter_query = f'resource.type=cloud_run_revision AND resource.labels.service_name={self.service_name} AND timestamp>="{timestamp_filter}"'
        
        cmd = [
            gcloud_cmd, 'logging', 'read',
            filter_query.strip(),
            '--format=json',
            f'--project={self.project_id}',
            f'--limit={limit}',
            '--order=asc'
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            raw_logs = json.loads(result.stdout)
            
            # Guardar en cache
            self._save_to_cache(cache_key, raw_logs)
            
            print(f"{Colors.GREEN}✅ Obtenidos {len(raw_logs)} logs exitosamente{Colors.END}")
            
            # DIAGNÓSTICO: Mostrar tipos de logs que estamos obteniendo
            log_types = {}
            for log in raw_logs[:10]:  # Analizar primeros 10 logs
                if 'textPayload' in log:
                    log_types['textPayload'] = log_types.get('textPayload', 0) + 1
                elif 'jsonPayload' in log:
                    log_types['jsonPayload'] = log_types.get('jsonPayload', 0) + 1
                elif 'httpRequest' in log:
                    log_types['httpRequest'] = log_types.get('httpRequest', 0) + 1
                else:
                    log_types['other'] = log_types.get('other', 0) + 1
            
            print(f"{Colors.CYAN}📊 Tipos de logs detectados: {log_types}{Colors.END}")
            
            return self._parse_raw_logs(raw_logs)
            
        except subprocess.CalledProcessError as e:
            print(f"{Colors.RED}❌ Error ejecutando gcloud: {e}{Colors.END}")
            print(f"{Colors.RED}Stderr: {e.stderr}{Colors.END}")
            return []
        except json.JSONDecodeError as e:
            print(f"{Colors.RED}❌ Error parsing JSON: {e}{Colors.END}")
            return []
    
    def _parse_raw_logs(self, raw_logs: List[Dict]) -> List[LogEntry]:
        """ETAPA 4: Parsea logs raw de Google Cloud con extracción técnica COMPLETA y AGRESIVA"""
        logs = []
        
        for raw_log in raw_logs:
            try:
                timestamp = raw_log.get('timestamp', '')
                severity = raw_log.get('severity', 'INFO')
                
                # PASO 1: Extraer mensaje básico del log - ACTUALIZADO para formato JSON unificado
                message = ""
                if 'textPayload' in raw_log:
                    message = raw_log['textPayload']
                elif 'jsonPayload' in raw_log:
                    json_payload = raw_log['jsonPayload']
                    
                    # ✨ NUEVO: Soporte para formato JSON unificado (File Logs = Cloud Logs)
                    if 'message' in json_payload:
                        message = json_payload['message']
                        
                        # Agregar información estructurada del formato unificado
                        if 'category' in json_payload:
                            category = json_payload['category']
                            if not message.startswith(f'[{category}]'):
                                message = f'[{category}] {message}'
                        
                        # Agregar detalles técnicos del formato unificado si están disponibles
                        if 'details' in json_payload and json_payload['details']:
                            try:
                                details = json_payload['details']
                                if isinstance(details, dict) and details:
                                    # Extraer información más relevante
                                    relevant_details = {}
                                    for key, value in details.items():
                                        if key in ['userId', 'threadId', 'runId', 'functionName', 'startDate', 'endDate', 
                                                 'duration', 'status', 'error', 'messageCount', 'chunks']:
                                            relevant_details[key] = value
                                    
                                    if relevant_details:
                                        details_str = json.dumps(relevant_details, ensure_ascii=False)
                                        message += f' | {details_str}'
                            except:
                                pass
                    else:
                        message = json.dumps(json_payload, indent=2, ensure_ascii=False)
                else:
                    message = str(raw_log)
                
                # PASO 2: EXTRACCIÓN TÉCNICA AGRESIVA - Buscar TODO lo posible
                technical_logs = self.extract_technical_logs(raw_log)
                
                # PASO 3: EXTRACCIÓN ADICIONAL - Buscar patrones en el mensaje básico también
                additional_tech_info = self.extract_additional_technical_patterns(message, timestamp)
                if additional_tech_info:
                    technical_logs.extend(additional_tech_info)
                
                # PASO 4: Si hay información técnica, crear logs reconstruidos
                if technical_logs:
                    for tech_data in technical_logs:
                        reconstructed_event = self.reconstruct_technical_event(tech_data)
                        if reconstructed_event:
                            # Crear LogEntry para el evento técnico reconstruido
                            tech_log_entry = LogEntry(timestamp, severity, reconstructed_event, raw_log)
                            logs.append(tech_log_entry)
                
                # PASO 5: SIEMPRE crear log básico limpio (mostrar TODO)
                # Limpiar mensaje básico
                if isinstance(message, str):
                    # Restaurar emojis específicos del bot
                    message = message.replace('? Bot completamente inicializado', '🤖 Bot completamente inicializado')
                    message = message.replace('? Servidor escuchando', '🚀 Servidor escuchando')
                    message = message.replace('?? No hay conversación activa', '📱 No hay conversación activa')
                    message = message.replace('? No hay conversación activa', '📱 No hay conversación activa')
                    message = message.replace('? Iniciando recuperación', '🔄 Iniciando recuperación')
                    message = message.replace('? Buscando runs', '🔍 Buscando runs')
                    message = message.replace('? No se encontraron runs', '✅ No se encontraron runs')
                    message = message.replace('? Verificando mensajes', '🔍 Verificando mensajes')
                    message = message.replace('? mensajes pendientes', '📝 mensajes pendientes')
                    message = message.replace('?? Logs enviados', '📤 Logs enviados')
                    
                    # Restaurar caracteres especiales comunes
                    message = message.replace('recuperaci?n', 'recuperación')
                    message = message.replace('hu?rfanos', 'huérfanos')
                    message = message.replace('conversaci?n', 'conversación')
                    message = message.replace('verificaci?n', 'verificación')
                    message = message.replace('funci?n', 'función')
                    message = message.replace('ejecuci?n', 'ejecución')
                    message = message.replace('creaci?n', 'creación')
                    message = message.replace('operaci?n', 'operación')
                    
                    # Limpiar caracteres de interrogación restantes que no sean parte del contenido
                    import re
                    # Solo reemplazar ? al inicio de línea seguido de espacio (emojis mal convertidos)
                    message = re.sub(r'^(\s*)\?\s+', r'\1', message, flags=re.MULTILINE)
                
                log_entry = LogEntry(timestamp, severity, message, raw_log)
                logs.append(log_entry)
                
            except Exception as e:
                print(f"{Colors.RED}Error parsing log entry: {e}{Colors.END}")
                continue
        
        # Ordenar por timestamp
        logs.sort(key=lambda x: x.colombia_time)
        return logs
    
    def extract_additional_technical_patterns(self, message: str, timestamp: str) -> List[Dict]:
        """Extrae patrones técnicos adicionales del mensaje básico"""
        additional_tech = []
        
        if not isinstance(message, str):
            return additional_tech
        
        # BUSCAR TODOS LOS PATRONES POSIBLES EN EL MENSAJE
        
        # 1. THREAD IDs - Buscar cualquier referencia a threads
        thread_patterns = [
            r'thread[_\s]*([a-zA-Z0-9_]{15,})',  # Thread IDs largos
            r'Thread\s+([a-zA-Z0-9_]{15,})',
            r'threadId["\']:\s*["\']([^"\']+)["\']',
            r'thread:\s*([a-zA-Z0-9_]{15,})'
        ]
        
        for pattern in thread_patterns:
            matches = re.findall(pattern, message, re.IGNORECASE)
            for match in matches:
                if len(match) >= 15:  # Solo IDs largos
                    additional_tech.append({
                        'type': 'THREAD_ID_FOUND',
                        'thread_id': match,
                        'timestamp': timestamp,
                        'source': 'message_scan'
                    })
        
        # 2. RUN IDs - Buscar cualquier referencia a runs
        run_patterns = [
            r'run[_\s]*([a-zA-Z0-9_]{15,})',  # Run IDs largos
            r'Run\s+([a-zA-Z0-9_]{15,})',
            r'runId["\']:\s*["\']([^"\']+)["\']',
            r'run:\s*([a-zA-Z0-9_]{15,})'
        ]
        
        for pattern in run_patterns:
            matches = re.findall(pattern, message, re.IGNORECASE)
            for match in matches:
                if len(match) >= 15:  # Solo IDs largos
                    additional_tech.append({
                        'type': 'RUN_ID_FOUND',
                        'run_id': match,
                        'timestamp': timestamp,
                        'source': 'message_scan'
                    })
        
        # 3. OPENAI STATES - Buscar estados específicos
        openai_states = [
            'adding_message', 'creating_run', 'run_started', 'function_calling_start',
            'run_completed', 'response_received', 'token_usage'
        ]
        
        for state in openai_states:
            if state in message.lower():
                # Buscar contexto adicional
                user_match = re.search(r'para\s*(\d+)', message)
                additional_tech.append({
                    'type': 'OPENAI_STATE_DETECTED',
                    'state': state,
                    'user_id': user_match.group(1) if user_match else None,
                    'timestamp': timestamp,
                    'source': 'message_scan',
                    'context': message[:200] + '...' if len(message) > 200 else message
                })
        
        # 4. FUNCTION NAMES - Buscar nombres de funciones
        function_patterns = [
            r'check_availability',
            r'make_booking',
            r'cancel_booking',
            r'get_booking_details',
            r'escalate_to_human'
        ]
        
        for func_pattern in function_patterns:
            if func_pattern in message.lower():
                additional_tech.append({
                    'type': 'FUNCTION_NAME_DETECTED',
                    'function_name': func_pattern,
                    'timestamp': timestamp,
                    'source': 'message_scan',
                    'context': message[:200] + '...' if len(message) > 200 else message
                })
        
        # 5. BEDS24 KEYWORDS - Buscar referencias a Beds24
        beds24_keywords = [
            'beds24', 'disponibilidad', 'availability', 'booking', 'reserva',
            'propiedad', 'property', 'startDate', 'endDate'
        ]
        
        beds24_found = False
        for keyword in beds24_keywords:
            if keyword.lower() in message.lower():
                beds24_found = True
                break
        
        if beds24_found:
            # Buscar fechas si las hay
            date_pattern = r'(\d{4}-\d{2}-\d{2})'
            dates = re.findall(date_pattern, message)
            additional_tech.append({
                'type': 'BEDS24_REFERENCE',
                'dates_found': dates,
                'timestamp': timestamp,
                'source': 'message_scan',
                'context': message[:200] + '...' if len(message) > 200 else message
            })
        
        # 6. ERROR PATTERNS - Buscar cualquier error
        error_keywords = [
            'error', 'timeout', 'failed', 'exception', 'crash',
            'rate limit', 'network', 'validation'
        ]
        
        for error_keyword in error_keywords:
            if error_keyword.lower() in message.lower():
                additional_tech.append({
                    'type': 'ERROR_DETECTED',
                    'error_type': error_keyword,
                    'timestamp': timestamp,
                    'source': 'message_scan',
                    'context': message[:200] + '...' if len(message) > 200 else message
                })
        
        # 7. USER INTERACTIONS - Buscar números de teléfono colombianos
        phone_patterns = [
            r'573\d{9}',  # Formato completo
            r'57\d{10}'   # Formato alternativo
        ]
        
        for pattern in phone_patterns:
            matches = re.findall(pattern, message)
            for match in matches:
                additional_tech.append({
                    'type': 'USER_PHONE_DETECTED',
                    'phone_number': match,
                    'timestamp': timestamp,
                    'source': 'message_scan'
                })
        
        # 8. DURATIONS - Buscar duraciones y tiempos
        duration_patterns = [
            r'(\d+(?:\.\d+)?)\s*s\)',  # Segundos en paréntesis
            r'(\d+(?:\.\d+)?)\s*ms',   # Milisegundos
            r'(\d+(?:\.\d+)?)\s*seconds',
            r'duration["\']:\s*(\d+(?:\.\d+)?)'
        ]
        
        for pattern in duration_patterns:
            matches = re.findall(pattern, message)
            for match in matches:
                additional_tech.append({
                    'type': 'DURATION_DETECTED',
                    'duration': match,
                    'timestamp': timestamp,
                    'source': 'message_scan'
                })
        
        # 9. JSON DATA - Buscar cualquier estructura JSON
        json_pattern = r'\{[^}]*\}'
        json_matches = re.findall(json_pattern, message)
        for json_match in json_matches:
            if len(json_match) > 10:  # Solo JSON significativo
                additional_tech.append({
                    'type': 'JSON_DATA_DETECTED',
                    'json_data': json_match,
                    'timestamp': timestamp,
                    'source': 'message_scan'
                })
        
        return additional_tech
    
    def detect_sessions(self, logs: List[LogEntry]) -> List[BotSession]:
        """Detecta sesiones del bot basado en patrones"""
        sessions = []
        current_session = None
        last_log_time = None
        
        for log in logs:
            # Detectar inicio de nueva sesión
            if (log.is_session_start() or 
                (last_log_time and (log.colombia_time - last_log_time).total_seconds() > 300)):  # 5 minutos
                
                # Finalizar sesión anterior
                if current_session:
                    current_session.finalize(last_log_time if last_log_time else log.colombia_time)
                    sessions.append(current_session)
                
                # Crear nueva sesión
                session_id = f"session-{int(log.colombia_time.timestamp())}"
                current_session = BotSession(session_id, log.colombia_time)
                
                # Extraer info de deployment si está disponible
                if 'resource' in log.raw_data and 'labels' in log.raw_data['resource']:
                    labels = log.raw_data['resource']['labels']
                    if 'revision_name' in labels:
                        current_session.deployment_info = labels['revision_name']
            
            # Añadir log a sesión actual
            if current_session:
                current_session.add_log(log)
            
            last_log_time = log.colombia_time
        
        # Finalizar última sesión
        if current_session:
            final_time = last_log_time if last_log_time else datetime.now() - timedelta(hours=5)
            current_session.finalize(final_time)
            sessions.append(current_session)
        
        return sessions
    
    def filter_sessions(self, sessions: List[BotSession], user_id: str = None, 
                       errors_only: bool = False) -> List[BotSession]:
        """Filtra sesiones según criterios"""
        filtered = sessions
        
        if user_id:
            filtered = [s for s in filtered if user_id in s.users or 
                       any(user_id in log.message for log in s.logs)]
        
        if errors_only:
            filtered = [s for s in filtered if s.errors]
        
        return filtered
    
    def generate_summary(self, sessions: List[BotSession]) -> str:
        """Genera resumen de todas las sesiones"""
        total_sessions = len(sessions)
        sessions_with_errors = len([s for s in sessions if s.errors])
        total_users = len(set().union(*[s.users for s in sessions]))
        total_messages = sum(s.messages_processed for s in sessions)
        total_errors = sum(len(s.errors) for s in sessions)
        
        summary = [
            f"{Colors.BOLD}{Colors.CYAN}=== RESUMEN DE SESIONES ==={Colors.END}",
            f"{Colors.CYAN}Total sesiones: {total_sessions}{Colors.END}",
            f"{Colors.CYAN}Sesiones con errores: {sessions_with_errors}{Colors.END}",
            f"{Colors.CYAN}Usuarios únicos totales: {total_users}{Colors.END}",
            f"{Colors.CYAN}Mensajes procesados: {total_messages}{Colors.END}",
            f"{Colors.CYAN}Total errores: {total_errors}{Colors.END}",
            f"{Colors.BOLD}{'='*50}{Colors.END}"
        ]
        
        return '\n'.join(summary)
    
    def save_to_file(self, content: str) -> str:
        """Guarda contenido a archivo"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"bot_sessions_{timestamp}.txt"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                # Remover colores ANSI para el archivo
                clean_content = re.sub(r'\033\[[0-9;]*m', '', content)
                f.write(clean_content)
            
            print(f"{Colors.GREEN}💾 Logs guardados en: {filename}{Colors.END}")
            return filename
        except Exception as e:
            print(f"{Colors.RED}❌ Error guardando archivo: {e}{Colors.END}")
            return ""
    
    def save_sessions_to_individual_files(self, sessions: List[BotSession], max_files: int = 10) -> List[str]:
        """Guarda cada sesión en archivos separados en la carpeta logsGoogleCloud"""
        saved_files = []
        
        # Crear carpeta logs/cloud-production/processed si no existe
        # Usar ruta absoluta basada en el directorio del script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))
        logs_dir = os.path.join(project_root, "logs", "cloud-production", "processed")
        if not os.path.exists(logs_dir):
            os.makedirs(logs_dir)
        
        # Obtener archivos existentes para evitar duplicados
        existing_sessions = self._get_existing_session_ids(logs_dir)
        
        # Filtrar solo las sesiones nuevas
        new_sessions = [s for s in sessions if s.session_id not in existing_sessions]
        
        if not new_sessions:
            print(f"{Colors.YELLOW}📋 No hay sesiones nuevas para guardar (todas ya existen){Colors.END}")
            return saved_files
        
        print(f"{Colors.CYAN}📝 Detectadas {len(new_sessions)} sesiones nuevas de {len(sessions)} totales{Colors.END}")
        
        # Limpiar archivos antiguos si hay más del máximo configurado
        self._cleanup_old_session_files(logs_dir, max_files)
        
        for session in new_sessions:
            # Formatear timestamp para nombre de archivo
            session_time = session.start_time.strftime('%Y%m%d_%H%M%S')
            session_id_short = session.session_id.replace('session-', '')
            filename = f"session_{session_time}_{session_id_short}.log"
            filepath = os.path.join(logs_dir, filename)
            
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    # Contenido del archivo de sesión individual
                    session_content = []
                    session_content.append("=" * 80)
                    session_content.append(f"SESIÓN DEL BOT - {session.start_time.strftime('%Y-%m-%d %H:%M:%S')} (Colombia)")
                    session_content.append("=" * 80)
                    session_content.append(f"Session ID: {session.session_id}")
                    session_content.append(f"Deployment: {session.deployment_info or 'unknown'}")
                    session_content.append(f"Duración: {session.duration()}")
                    session_content.append(f"Eventos procesados: {session.messages_processed}")
                    session_content.append(f"Usuarios únicos: {len(session.users)}")
                    session_content.append(f"Errores: {len(session.errors)}")
                    session_content.append(f"Warnings: {len(session.warnings)}")
                    session_content.append("=" * 80)
                    session_content.append("")
                    
                    # Logs de la sesión (limpios, sin colores ANSI, filtrar logs vacíos)
                    for log in session.logs:
                        # Saltar logs que deben filtrarse
                        if log.should_filter_out():
                            continue
                            
                        time_str = log.colombia_time.strftime('%Y-%m-%d %H:%M:%S')
                        
                        # Determinar prefijo según tipo de log
                        if log.is_error():
                            prefix = "ERROR"
                        elif log.is_warning():
                            prefix = "WARNING"
                        elif log.is_user_message():
                            prefix = "USER"
                        elif log.is_session_start():
                            prefix = "START"
                        else:
                            prefix = "INFO"
                        
                        # LIMPIAR MENSAJE COMPLETAMENTE
                        message_clean = log.message
                        if isinstance(message_clean, str):
                            # Remover códigos ANSI
                            import re
                            message_clean = re.sub(r'\033\[[0-9;]*m', '', message_clean)
                            message_clean = re.sub(r'\[[\d]+m', '', message_clean)
                            
                            # Limpiar caracteres de interrogación problemáticos (emojis mal convertidos)
                            message_clean = message_clean.replace('? 573003913251:', '573003913251:')
                            message_clean = message_clean.replace('? ? 10s...', '10s...')
                            message_clean = message_clean.replace('? Bot completamente inicializado', 'Bot completamente inicializado')
                            message_clean = message_clean.replace('? Servidor escuchando', 'Servidor escuchando')
                            message_clean = message_clean.replace('?? No hay conversación activa', 'No hay conversación activa')
                            message_clean = message_clean.replace('? No hay conversación activa', 'No hay conversación activa')
                            message_clean = message_clean.replace('? Iniciando recuperación', 'Iniciando recuperación')
                            message_clean = message_clean.replace('? Buscando runs', 'Buscando runs')
                            message_clean = message_clean.replace('? No se encontraron runs', 'No se encontraron runs')
                            message_clean = message_clean.replace('? Verificando mensajes', 'Verificando mensajes')
                            message_clean = message_clean.replace('? mensajes pendientes', 'mensajes pendientes')
                            message_clean = message_clean.replace('?? Logs enviados', 'Logs enviados')
                            
                            # Limpiar emojis mal convertidos en medio de texto
                            message_clean = message_clean.replace('[BOT] ? 2 msgs ?', '[BOT] 2 msgs →')
                            message_clean = message_clean.replace('[BOT] ? 1 msgs ?', '[BOT] 1 msgs →')
                            message_clean = message_clean.replace('[BOT] ? 3 msgs ?', '[BOT] 3 msgs →')
                            message_clean = message_clean.replace('[BOT] ? Completado', '[BOT] Completado')
                            message_clean = message_clean.replace('? Completado', 'Completado')
                            message_clean = message_clean.replace('despu?s', 'después')
                            message_clean = message_clean.replace('p?rrafos', 'párrafos')
                            message_clean = message_clean.replace('p?rrafo', 'párrafo')
                            
                            # Restaurar caracteres especiales
                            message_clean = message_clean.replace('recuperaci?n', 'recuperación')
                            message_clean = message_clean.replace('hu?rfanos', 'huérfanos')
                            message_clean = message_clean.replace('conversaci?n', 'conversación')
                            message_clean = message_clean.replace('verificaci?n', 'verificación')
                            message_clean = message_clean.replace('funci?n', 'función')
                            message_clean = message_clean.replace('ejecuci?n', 'ejecución')
                            message_clean = message_clean.replace('creaci?n', 'creación')
                            message_clean = message_clean.replace('operaci?n', 'operación')
                            message_clean = message_clean.replace('informaci?n', 'información')
                            message_clean = message_clean.replace('descripci?n', 'descripción')
                            message_clean = message_clean.replace('soluci?n', 'solución')
                            message_clean = message_clean.replace('configuraci?n', 'configuración')
                            
                            # Limpiar caracteres de interrogación restantes mal posicionados
                            message_clean = re.sub(r'\?\s*\?\s*', ' → ', message_clean)
                            message_clean = re.sub(r'^(\s*)\?\s+', r'\1', message_clean)
                            message_clean = re.sub(r'\s+\?\s+', ' → ', message_clean)
                            
                            # 🚨 FIX TIMESTAMP DUPLICADO - Eliminar timestamp interno del mensaje
                            # Patrón: [2025-07-11T10:42:45.838Z] [INFO] mensaje
                            message_clean = re.sub(r'^\[20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\s*\[INFO\]\s*', '', message_clean)
                            message_clean = re.sub(r'^\[20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\s*\[SUCCESS\]\s*', '', message_clean)
                            message_clean = re.sub(r'^\[20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\s*\[ERROR\]\s*', '', message_clean)
                            message_clean = re.sub(r'^\[20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\s*\[WARNING\]\s*', '', message_clean)
                            message_clean = re.sub(r'^\[20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\s*\[TECH\]\s*', '', message_clean)
                        
                        # 🚨 FIX TIMESTAMP DUPLICADO - Solo usar timestamp limpio del parser
                        session_content.append(f"[{time_str}] {prefix}: {message_clean}")
                    
                    session_content.append("")
                    session_content.append("=" * 80)
                    session_content.append("FIN DE SESIÓN")
                    session_content.append("=" * 80)
                    
                    # Escribir contenido
                    f.write('\n'.join(session_content))
                
                saved_files.append(filepath)
                print(f"{Colors.CYAN}📁 Sesión guardada: {filename}{Colors.END}")
                
            except Exception as e:
                print(f"{Colors.RED}❌ Error guardando sesión {session.session_id}: {e}{Colors.END}")
        
        if saved_files:
            print(f"{Colors.GREEN}✅ {len(saved_files)} sesiones nuevas guardadas en logsGoogleCloud/{Colors.END}")
        
        return saved_files
    
    def _get_existing_session_ids(self, logs_dir: str) -> set:
        """Obtiene los IDs de sesiones ya guardadas para evitar duplicados"""
        existing_ids = set()
        try:
            for filename in os.listdir(logs_dir):
                if filename.startswith('session_') and filename.endswith('.log'):
                    # Extraer session ID del nombre del archivo
                    # Formato: session_YYYYMMDD_HHMMSS_SessionID.log
                    parts = filename.replace('.log', '').split('_')
                    if len(parts) >= 4:
                        session_id = f"session-{parts[3]}"
                        existing_ids.add(session_id)
        except Exception as e:
            print(f"{Colors.RED}❌ Error leyendo archivos existentes: {e}{Colors.END}")
        
        return existing_ids
    
    def _cleanup_old_session_files(self, logs_dir: str, max_files: int = 10):
        """Elimina archivos de sesión antiguos manteniendo solo los más recientes"""
        try:
            # Obtener todos los archivos de sesión
            session_files = []
            for filename in os.listdir(logs_dir):
                if filename.startswith('session_') and filename.endswith('.log'):
                    filepath = os.path.join(logs_dir, filename)
                    # Obtener tiempo de modificación
                    mtime = os.path.getmtime(filepath)
                    session_files.append((filepath, mtime, filename))
            
            # Si hay más de max_files, eliminar los más antiguos
            if len(session_files) > max_files:
                # Ordenar por tiempo de modificación (más reciente primero)
                session_files.sort(key=lambda x: x[1], reverse=True)
                
                # Mantener solo los max_files más recientes
                files_to_keep = session_files[:max_files]
                files_to_delete = session_files[max_files:]
                
                # Eliminar archivos antiguos
                for filepath, _, filename in files_to_delete:
                    try:
                        os.remove(filepath)
                        print(f"{Colors.YELLOW}🗑️ Eliminado archivo antiguo: {filename}{Colors.END}")
                    except Exception as e:
                        print(f"{Colors.RED}❌ Error eliminando {filename}: {e}{Colors.END}")
                
                if files_to_delete:
                    print(f"{Colors.YELLOW}🧹 Limpieza automática: {len(files_to_delete)} archivos eliminados, {len(files_to_keep)} conservados{Colors.END}")
        
        except Exception as e:
            print(f"{Colors.RED}❌ Error en limpieza automática: {e}{Colors.END}")
    
    def extract_technical_logs(self, log_entry):
        """ETAPA 2: Extrae información técnica de diferentes formatos de Cloud Run"""
        technical_info = []
        
        # Buscar en diferentes ubicaciones posibles del log
        locations = [
            log_entry.get('textPayload', ''),
            log_entry.get('jsonPayload', {}).get('message', ''),
            log_entry.get('jsonPayload', {}).get('data', ''),
            log_entry.get('jsonPayload', {}).get('details', ''),
            str(log_entry.get('jsonPayload', {}))
        ]
        
        for location in locations:
            if not isinstance(location, str):
                continue
                
            # FUNCTION CALLING - Buscar patrones completos
            if 'FUNCTION_CALLING_START' in location:
                # Buscar función y argumentos
                func_match = re.search(r'OpenAI requiere ejecutar (\d+) función.*?"([^"]+)"', location)
                args_match = re.search(r'"args":\s*(\{[^}]*\}|\{[^}]*\{[^}]*\}[^}]*\})', location)
                if func_match:
                    technical_info.append({
                        'type': 'FUNCTION_CALLING_START',
                        'function_count': func_match.group(1),
                        'function_name': func_match.group(2) if len(func_match.groups()) > 1 else 'unknown',
                        'arguments': args_match.group(1) if args_match else None,
                        'timestamp': log_entry.get('timestamp', ''),
                        'raw_location': location[:200] + '...'
                    })
            
            if 'FUNCTION_EXECUTING' in location or 'FUNCTION_HANDLER' in location:
                # Buscar función ejecutándose
                func_match = re.search(r'Ejecutando función[:\s]*([a-zA-Z_][a-zA-Z0-9_]*)', location)
                args_match = re.search(r'Argumentos:\s*(\{.*?\})', location)
                if func_match:
                    technical_info.append({
                        'type': 'FUNCTION_EXECUTING',
                        'function_name': func_match.group(1),
                        'arguments': args_match.group(1) if args_match else None,
                        'timestamp': log_entry.get('timestamp', ''),
                        'raw_location': location[:200] + '...'
                    })
            
            if 'FUNCTION_EXECUTED' in location:
                # Buscar función completada
                func_match = re.search(r'función\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*ejecutada exitosamente', location)
                if func_match:
                    technical_info.append({
                        'type': 'FUNCTION_EXECUTED',
                        'function_name': func_match.group(1),
                        'timestamp': log_entry.get('timestamp', ''),
                        'raw_location': location[:200] + '...'
                    })
            
            # BEDS24 - Buscar respuestas completas
            if 'BEDS24_RESPONSE_DETAIL' in location:
                response_match = re.search(r'fullResponse["\']:\s*["\']([^"\']+)["\']', location)
                if response_match:
                    technical_info.append({
                        'type': 'BEDS24_RESPONSE_DETAIL',
                        'full_response': response_match.group(1),
                        'timestamp': log_entry.get('timestamp', ''),
                        'raw_location': location[:200] + '...'
                    })
            
            if 'BEDS24_REQUEST' in location:
                # Buscar parámetros de consulta
                dates_match = re.search(r'startDate["\']:\s*["\']([^"\']+)["\'].*?endDate["\']:\s*["\']([^"\']+)["\']', location)
                if dates_match:
                    technical_info.append({
                        'type': 'BEDS24_REQUEST',
                        'start_date': dates_match.group(1),
                        'end_date': dates_match.group(2),
                        'timestamp': log_entry.get('timestamp', ''),
                        'raw_location': location[:200] + '...'
                    })
            
            # OPENAI - Buscar estados detallados
            if 'OPENAI_REQUEST' in location:
                # Buscar diferentes estados
                if 'adding_message' in location:
                    user_match = re.search(r'adding_message para\s*(\d+)', location)
                    if user_match:
                        technical_info.append({
                            'type': 'OPENAI_REQUEST',
                            'state': 'adding_message',
                            'user_id': user_match.group(1),
                            'timestamp': log_entry.get('timestamp', ''),
                            'raw_location': location[:200] + '...'
                        })
                
                elif 'creating_run' in location:
                    user_match = re.search(r'creating_run para\s*(\d+)', location)
                    if user_match:
                        technical_info.append({
                            'type': 'OPENAI_REQUEST',
                            'state': 'creating_run',
                            'user_id': user_match.group(1),
                            'timestamp': log_entry.get('timestamp', ''),
                            'raw_location': location[:200] + '...'
                        })
                
                elif 'run_started' in location:
                    user_match = re.search(r'run_started para\s*(\d+)', location)
                    if user_match:
                        technical_info.append({
                            'type': 'OPENAI_REQUEST',
                            'state': 'run_started',
                            'user_id': user_match.group(1),
                            'timestamp': log_entry.get('timestamp', ''),
                            'raw_location': location[:200] + '...'
                        })
            
            if 'OPENAI_RUN_COMPLETED' in location:
                # Buscar run completado con duración
                run_match = re.search(r'Run completado.*?threadId["\']:\s*["\']([^"\']+)["\'].*?duration["\']:\s*(\d+)', location)
                if run_match:
                    technical_info.append({
                        'type': 'OPENAI_RUN_COMPLETED',
                        'thread_id': run_match.group(1),
                        'duration': run_match.group(2),
                        'timestamp': log_entry.get('timestamp', ''),
                        'raw_location': location[:200] + '...'
                    })
            
            # THREADS - Buscar operaciones de thread
            if 'thread_' in location.lower():
                thread_match = re.search(r'thread[_\s]*([a-zA-Z0-9_]+)', location, re.IGNORECASE)
                if thread_match:
                    # Determinar operación
                    operation = 'unknown'
                    if 'encontrado' in location.lower():
                        operation = 'found'
                    elif 'creado' in location.lower():
                        operation = 'created'
                    elif 'reutilizado' in location.lower():
                        operation = 'reused'
                    
                    technical_info.append({
                        'type': 'THREAD_OPERATION',
                        'thread_id': thread_match.group(1),
                        'operation': operation,
                        'timestamp': log_entry.get('timestamp', ''),
                        'raw_location': location[:200] + '...'
                    })
            
            # RUNS - Buscar IDs de run
            if 'run_' in location.lower():
                run_match = re.search(r'run[_\s]*([a-zA-Z0-9_]+)', location, re.IGNORECASE)
                if run_match and len(run_match.group(1)) > 10:  # Solo IDs largos
                    technical_info.append({
                        'type': 'RUN_ID',
                        'run_id': run_match.group(1),
                        'timestamp': log_entry.get('timestamp', ''),
                        'raw_location': location[:200] + '...'
                    })
        
        return technical_info
    
    def reconstruct_technical_event(self, technical_data):
        """ETAPA 3: Reconstruye un evento técnico en formato idéntico a logs locales"""
        
        if not technical_data:
            return None
            
        # Extraer timestamp y convertir a formato local
        timestamp = technical_data.get('timestamp', '')
        if timestamp:
            try:
                # Convertir timestamp de Cloud Run a formato local
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                # Convertir a hora de Colombia (UTC-5)
                colombia_time = dt.replace(tzinfo=timezone.utc) - timedelta(hours=5)
                timestamp_str = colombia_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
            except:
                timestamp_str = timestamp
        else:
            timestamp_str = datetime.now().strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        
        event_type = technical_data.get('type', 'UNKNOWN')
        
        # FUNCTION CALLING - Reconstruir en formato local
        if event_type == 'FUNCTION_CALLING_START':
            function_name = technical_data.get('function_name', 'unknown')
            function_count = technical_data.get('function_count', '1')
            arguments = technical_data.get('arguments', '{}')
            
            return f"[{timestamp_str}] [INFO] FUNCTION_CALLING_START [app-unified.ts]: OpenAI requiere ejecutar {function_count} función(es) | {{\"functions\":[{{\"name\":\"{function_name}\",\"args\":{arguments}}}]}}"
        
        elif event_type == 'FUNCTION_EXECUTING':
            function_name = technical_data.get('function_name', 'unknown')
            arguments = technical_data.get('arguments', '{}')
            
            return f"[{timestamp_str}] [INFO] FUNCTION_HANDLER [index.ts]: Ejecutando función: {function_name}\n[{timestamp_str}] [INFO] FUNCTION_HANDLER [index.ts]: Argumentos: {arguments}"
        
        elif event_type == 'FUNCTION_EXECUTED':
            function_name = technical_data.get('function_name', 'unknown')
            
            return f"[{timestamp_str}] [SUCCESS] FUNCTION_EXECUTED [app-unified.ts]: Función {function_name} ejecutada exitosamente"
        
        # BEDS24 - Reconstruir en formato local
        elif event_type == 'BEDS24_REQUEST':
            start_date = technical_data.get('start_date', 'unknown')
            end_date = technical_data.get('end_date', 'unknown')
            
            return f"[{timestamp_str}] [INFO] BEDS24_REQUEST [beds24-availability.ts]: Procesando consulta de disponibilidad | {{\"startDate\":\"{start_date}\",\"endDate\":\"{end_date}\"}}"
        
        elif event_type == 'BEDS24_RESPONSE_DETAIL':
            full_response = technical_data.get('full_response', '')
            response_length = len(full_response)
            
            return f"[{timestamp_str}] [INFO] BEDS24_RESPONSE_DETAIL [beds24-availability.ts]: Respuesta completa de Beds24 enviada a OpenAI | {{\"responseLength\":{response_length},\"fullResponse\":\"{full_response[:100]}...\"}}"
        
        # OPENAI - Reconstruir en formato local
        elif event_type == 'OPENAI_REQUEST':
            state = technical_data.get('state', 'unknown')
            user_id = technical_data.get('user_id', 'unknown')
            
            return f"[{timestamp_str}] [INFO] OPENAI_REQUEST [app-unified.ts]: {state} para {user_id}"
        
        elif event_type == 'OPENAI_RUN_COMPLETED':
            thread_id = technical_data.get('thread_id', 'unknown')
            duration = technical_data.get('duration', '0')
            
            return f"[{timestamp_str}] [SUCCESS] OPENAI_RUN_COMPLETED [app-unified.ts]: Run completado | {{\"threadId\":\"{thread_id}\",\"duration\":{duration}}}"
        
        # THREADS - Reconstruir en formato local
        elif event_type == 'THREAD_OPERATION':
            thread_id = technical_data.get('thread_id', 'unknown')
            operation = technical_data.get('operation', 'unknown')
            
            if operation == 'found':
                return f"[{timestamp_str}] [INFO] THREAD_GET [app-unified.ts]: Thread encontrado: {thread_id}"
            elif operation == 'created':
                return f"[{timestamp_str}] [SUCCESS] THREAD_CREATE [app-unified.ts]: Thread creado: {thread_id}"
            elif operation == 'reused':
                return f"[{timestamp_str}] [SUCCESS] THREAD_REUSE [app-unified.ts]: Reutilizando thread existente: {thread_id}"
            else:
                return f"[{timestamp_str}] [INFO] THREAD_OPERATION [app-unified.ts]: {operation} | {{\"threadId\":\"{thread_id}\"}}"
        
        # RUN IDs - Reconstruir en formato local
        elif event_type == 'RUN_ID':
            run_id = technical_data.get('run_id', 'unknown')
            
            return f"[{timestamp_str}] [INFO] RUN_DEBUG [app-unified.ts]: Run ID detectado: {run_id}"
        
        # NUEVOS TIPOS DE INFORMACIÓN TÉCNICA DETECTADOS
        elif event_type == 'THREAD_ID_FOUND':
            thread_id = technical_data.get('thread_id', 'unknown')
            return f"[{timestamp_str}] [TECH] THREAD_ID_DETECTED [cloud-parser]: Thread ID encontrado: {thread_id}"
        
        elif event_type == 'RUN_ID_FOUND':
            run_id = technical_data.get('run_id', 'unknown')
            return f"[{timestamp_str}] [TECH] RUN_ID_DETECTED [cloud-parser]: Run ID encontrado: {run_id}"
        
        elif event_type == 'OPENAI_STATE_DETECTED':
            state = technical_data.get('state', 'unknown')
            user_id = technical_data.get('user_id', 'unknown')
            context = technical_data.get('context', '')
            
            if user_id and user_id != 'unknown':
                return f"[{timestamp_str}] [TECH] OPENAI_STATE [cloud-parser]: Estado '{state}' detectado para usuario {user_id}"
            else:
                return f"[{timestamp_str}] [TECH] OPENAI_STATE [cloud-parser]: Estado '{state}' detectado | Context: {context[:100]}..."
        
        elif event_type == 'FUNCTION_NAME_DETECTED':
            function_name = technical_data.get('function_name', 'unknown')
            context = technical_data.get('context', '')
            
            return f"[{timestamp_str}] [TECH] FUNCTION_DETECTED [cloud-parser]: Función '{function_name}' mencionada | Context: {context[:100]}..."
        
        elif event_type == 'BEDS24_REFERENCE':
            dates = technical_data.get('dates_found', [])
            context = technical_data.get('context', '')
            
            if dates:
                return f"[{timestamp_str}] [TECH] BEDS24_DETECTED [cloud-parser]: Referencia a Beds24 con fechas {dates} | Context: {context[:100]}..."
            else:
                return f"[{timestamp_str}] [TECH] BEDS24_DETECTED [cloud-parser]: Referencia a Beds24 | Context: {context[:100]}..."
        
        elif event_type == 'ERROR_DETECTED':
            error_type = technical_data.get('error_type', 'unknown')
            context = technical_data.get('context', '')
            
            return f"[{timestamp_str}] [TECH] ERROR_DETECTED [cloud-parser]: Error tipo '{error_type}' | Context: {context[:100]}..."
        
        elif event_type == 'USER_PHONE_DETECTED':
            phone_number = technical_data.get('phone_number', 'unknown')
            
            return f"[{timestamp_str}] [TECH] USER_DETECTED [cloud-parser]: Número de usuario detectado: {phone_number}"
        
        elif event_type == 'DURATION_DETECTED':
            duration = technical_data.get('duration', 'unknown')
            
            return f"[{timestamp_str}] [TECH] DURATION_DETECTED [cloud-parser]: Duración detectada: {duration}"
        
        elif event_type == 'JSON_DATA_DETECTED':
            json_data = technical_data.get('json_data', '{}')
            
            return f"[{timestamp_str}] [TECH] JSON_DATA [cloud-parser]: Datos JSON detectados: {json_data}"
        
        # Evento desconocido
        else:
            return f"[{timestamp_str}] [INFO] TECHNICAL_EVENT [cloud-parser]: {event_type} | {technical_data}"
    
    def validate_extraction(self, sessions: List[BotSession]) -> Dict[str, Any]:
        """ETAPA 5: Valida que estamos extrayendo toda la información técnica - VERSIÓN MEJORADA"""
        
        print(f"{Colors.CYAN}=== VALIDANDO EXTRACCIÓN DE INFORMACIÓN TÉCNICA COMPLETA ==={Colors.END}")
        
        # Patrones requeridos que deben aparecer en logs técnicos - AMPLIADO
        required_patterns = {
            # Patrones originales
            'FUNCTION_CALLING_START': 0,
            'FUNCTION_EXECUTING': 0,
            'FUNCTION_EXECUTED': 0,
            'BEDS24_REQUEST': 0,
            'BEDS24_RESPONSE_DETAIL': 0,
            'OPENAI_REQUEST': 0,
            'OPENAI_RUN_COMPLETED': 0,
            'THREAD_OPERATION': 0,
            'RUN_ID': 0,
            # Nuevos patrones técnicos detectados
            'THREAD_ID_DETECTED': 0,
            'RUN_ID_DETECTED': 0,
            'OPENAI_STATE': 0,
            'FUNCTION_DETECTED': 0,
            'BEDS24_DETECTED': 0,
            'ERROR_DETECTED': 0,
            'USER_DETECTED': 0,
            'DURATION_DETECTED': 0,
            'JSON_DATA': 0
        }
        
        # Estadísticas de extracción
        extraction_stats = {
            'total_logs': 0,
            'technical_logs': 0,
            'sessions_analyzed': len(sessions),
            'patterns_found': {},
            'missing_patterns': [],
            'extraction_rate': 0.0,
            'new_patterns_found': 0,
            'original_patterns_found': 0
        }
        
        # Analizar cada sesión
        for session in sessions:
            for log in session.logs:
                extraction_stats['total_logs'] += 1
                
                # Verificar si contiene información técnica
                is_technical = False
                
                for pattern in required_patterns.keys():
                    if pattern in log.message:
                        required_patterns[pattern] += 1
                        is_technical = True
                        
                        if pattern not in extraction_stats['patterns_found']:
                            extraction_stats['patterns_found'][pattern] = 0
                        extraction_stats['patterns_found'][pattern] += 1
                        
                        # Contar patrones nuevos vs originales
                        if pattern in ['THREAD_ID_DETECTED', 'RUN_ID_DETECTED', 'OPENAI_STATE', 
                                     'FUNCTION_DETECTED', 'BEDS24_DETECTED', 'ERROR_DETECTED', 
                                     'USER_DETECTED', 'DURATION_DETECTED', 'JSON_DATA']:
                            extraction_stats['new_patterns_found'] += 1
                        else:
                            extraction_stats['original_patterns_found'] += 1
                
                if is_technical:
                    extraction_stats['technical_logs'] += 1
        
        # Calcular tasa de extracción
        if extraction_stats['total_logs'] > 0:
            extraction_stats['extraction_rate'] = (extraction_stats['technical_logs'] / extraction_stats['total_logs']) * 100
        
        # Identificar patrones faltantes
        for pattern, count in required_patterns.items():
            if count == 0:
                extraction_stats['missing_patterns'].append(pattern)
        
        # Mostrar resultados
        print(f"\n{Colors.BOLD}=== ESTADÍSTICAS DE EXTRACCIÓN TÉCNICA COMPLETA ==={Colors.END}")
        print(f"Total logs analizados: {extraction_stats['total_logs']}")
        print(f"Logs técnicos encontrados: {extraction_stats['technical_logs']}")
        print(f"Tasa de extracción técnica: {extraction_stats['extraction_rate']:.1f}%")
        print(f"Sesiones analizadas: {extraction_stats['sessions_analyzed']}")
        print(f"Patrones nuevos encontrados: {extraction_stats['new_patterns_found']}")
        print(f"Patrones originales encontrados: {extraction_stats['original_patterns_found']}")
        
        print(f"\n{Colors.BOLD}=== PATRONES TÉCNICOS ENCONTRADOS ==={Colors.END}")
        
        # Separar patrones originales y nuevos
        original_patterns = ['FUNCTION_CALLING_START', 'FUNCTION_EXECUTING', 'FUNCTION_EXECUTED', 
                           'BEDS24_REQUEST', 'BEDS24_RESPONSE_DETAIL', 'OPENAI_REQUEST', 
                           'OPENAI_RUN_COMPLETED', 'THREAD_OPERATION', 'RUN_ID']
        
        new_patterns = ['THREAD_ID_DETECTED', 'RUN_ID_DETECTED', 'OPENAI_STATE', 
                       'FUNCTION_DETECTED', 'BEDS24_DETECTED', 'ERROR_DETECTED', 
                       'USER_DETECTED', 'DURATION_DETECTED', 'JSON_DATA']
        
        print(f"\n{Colors.BOLD}📋 PATRONES TÉCNICOS ORIGINALES:{Colors.END}")
        for pattern in original_patterns:
            count = extraction_stats['patterns_found'].get(pattern, 0)
            status = f"{Colors.GREEN}✅" if count > 0 else f"{Colors.RED}❌"
            print(f"{status} {pattern}: {count} ocurrencias{Colors.END}")
        
        print(f"\n{Colors.BOLD}🔍 PATRONES TÉCNICOS NUEVOS (SCANNER AGRESIVO):{Colors.END}")
        for pattern in new_patterns:
            count = extraction_stats['patterns_found'].get(pattern, 0)
            status = f"{Colors.GREEN}✅" if count > 0 else f"{Colors.YELLOW}⚠️"
            print(f"{status} {pattern}: {count} ocurrencias{Colors.END}")
        
        if extraction_stats['missing_patterns']:
            print(f"\n{Colors.BOLD}{Colors.RED}=== PATRONES FALTANTES ==={Colors.END}")
            for pattern in extraction_stats['missing_patterns']:
                print(f"{Colors.RED}❌ {pattern}: No encontrado{Colors.END}")
            
            print(f"\n{Colors.YELLOW}⚠️ RECOMENDACIONES:{Colors.END}")
            print(f"{Colors.YELLOW}1. Verificar que los patrones de búsqueda sean correctos{Colors.END}")
            print(f"{Colors.YELLOW}2. Revisar si los logs contienen esta información en diferente formato{Colors.END}")
            print(f"{Colors.YELLOW}3. Ajustar los extractores para capturar estos patrones{Colors.END}")
        else:
            print(f"\n{Colors.GREEN}✅ TODOS LOS PATRONES TÉCNICOS ENCONTRADOS{Colors.END}")
        
        # Validación específica por tipo de patrón
        validation_details = {}
        
        # Validar flujo de Function Calling
        if extraction_stats['patterns_found'].get('FUNCTION_CALLING_START', 0) > 0 or extraction_stats['patterns_found'].get('FUNCTION_DETECTED', 0) > 0:
            func_start = extraction_stats['patterns_found'].get('FUNCTION_CALLING_START', 0)
            func_exec = extraction_stats['patterns_found'].get('FUNCTION_EXECUTING', 0)
            func_end = extraction_stats['patterns_found'].get('FUNCTION_EXECUTED', 0)
            func_detected = extraction_stats['patterns_found'].get('FUNCTION_DETECTED', 0)
            
            validation_details['function_calling_flow'] = {
                'start': func_start,
                'executing': func_exec,
                'completed': func_end,
                'detected': func_detected,
                'complete_flow': func_start > 0 and func_exec > 0 and func_end > 0,
                'any_function_activity': func_start > 0 or func_exec > 0 or func_end > 0 or func_detected > 0
            }
        
        # Validar flujo de Beds24
        if extraction_stats['patterns_found'].get('BEDS24_REQUEST', 0) > 0 or extraction_stats['patterns_found'].get('BEDS24_DETECTED', 0) > 0:
            beds24_req = extraction_stats['patterns_found'].get('BEDS24_REQUEST', 0)
            beds24_resp = extraction_stats['patterns_found'].get('BEDS24_RESPONSE_DETAIL', 0)
            beds24_detected = extraction_stats['patterns_found'].get('BEDS24_DETECTED', 0)
            
            validation_details['beds24_flow'] = {
                'requests': beds24_req,
                'responses': beds24_resp,
                'detected': beds24_detected,
                'complete_flow': beds24_req > 0 and beds24_resp > 0,
                'any_beds24_activity': beds24_req > 0 or beds24_resp > 0 or beds24_detected > 0
            }
        
        # Validar flujo de OpenAI
        if extraction_stats['patterns_found'].get('OPENAI_REQUEST', 0) > 0 or extraction_stats['patterns_found'].get('OPENAI_STATE', 0) > 0:
            openai_req = extraction_stats['patterns_found'].get('OPENAI_REQUEST', 0)
            openai_comp = extraction_stats['patterns_found'].get('OPENAI_RUN_COMPLETED', 0)
            openai_state = extraction_stats['patterns_found'].get('OPENAI_STATE', 0)
            
            validation_details['openai_flow'] = {
                'requests': openai_req,
                'completions': openai_comp,
                'states_detected': openai_state,
                'complete_flow': openai_req > 0 and openai_comp > 0,
                'any_openai_activity': openai_req > 0 or openai_comp > 0 or openai_state > 0
            }
        
        # Validar detección de IDs técnicos
        thread_ids = extraction_stats['patterns_found'].get('THREAD_ID_DETECTED', 0)
        run_ids = extraction_stats['patterns_found'].get('RUN_ID_DETECTED', 0)
        
        if thread_ids > 0 or run_ids > 0:
            validation_details['technical_ids'] = {
                'thread_ids': thread_ids,
                'run_ids': run_ids,
                'has_technical_ids': thread_ids > 0 or run_ids > 0
            }
        
        # Validar detección de usuarios y errores
        users = extraction_stats['patterns_found'].get('USER_DETECTED', 0)
        errors = extraction_stats['patterns_found'].get('ERROR_DETECTED', 0)
        durations = extraction_stats['patterns_found'].get('DURATION_DETECTED', 0)
        
        if users > 0 or errors > 0 or durations > 0:
            validation_details['operational_data'] = {
                'users': users,
                'errors': errors,
                'durations': durations,
                'has_operational_data': users > 0 or errors > 0 or durations > 0
            }
        
        extraction_stats['validation_details'] = validation_details
        
        print(f"\n{Colors.BOLD}=== VALIDACIÓN DE FLUJOS TÉCNICOS ==={Colors.END}")
        for flow_name, flow_data in validation_details.items():
            if flow_name == 'function_calling_flow':
                status = f"{Colors.GREEN}✅" if flow_data.get('any_function_activity', False) else f"{Colors.RED}❌"
                print(f"{status} Function Calling: {'Actividad detectada' if flow_data.get('any_function_activity', False) else 'Sin actividad'}{Colors.END}")
            
            elif flow_name == 'beds24_flow':
                status = f"{Colors.GREEN}✅" if flow_data.get('any_beds24_activity', False) else f"{Colors.RED}❌"
                print(f"{status} Beds24: {'Actividad detectada' if flow_data.get('any_beds24_activity', False) else 'Sin actividad'}{Colors.END}")
            
            elif flow_name == 'openai_flow':
                status = f"{Colors.GREEN}✅" if flow_data.get('any_openai_activity', False) else f"{Colors.RED}❌"
                print(f"{status} OpenAI: {'Actividad detectada' if flow_data.get('any_openai_activity', False) else 'Sin actividad'}{Colors.END}")
            
            elif flow_name == 'technical_ids':
                status = f"{Colors.GREEN}✅" if flow_data.get('has_technical_ids', False) else f"{Colors.RED}❌"
                print(f"{status} IDs Técnicos: {'Detectados' if flow_data.get('has_technical_ids', False) else 'No detectados'}{Colors.END}")
            
            elif flow_name == 'operational_data':
                status = f"{Colors.GREEN}✅" if flow_data.get('has_operational_data', False) else f"{Colors.RED}❌"
                print(f"{status} Datos Operacionales: {'Detectados' if flow_data.get('has_operational_data', False) else 'No detectados'}{Colors.END}")
        
        # Mostrar resumen final
        total_patterns_found = len(extraction_stats['patterns_found'])
        total_patterns_possible = len(required_patterns)
        coverage_percentage = (total_patterns_found / total_patterns_possible) * 100 if total_patterns_possible > 0 else 0
        
        print(f"\n{Colors.BOLD}=== RESUMEN FINAL ==={Colors.END}")
        print(f"Cobertura de patrones: {coverage_percentage:.1f}% ({total_patterns_found}/{total_patterns_possible})")
        
        if extraction_stats['technical_logs'] > 0:
            print(f"{Colors.GREEN}✅ EXTRACCIÓN TÉCNICA ACTIVA - {extraction_stats['technical_logs']} logs técnicos encontrados{Colors.END}")
        else:
            print(f"{Colors.YELLOW}⚠️ NO SE ENCONTRARON LOGS TÉCNICOS - Revisar si las sesiones contienen actividad técnica{Colors.END}")
        
        return extraction_stats
    
    def copy_to_clipboard(self, content: str):
        """Copia contenido al portapapeles"""
        try:
            # Remover colores ANSI para el portapapeles
            clean_content = re.sub(r'\033\[[0-9;]*m', '', content)
            pyperclip.copy(clean_content)
            print(f"{Colors.GREEN}📋 Contenido copiado al portapapeles{Colors.END}")
        except Exception as e:
            print(f"{Colors.RED}❌ Error copiando al portapapeles: {e}{Colors.END}")
    
    def analyze_raw_logs(self, hours: int = 1, limit: int = 100):
        """DEBUGGING TEMPORAL: Analiza logs crudos para encontrar patrones técnicos ocultos - MEJORADO"""
        print(f"{Colors.CYAN}=== ANALIZANDO LOGS CRUDOS DE CLOUD RUN ==={Colors.END}")
        print(f"{Colors.CYAN}Buscando patrones técnicos en últimas {hours} horas...{Colors.END}")
        
        # Obtener logs crudos sin filtrar
        start_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        timestamp_filter = start_time.strftime('%Y-%m-%dT%H:%M:%SZ')
        
        import platform
        if platform.system() == "Windows":
            gcloud_cmd = r'C:\Users\alex-\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
        else:
            gcloud_cmd = 'gcloud'
        
        # CONSULTA MEJORADA: Buscar específicamente logs de aplicación
        filter_query = f'resource.type=cloud_run_revision AND resource.labels.service_name={self.service_name} AND timestamp>="{timestamp_filter}" AND (textPayload!="" OR jsonPayload.message!="")'
        
        cmd = [
            gcloud_cmd, 'logging', 'read',
            filter_query.strip(),
            '--format=json',
            f'--project={self.project_id}',
            f'--limit={limit}',
            '--order=asc'
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            raw_logs = json.loads(result.stdout)
            print(f"{Colors.GREEN}✅ Obtenidos {len(raw_logs)} logs crudos{Colors.END}")
            
            # Patrones técnicos específicos que buscamos
            technical_patterns = [
                'FUNCTION_CALLING_START',
                'FUNCTION_EXECUTING', 
                'FUNCTION_HANDLER',
                'FUNCTION_EXECUTED',
                'BEDS24_REQUEST',
                'BEDS24_RESPONSE_DETAIL',
                'BEDS24_API_CALL',
                'OPENAI_REQUEST',
                'OPENAI_RUN_COMPLETED',
                'adding_message',
                'creating_run',
                'run_started',
                'thread_',
                'run_',
                'check_availability',
                'make_booking',
                'escalate_to_human',
                'fullResponse',
                'args',
                'arguments',
                'textPayload',
                'jsonPayload'
            ]
            
            found_patterns = {}
            log_structure_analysis = {
                'textPayload_logs': 0,
                'jsonPayload_logs': 0,
                'httpRequest_only': 0,
                'empty_logs': 0,
                'useful_content': 0
            }
            
            for i, log in enumerate(raw_logs):
                log_str = json.dumps(log, ensure_ascii=False)
                
                # Analizar estructura del log
                if 'textPayload' in log and log['textPayload'].strip():
                    log_structure_analysis['textPayload_logs'] += 1
                    log_structure_analysis['useful_content'] += 1
                elif 'jsonPayload' in log and log['jsonPayload'].get('message', '').strip():
                    log_structure_analysis['jsonPayload_logs'] += 1
                    log_structure_analysis['useful_content'] += 1
                elif 'httpRequest' in log:
                    log_structure_analysis['httpRequest_only'] += 1
                else:
                    log_structure_analysis['empty_logs'] += 1
                
                # Buscar patrones técnicos
                for pattern in technical_patterns:
                    if pattern.lower() in log_str.lower():
                        if pattern not in found_patterns:
                            found_patterns[pattern] = []
                        
                        # Extraer contenido útil del log
                        useful_content = ""
                        if 'textPayload' in log:
                            useful_content = log['textPayload'][:500]
                        elif 'jsonPayload' in log and 'message' in log['jsonPayload']:
                            useful_content = log['jsonPayload']['message'][:500]
                        else:
                            useful_content = log_str[:500]
                        
                        # Guardar información del log que contiene el patrón
                        found_patterns[pattern].append({
                            'index': i,
                            'timestamp': log.get('timestamp', 'unknown'),
                            'severity': log.get('severity', 'unknown'),
                            'useful_content': useful_content,
                            'log_type': 'textPayload' if 'textPayload' in log else 'jsonPayload' if 'jsonPayload' in log else 'other'
                        })
            
            # Mostrar análisis de estructura
            print(f"\n{Colors.BOLD}=== ANÁLISIS DE ESTRUCTURA DE LOGS ==={Colors.END}")
            print(f"📄 Logs con textPayload: {log_structure_analysis['textPayload_logs']}")
            print(f"📦 Logs con jsonPayload: {log_structure_analysis['jsonPayload_logs']}")
            print(f"🌐 Logs solo HTTP: {log_structure_analysis['httpRequest_only']}")
            print(f"❌ Logs vacíos: {log_structure_analysis['empty_logs']}")
            print(f"✅ Logs con contenido útil: {log_structure_analysis['useful_content']}")
            
            # Mostrar resultados de patrones técnicos
            print(f"\n{Colors.BOLD}=== PATRONES TÉCNICOS ENCONTRADOS ==={Colors.END}")
            
            if found_patterns:
                for pattern, occurrences in found_patterns.items():
                    print(f"\n{Colors.YELLOW}🔍 {pattern}: {len(occurrences)} ocurrencias{Colors.END}")
                    for i, occurrence in enumerate(occurrences[:2]):  # Mostrar solo 2 ejemplos
                        print(f"  {Colors.GRAY}Ejemplo {i+1}: {occurrence['timestamp']} ({occurrence['log_type']}){Colors.END}")
                        print(f"  {Colors.GRAY}Contenido: {occurrence['useful_content'][:200]}...{Colors.END}")
            else:
                print(f"{Colors.RED}❌ NO SE ENCONTRARON PATRONES TÉCNICOS{Colors.END}")
                print(f"{Colors.YELLOW}⚠️ Esto significa que los logs técnicos del bot no están llegando a Cloud Logging{Colors.END}")
                print(f"{Colors.YELLOW}⚠️ Posibles causas:{Colors.END}")
                print(f"{Colors.YELLOW}   1. El bot no está generando logs técnicos{Colors.END}")
                print(f"{Colors.YELLOW}   2. Los logs se están perdiendo en el pipeline{Colors.END}")
                print(f"{Colors.YELLOW}   3. Los logs están en un formato diferente{Colors.END}")
            
            print(f"\n{Colors.BOLD}=== ESTADÍSTICAS FINALES ==={Colors.END}")
            print(f"Total logs analizados: {len(raw_logs)}")
            print(f"Patrones únicos encontrados: {len(found_patterns)}")
            print(f"Logs con información técnica: {len(set(occ['index'] for occs in found_patterns.values() for occ in occs))}")
            
            # Mostrar ejemplos de logs útiles si los hay
            if log_structure_analysis['useful_content'] > 0:
                print(f"\n{Colors.BOLD}=== EJEMPLOS DE LOGS ÚTILES ==={Colors.END}")
                useful_count = 0
                for log in raw_logs:
                    if useful_count >= 3:
                        break
                    
                    if 'textPayload' in log and log['textPayload'].strip():
                        print(f"{Colors.CYAN}📄 textPayload: {log['textPayload'][:200]}...{Colors.END}")
                        useful_count += 1
                    elif 'jsonPayload' in log and log['jsonPayload'].get('message', '').strip():
                        print(f"{Colors.CYAN}📦 jsonPayload.message: {log['jsonPayload']['message'][:200]}...{Colors.END}")
                        useful_count += 1
            
            return found_patterns
            
        except subprocess.CalledProcessError as e:
            print(f"{Colors.RED}❌ Error ejecutando gcloud: {e}{Colors.END}")
            return {}
        except json.JSONDecodeError as e:
            print(f"{Colors.RED}❌ Error parsing JSON: {e}{Colors.END}")
            return {}

def main():
    """Función principal"""
    parser = argparse.ArgumentParser(
        description='Analizador de logs de Google Cloud Run para Bot WhatsApp',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos de uso:
  python parse_bot_logs.py                    # últimas 10 sesiones (archivos individuales)
  python parse_bot_logs.py --sessions 5      # últimas 5 sesiones (archivos individuales)
  python parse_bot_logs.py --hours 6         # últimas 6 horas (archivos individuales)
  python parse_bot_logs.py --user 573003913251  # logs de un usuario
  python parse_bot_logs.py --errors-only      # solo sesiones problemáticas
  python parse_bot_logs.py --session session-123  # sesión específica
  python parse_bot_logs.py --save-consolidated  # guardar también archivo consolidado
        """
    )
    
    parser.add_argument('--hours', type=int,
                       help='Horas hacia atrás para obtener logs')
    parser.add_argument('--sessions', type=int, default=10,
                       help='Número de sesiones más recientes a mostrar (default: 10)')
    parser.add_argument('--user', type=str,
                       help='Filtrar por ID de usuario específico')
    parser.add_argument('--errors-only', action='store_true',
                       help='Solo mostrar sesiones con errores')
    parser.add_argument('--session', type=str,
                       help='Buscar una sesión específica')
    parser.add_argument('--no-copy', action='store_true',
                       help='No copiar al portapapeles automáticamente')
    parser.add_argument('--no-save', action='store_true',
                       help='No guardar en archivo')
    parser.add_argument('--limit', type=int, default=5000,
                       help='Límite de logs a obtener (default: 5000)')
    parser.add_argument('--no-individual-files', action='store_true',
                       help='No guardar sesiones en archivos individuales')
    parser.add_argument('--save-consolidated', action='store_true',
                       help='Guardar también archivo consolidado (además de individuales)')
    parser.add_argument('--max-session-files', type=int, default=10,
                       help='Máximo número de archivos de sesión a conservar (default: 10)')
    parser.add_argument('--analyze-raw', action='store_true',
                       help='DEBUGGING: Analizar logs crudos para encontrar patrones técnicos ocultos')
    parser.add_argument('--validate-extraction', action='store_true',
                       help='Validar que se está extrayendo toda la información técnica')
    
    args = parser.parse_args()
    
    # Verificar dependencias
    try:
        import platform
        if platform.system() == "Windows":
            gcloud_cmd = r'C:\Users\alex-\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
        else:
            gcloud_cmd = 'gcloud'
        subprocess.run([gcloud_cmd, '--version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"{Colors.RED}❌ gcloud CLI no está instalado o no está en PATH{Colors.END}")
        print(f"{Colors.YELLOW}Instalar con: https://cloud.google.com/sdk/docs/install{Colors.END}")
        sys.exit(1)
    
    # Inicializar parser
    log_parser = CloudRunLogParser()
    
    # Si se solicita análisis de logs crudos, ejecutar y salir
    if args.analyze_raw:
        hours_to_analyze = args.hours if args.hours else 1
        found_patterns = log_parser.analyze_raw_logs(hours_to_analyze, args.limit)
        print(f"\n{Colors.GREEN}✅ Análisis de logs crudos completado{Colors.END}")
        return
    
    # Determinar cuántas horas buscar basado en sesiones solicitadas
    if args.hours:
        hours_to_search = args.hours
        print(f"{Colors.CYAN}🔍 Buscando por tiempo: últimas {hours_to_search} horas{Colors.END}")
    else:
        # Estimar horas basado en sesiones (asumiendo ~1 sesión por hora)
        hours_to_search = max(args.sessions * 2, 8)  # Mínimo 8 horas para 10 sesiones
        print(f"{Colors.CYAN}🔍 Buscando por sesiones: últimas {args.sessions} sesiones{Colors.END}")
    
    # Obtener logs
    logs = log_parser.fetch_logs(hours_to_search, args.limit)
    if not logs:
        print(f"{Colors.RED}❌ No se pudieron obtener logs{Colors.END}")
        sys.exit(1)
    
    # Detectar sesiones
    all_sessions = log_parser.detect_sessions(logs)
    print(f"{Colors.CYAN}🔍 Detectadas {len(all_sessions)} sesiones del bot{Colors.END}")
    
    # Filtrar sesiones
    sessions = all_sessions
    if args.session:
        sessions = [s for s in sessions if args.session in s.session_id]
    
    sessions = log_parser.filter_sessions(sessions, args.user, args.errors_only)
    
    # Limitar al número de sesiones solicitadas (las más recientes)
    if not args.hours and not args.session:  # Solo si no se especificó horas o sesión específica
        sessions = sessions[-args.sessions:]  # Tomar las últimas N sesiones
    
    if not sessions:
        print(f"{Colors.YELLOW}⚠️ No se encontraron sesiones que coincidan con los criterios{Colors.END}")
        sys.exit(0)
    
    # Generar output
    output_parts = []
    
    # Agregar cada sesión
    for session in sessions:
        output_parts.append(session.format_session())
        output_parts.append("")  # Línea en blanco entre sesiones
    
    # Agregar resumen
    output_parts.append(log_parser.generate_summary(sessions))
    
    # Combinar todo
    full_output = '\n'.join(output_parts)
    
    # Mostrar en consola
    print(full_output)
    
    # Ejecutar validación de extracción si se solicita
    if args.validate_extraction:
        validation_stats = log_parser.validate_extraction(sessions)
        print(f"\n{Colors.GREEN}✅ Validación de extracción completada{Colors.END}")
        if validation_stats['missing_patterns']:
            print(f"{Colors.YELLOW}⚠️ Se encontraron patrones faltantes - revisar extractores{Colors.END}")
        else:
            print(f"{Colors.GREEN}✅ Todos los patrones técnicos están siendo extraídos correctamente{Colors.END}")
    
    # Guardar sesiones individuales en logsGoogleCloud (comportamiento por defecto)
    if not args.no_save:
        # Guardar sesiones individuales (comportamiento principal)
        if not args.no_individual_files:
            log_parser.save_sessions_to_individual_files(sessions, args.max_session_files)
        
        # Solo guardar archivo consolidado si se solicita explícitamente
        if args.save_consolidated:
            log_parser.save_to_file(full_output)
    
    # Copiar al portapapeles
    if not args.no_copy:
        log_parser.copy_to_clipboard(full_output)
    
    print(f"\n{Colors.GREEN}✅ Análisis completado exitosamente{Colors.END}")

if __name__ == "__main__":
    main() 