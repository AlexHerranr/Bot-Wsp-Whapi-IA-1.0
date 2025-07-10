#!/usr/bin/env python3
"""
parse_bot_logs.py - Sistema de Análisis de Logs para Bot WhatsApp en Google Cloud Run

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

SOLUCIÓN:
=========
Este script replica la experiencia de logs locales donde todo es visible de inmediato,
permitiendo:
- Ver logs completos sin clicks adicionales
- Copiar todo el detalle al portapapeles instantáneamente  
- Analizar sesiones completas del bot de principio a fin
- Identificar rápidamente errores y su contexto
- Debuggear conversaciones específicas con usuarios

FILTRADO INTELIGENTE:
====================
Nuevo: Filtra automáticamente metadata HTTP innecesaria para mostrar solo:
- Flujo de comunicación real: Usuario → OpenAI → Beds24 → Respuesta
- Datos crudos de APIs (Beds24, OpenAI)
- Estados de procesamiento importantes
- Errores y warnings con contexto
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
from colorama import Fore, Style

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

class LogEntry:
    """Representa una entrada de log individual"""
    def __init__(self, timestamp: str, severity: str, message: str, raw_data: dict):
        self.timestamp = timestamp
        self.severity = severity
        self.message = message
        self.raw_data = raw_data
        self.colombia_time = self._convert_to_colombia_time()
        self.parsed_content = self._parse_log_content()
    
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
    
    def _parse_log_content(self) -> Dict[str, Any]:
        """Parsea el contenido del log para extraer información estructurada"""
        parsed = {
            'type': 'unknown',
            'user_id': None,
            'content': self.message,
            'function_name': None,
            'function_args': None,
            'function_result': None,
            'openai_state': None,
            'beds24_data': None,
            'response_preview': None,
            'duration': None,
            'is_http_metadata': False,
            'log_category': None,
            'source_file': None,
            'json_data': {},
            'raw_useful_content': None
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
        
        # DETECTAR TIPOS DE LOGS ESPECÍFICOS (como logs locales)
        if self._is_message_received(clean_message):
            parsed.update(self._parse_message_received(clean_message))
        
        elif self._is_message_process(clean_message):
            parsed.update(self._parse_message_process(clean_message))
        
        elif self._is_openai_request(clean_message):
            parsed.update(self._parse_openai_request(clean_message))
        
        elif self._is_function_calling(clean_message):
            parsed.update(self._parse_function_calling(clean_message))
        
        elif self._is_beds24_request(clean_message):
            parsed.update(self._parse_beds24_request(clean_message))
        
        elif self._is_beds24_response(clean_message):
            parsed.update(self._parse_beds24_response(clean_message))
        
        elif self._is_openai_response(clean_message):
            parsed.update(self._parse_openai_response(clean_message))
        
        elif self._is_whatsapp_send(clean_message):
            parsed.update(self._parse_whatsapp_send(clean_message))
        
        # NUEVOS TIPOS DE LOGS AVANZADOS
        elif self._is_function_metrics(clean_message):
            parsed.update(self._parse_function_metrics(clean_message))
        
        elif self._is_user_intent(clean_message):
            parsed.update(self._parse_user_intent(clean_message))
        
        elif self._is_conversion_tracking(clean_message):
            parsed.update(self._parse_conversion_tracking(clean_message))
        
        elif self._is_retry_pattern(clean_message):
            parsed.update(self._parse_retry_pattern(clean_message))
        
        elif self._is_session_analytics(clean_message):
            parsed.update(self._parse_session_analytics(clean_message))
        
        elif self._is_system_health(clean_message):
            parsed.update(self._parse_system_health(clean_message))
        
        elif self._is_business_context(clean_message):
            parsed.update(self._parse_business_context(clean_message))
        
        elif self._is_deep_debug(clean_message):
            parsed.update(self._parse_deep_debug(clean_message))
        
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
        """Extrae contenido útil de logs contaminados con httpRequest"""
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
        
        # Buscar patrones de logs útiles embebidos (más específicos)
        useful_patterns = [
            r'(7/10\s+\[[^\]]+\][^}]+(?:\}[^}]*)*)',  # Formato de timestamp del bot
            r'(\[INFO\][^}]+(?:\}[^}]*)*)',  # Logs con [INFO]
            r'(\[SUCCESS\][^}]+(?:\}[^}]*)*)',  # Logs con [SUCCESS]
            r'(\[ERROR\][^}]+(?:\}[^}]*)*)',  # Logs con [ERROR]
            r'(573\d{9}:[^}]+(?:\}[^}]*)*)',  # Mensajes de usuario
            r'(adding_message[^}]+(?:\}[^}]*)*)',  # OpenAI states
            r'(creating_run[^}]+(?:\}[^}]*)*)',
            r'(function_calling[^}]+(?:\}[^}]*)*)',
            r'(BEDS24_[^}]+(?:\}[^}]*)*)',  # Beds24 logs
        ]
        
        for pattern in useful_patterns:
            match = re.search(pattern, self.message, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    # PARSERS ESPECÍFICOS PARA CADA TIPO DE LOG
    
    def _is_message_received(self, content: str) -> bool:
        """Detecta MESSAGE_RECEIVED"""
        patterns = [
            r'573\d{9}.*"[^"]+"',
            r'Mensaje recibido.*from',
            r'📱.*573\d{9}',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _parse_message_received(self, content: str) -> Dict[str, Any]:
        """Parsea logs de MESSAGE_RECEIVED"""
        result = {
            'type': 'message_received',
            'log_category': 'MESSAGE_RECEIVED',
            'source_file': 'webhook',
        }
        
        # Extraer mensaje
        msg_patterns = [
            r'"([^"]+)"',
            r'573\d{9}:\s*"([^"]+)"',
        ]
        for pattern in msg_patterns:
            match = re.search(pattern, content)
            if match:
                result['content'] = match.group(1)
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
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _parse_message_process(self, content: str) -> Dict[str, Any]:
        """Parsea logs de MESSAGE_PROCESS"""
        result = {
            'type': 'message_process',
            'log_category': 'MESSAGE_PROCESS',
            'source_file': 'app-unified.ts',
        }
        
        # Extraer información de procesamiento
        count_match = re.search(r'(\d+)\s+msgs', content)
        if count_match:
            result['json_data'] = {
                'messageCount': int(count_match.group(1)),
                'userId': result.get('user_id', 'unknown'),
            }
        
        return result
    
    def _is_openai_request(self, content: str) -> bool:
        """Detecta OPENAI_REQUEST"""
        patterns = [
            r'adding_message',
            r'creating_run',
            r'message_added',
            r'run_started',
            r'OPENAI_REQUEST',
            r'7/10\s+\[[^\]]+\]\s+\[BOT\].*→.*OpenAI',  # Formato Cloud Run
            r'→.*msgs.*→.*OpenAI',  # Formato específico
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _parse_openai_request(self, content: str) -> Dict[str, Any]:
        """Parsea logs de OPENAI_REQUEST"""
        result = {
            'type': 'openai_request',
            'log_category': 'OPENAI_REQUEST',
            'source_file': 'app-unified.ts',
        }
        
        # Detectar estado específico
        for state in ['adding_message', 'message_added', 'creating_run', 'run_started']:
            if state in content:
                result['openai_state'] = state
                result['content'] = f"{state} para {result.get('user_id', 'usuario')}"
                break
        
        return result
    
    def _is_function_calling(self, content: str) -> bool:
        """Detecta FUNCTION_CALLING"""
        patterns = [
            r'FUNCTION_CALLING_START',
            r'OpenAI requiere ejecutar.*función',
            r'Ejecutando función',
            r'FUNCTION_EXECUTING',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _parse_function_calling(self, content: str) -> Dict[str, Any]:
        """Parsea logs de FUNCTION_CALLING"""
        result = {
            'type': 'function_calling',
            'log_category': 'FUNCTION_CALLING_START',
            'source_file': 'app-unified.ts',
        }
        
        # Extraer función y argumentos
        func_match = re.search(r'función[:\s]*(\w+)', content)
        if func_match:
            result['function_name'] = func_match.group(1)
        
        # Buscar argumentos JSON
        args_match = re.search(r'\{[^}]+\}', content)
        if args_match:
            try:
                result['function_args'] = json.loads(args_match.group(0))
                result['json_data'] = {
                    'functions': [{
                        'name': result['function_name'],
                        'args': result['function_args']
                    }]
                }
            except:
                result['function_args'] = args_match.group(0)
        
        return result
    
    def _is_beds24_request(self, content: str) -> bool:
        """Detecta BEDS24_REQUEST"""
        patterns = [
            r'BEDS24_REQUEST',
            r'Procesando consulta de disponibilidad',
            r'consulta.*Beds24',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _parse_beds24_request(self, content: str) -> Dict[str, Any]:
        """Parsea logs de BEDS24_REQUEST"""
        result = {
            'type': 'beds24_request',
            'log_category': 'BEDS24_REQUEST',
            'source_file': 'beds24-availability.ts',
        }
        
        # Extraer fechas y noches
        dates_match = re.search(r'(\d{4}-\d{2}-\d{2}).*(\d{4}-\d{2}-\d{2})', content)
        nights_match = re.search(r'(\d+)\s*noches?', content)
        
        if dates_match and nights_match:
            result['json_data'] = {
                'startDate': dates_match.group(1),
                'endDate': dates_match.group(2),
                'nights': int(nights_match.group(1))
            }
        
        return result
    
    def _is_beds24_response(self, content: str) -> bool:
        """Detecta BEDS24_RESPONSE"""
        patterns = [
            r'BEDS24_RESPONSE_DETAIL',
            r'fullResponse.*📅',
            r'Respuesta completa.*Beds24.*OpenAI',
            r'OPENAI_FUNCTION_OUTPUT.*check_availability',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _parse_beds24_response(self, content: str) -> Dict[str, Any]:
        """Parsea logs de BEDS24_RESPONSE"""
        result = {
            'type': 'beds24_response',
            'log_category': 'BEDS24_RESPONSE_DETAIL',
            'source_file': 'beds24-availability.ts',
        }
        
        # Extraer respuesta completa
        response_match = re.search(r'"fullResponse":"([^"]+)"', content)
        if response_match:
            full_response = response_match.group(1).replace('\\n', '\n')
            result['beds24_data'] = full_response
            result['json_data'] = {
                'fullResponse': full_response,
                'responseLength': len(full_response)
            }
        
        return result
    
    def _is_openai_response(self, content: str) -> bool:
        """Detecta OPENAI_RESPONSE"""
        patterns = [
            r'OPENAI_RESPONSE',
            r'Respuesta recibida.*573',
            r'Run completado',
            r'OPENAI_RUN_COMPLETED',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _parse_openai_response(self, content: str) -> Dict[str, Any]:
        """Parsea logs de OPENAI_RESPONSE"""
        result = {
            'type': 'openai_response',
            'log_category': 'OPENAI_RESPONSE',
            'source_file': 'app-unified.ts',
        }
        
        # Extraer duración
        duration_match = re.search(r'(\d+\.?\d*)\s*s', content)
        if duration_match:
            result['duration'] = float(duration_match.group(1)) * 1000  # Convertir a ms
            result['json_data'] = {
                'duration': result['duration']
            }
        
        return result
    
    def _is_whatsapp_send(self, content: str) -> bool:
        """Detecta WHATSAPP_SEND"""
        patterns = [
            r'WHATSAPP_SEND',
            r'Enviando mensaje.*573',
            r'párrafos.*enviados',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    # DETECTORES AVANZADOS PARA MÉTRICAS Y ANÁLISIS
    
    def _is_function_metrics(self, content: str) -> bool:
        """Detecta FUNCTION_METRICS"""
        patterns = [
            r'FUNCTION_METRICS',
            r'executionTime.*apiCallTime',
            r'función.*ejecutada.*tiempo',
            r'performance.*function.*ms',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _is_user_intent(self, content: str) -> bool:
        """Detecta USER_INTENT"""
        patterns = [
            r'USER_INTENT',
            r'Intención detectada',
            r'intent.*confidence',
            r'nlp.*analysis',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _is_conversion_tracking(self, content: str) -> bool:
        """Detecta CONVERSION_TRACKING"""
        patterns = [
            r'CONVERSION_TRACKING',
            r'Punto de conversión',
            r'conversionProbability',
            r'sessionValue.*precio',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _is_retry_pattern(self, content: str) -> bool:
        """Detecta RETRY_PATTERN"""
        patterns = [
            r'RETRY_PATTERN',
            r'Reintento detectado',
            r'attempt.*previousError',
            r'backoff.*retry',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _is_session_analytics(self, content: str) -> bool:
        """Detecta SESSION_ANALYTICS"""
        patterns = [
            r'SESSION_ANALYTICS',
            r'Resumen de sesión',
            r'totalInteractions.*averageResponseTime',
            r'sessionId.*interactions',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _is_system_health(self, content: str) -> bool:
        """Detecta SYSTEM_HEALTH"""
        patterns = [
            r'SYSTEM_HEALTH',
            r'Estado del sistema',
            r'openaiLatency.*beds24Latency',
            r'memoryUsage.*activeThreads',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _is_business_context(self, content: str) -> bool:
        """Detecta BUSINESS_CONTEXT"""
        patterns = [
            r'BUSINESS_CONTEXT',
            r'Contexto comercial',
            r'propertyShown.*pricePerNight',
            r'occupancyRate.*recommendationScore',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _is_deep_debug(self, content: str) -> bool:
        """Detecta DEEP_DEBUG"""
        patterns = [
            r'DEEP_DEBUG',
            r'Trace detallado',
            r'stackTrace.*memorySnapshot',
            r'eventLoopLag.*v8HeapStats',
        ]
        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)
    
    def _parse_whatsapp_send(self, content: str) -> Dict[str, Any]:
        """Parsea logs de WHATSAPP_SEND"""
        result = {
            'type': 'whatsapp_send',
            'log_category': 'WHATSAPP_SEND',
            'source_file': 'app-unified.ts',
        }
        
        # Extraer información de envío
        chunks_match = re.search(r'(\d+)\s*párrafos?', content)
        if chunks_match:
            result['json_data'] = {
                'chunks': int(chunks_match.group(1))
            }
        
        return result
    
    # PARSERS PARA LOGS AVANZADOS
    
    def _parse_function_metrics(self, content: str) -> Dict[str, Any]:
        """Parsea logs de FUNCTION_METRICS"""
        result = {
            'type': 'function_metrics',
            'log_category': 'FUNCTION_METRICS',
            'source_file': 'analytics',
        }
        
        # Extraer métricas de rendimiento
        execution_match = re.search(r'executionTime["\']:\s*(\d+)', content)
        api_match = re.search(r'apiCallTime["\']:\s*(\d+)', content)
        function_match = re.search(r'(\w+)\s+ejecutada', content)
        
        if execution_match and api_match:
            result['json_data'] = {
                'executionTime': int(execution_match.group(1)),
                'apiCallTime': int(api_match.group(1)),
                'processingTime': int(execution_match.group(1)) - int(api_match.group(1))
            }
        
        if function_match:
            result['function_name'] = function_match.group(1)
        
        return result
    
    def _parse_user_intent(self, content: str) -> Dict[str, Any]:
        """Parsea logs de USER_INTENT"""
        result = {
            'type': 'user_intent',
            'log_category': 'USER_INTENT',
            'source_file': 'nlp',
        }
        
        # Extraer intención y confianza
        intent_match = re.search(r'intent["\']:\s*["\']([^"\']+)["\']', content)
        confidence_match = re.search(r'confidence["\']:\s*([0-9.]+)', content)
        
        if intent_match and confidence_match:
            result['json_data'] = {
                'intent': intent_match.group(1),
                'confidence': float(confidence_match.group(1))
            }
        
        return result
    
    def _parse_conversion_tracking(self, content: str) -> Dict[str, Any]:
        """Parsea logs de CONVERSION_TRACKING"""
        result = {
            'type': 'conversion_tracking',
            'log_category': 'CONVERSION_TRACKING',
            'source_file': 'analytics',
        }
        
        # Extraer datos de conversión
        stage_match = re.search(r'stage["\']:\s*["\']([^"\']+)["\']', content)
        value_match = re.search(r'sessionValue["\']:\s*(\d+)', content)
        prob_match = re.search(r'conversionProbability["\']:\s*([0-9.]+)', content)
        
        if stage_match:
            result['json_data'] = {
                'stage': stage_match.group(1)
            }
            if value_match:
                result['json_data']['sessionValue'] = int(value_match.group(1))
            if prob_match:
                result['json_data']['conversionProbability'] = float(prob_match.group(1))
        
        return result
    
    def _parse_retry_pattern(self, content: str) -> Dict[str, Any]:
        """Parsea logs de RETRY_PATTERN"""
        result = {
            'type': 'retry_pattern',
            'log_category': 'RETRY_PATTERN',
            'source_file': 'reliability',
        }
        
        # Extraer información de reintentos
        attempt_match = re.search(r'attempt["\']:\s*(\d+)', content)
        operation_match = re.search(r'operation["\']:\s*["\']([^"\']+)["\']', content)
        error_match = re.search(r'previousError["\']:\s*["\']([^"\']+)["\']', content)
        
        if attempt_match and operation_match:
            result['json_data'] = {
                'operation': operation_match.group(1),
                'attempt': int(attempt_match.group(1))
            }
            if error_match:
                result['json_data']['previousError'] = error_match.group(1)
        
        return result
    
    def _parse_session_analytics(self, content: str) -> Dict[str, Any]:
        """Parsea logs de SESSION_ANALYTICS"""
        result = {
            'type': 'session_analytics',
            'log_category': 'SESSION_ANALYTICS',
            'source_file': 'metrics',
        }
        
        # Extraer métricas de sesión
        interactions_match = re.search(r'totalInteractions["\']:\s*(\d+)', content)
        response_time_match = re.search(r'averageResponseTime["\']:\s*([0-9.]+)', content)
        
        if interactions_match and response_time_match:
            result['json_data'] = {
                'totalInteractions': int(interactions_match.group(1)),
                'averageResponseTime': float(response_time_match.group(1))
            }
        
        return result
    
    def _parse_system_health(self, content: str) -> Dict[str, Any]:
        """Parsea logs de SYSTEM_HEALTH"""
        result = {
            'type': 'system_health',
            'log_category': 'SYSTEM_HEALTH',
            'source_file': 'monitoring',
        }
        
        # Extraer métricas del sistema
        openai_latency = re.search(r'openaiLatency["\']:\s*(\d+)', content)
        beds24_latency = re.search(r'beds24Latency["\']:\s*(\d+)', content)
        memory_usage = re.search(r'memoryUsage["\']:\s*(\d+)', content)
        
        if openai_latency or beds24_latency or memory_usage:
            result['json_data'] = {}
            if openai_latency:
                result['json_data']['openaiLatency'] = int(openai_latency.group(1))
            if beds24_latency:
                result['json_data']['beds24Latency'] = int(beds24_latency.group(1))
            if memory_usage:
                result['json_data']['memoryUsage'] = int(memory_usage.group(1))
        
        return result
    
    def _parse_business_context(self, content: str) -> Dict[str, Any]:
        """Parsea logs de BUSINESS_CONTEXT"""
        result = {
            'type': 'business_context',
            'log_category': 'BUSINESS_CONTEXT',
            'source_file': 'analytics',
        }
        
        # Extraer contexto comercial
        property_match = re.search(r'propertyShown["\']:\s*["\']([^"\']+)["\']', content)
        price_match = re.search(r'pricePerNight["\']:\s*(\d+)', content)
        occupancy_match = re.search(r'occupancyRate["\']:\s*([0-9.]+)', content)
        
        if property_match or price_match:
            result['json_data'] = {}
            if property_match:
                result['json_data']['propertyShown'] = property_match.group(1)
            if price_match:
                result['json_data']['pricePerNight'] = int(price_match.group(1))
            if occupancy_match:
                result['json_data']['occupancyRate'] = float(occupancy_match.group(1))
        
        return result
    
    def _parse_deep_debug(self, content: str) -> Dict[str, Any]:
        """Parsea logs de DEEP_DEBUG"""
        result = {
            'type': 'deep_debug',
            'log_category': 'DEEP_DEBUG',
            'source_file': 'trace',
        }
        
        # Extraer información de debugging
        operation_match = re.search(r'operation["\']:\s*["\']([^"\']+)["\']', content)
        lag_match = re.search(r'eventLoopLag["\']:\s*(\d+)', content)
        
        if operation_match:
            result['json_data'] = {
                'operation': operation_match.group(1)
            }
            if lag_match:
                result['json_data']['eventLoopLag'] = int(lag_match.group(1))
        
        return result
    
    def _is_http_metadata_only(self) -> bool:
        """Detecta si el log contiene SOLO metadata HTTP sin información útil"""
        # Logs que son pura metadata HTTP y deben filtrarse
        http_only_patterns = [
            r'^{\s*["\']httpRequest["\']',  # Empieza con httpRequest
            r'latency.*protocol.*requestMethod.*responseSize',  # Contiene solo datos HTTP
            r'insertId.*labels.*gcb-build-id',  # Solo metadata de build
            r'spanId.*trace.*traceSampled.*timestamp.*severity.*INFO',  # Solo tracing
            r'receiveTimestamp.*resource.*labels.*configuration_name',  # Solo metadata de recurso
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
        return self.parsed_content['is_http_metadata']
    
    def format_colored(self) -> str:
        """Formatea el log con colores y en formato de logs locales"""
        parsed = self._parse_log_content()
        
        # Filtrar logs de metadata HTTP
        if parsed.get('is_http_metadata', False):
            return ""
        
        # Timestamp en formato ISO
        timestamp = self.colombia_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        
        # Determinar nivel de severidad
        if self.is_error():
            level = "ERROR"
            level_color = Fore.RED
        elif self.is_warning():
            level = "WARNING"
            level_color = Fore.YELLOW
        elif parsed.get('type') == 'openai_response' or 'completado' in self.message.lower():
            level = "SUCCESS"
            level_color = Fore.GREEN
        else:
            level = "INFO"
            level_color = Fore.CYAN
        
        # Determinar categoría del log
        log_category = parsed.get('log_category', 'UNKNOWN')
        source_file = parsed.get('source_file', 'unknown')
        
        # Construir mensaje principal
        if parsed.get('type') == 'message_received':
            main_message = f"Usuario {parsed.get('user_id', 'unknown')}: \"{parsed.get('content', '')}\""
        elif parsed.get('type') == 'message_process':
            main_message = f"Procesando mensajes agrupados"
        elif parsed.get('type') == 'openai_request':
            main_message = f"{parsed.get('openai_state', 'request')} para {parsed.get('user_id', 'usuario')}"
        elif parsed.get('type') == 'function_calling':
            func_name = parsed.get('function_name', 'unknown')
            main_message = f"OpenAI requiere ejecutar función: {func_name}"
        elif parsed.get('type') == 'beds24_request':
            main_message = f"Procesando consulta de disponibilidad"
        elif parsed.get('type') == 'beds24_response':
            main_message = f"Respuesta completa de Beds24 enviada a OpenAI"
        elif parsed.get('type') == 'openai_response':
            duration = parsed.get('duration', 0)
            main_message = f"Run completado para {parsed.get('user_id', 'usuario')}"
        elif parsed.get('type') == 'whatsapp_send':
            main_message = f"Enviando mensaje a {parsed.get('user_id', 'usuario')}"
        
        # NUEVOS TIPOS DE LOGS AVANZADOS
        elif parsed.get('type') == 'function_metrics':
            func_name = parsed.get('function_name', 'unknown')
            main_message = f"{func_name} ejecutada"
        elif parsed.get('type') == 'user_intent':
            intent = parsed.get('json_data', {}).get('intent', 'unknown')
            confidence = parsed.get('json_data', {}).get('confidence', 0)
            main_message = f"Intención detectada: {intent} (confianza: {confidence:.2f})"
        elif parsed.get('type') == 'conversion_tracking':
            stage = parsed.get('json_data', {}).get('stage', 'unknown')
            main_message = f"Punto de conversión: {stage}"
        elif parsed.get('type') == 'retry_pattern':
            operation = parsed.get('json_data', {}).get('operation', 'unknown')
            attempt = parsed.get('json_data', {}).get('attempt', 0)
            main_message = f"Reintento detectado: {operation} (intento {attempt})"
        elif parsed.get('type') == 'session_analytics':
            interactions = parsed.get('json_data', {}).get('totalInteractions', 0)
            main_message = f"Resumen de sesión: {interactions} interacciones"
        elif parsed.get('type') == 'system_health':
            main_message = f"Estado del sistema"
        elif parsed.get('type') == 'business_context':
            property_name = parsed.get('json_data', {}).get('propertyShown', 'unknown')
            main_message = f"Contexto comercial: {property_name}"
        elif parsed.get('type') == 'deep_debug':
            operation = parsed.get('json_data', {}).get('operation', 'unknown')
            main_message = f"Trace detallado: {operation}"
        else:
            # Para otros tipos, usar el mensaje original limpio
            useful_content = parsed.get('raw_useful_content')
            if useful_content and useful_content.strip():
                main_message = useful_content
                # Actualizar categoría si podemos detectar el tipo
                if 'adding_message' in useful_content:
                    log_category = 'OPENAI_REQUEST'
                elif 'creating_run' in useful_content:
                    log_category = 'OPENAI_REQUEST'
                elif 'BEDS24' in useful_content:
                    log_category = 'BEDS24_RESPONSE_DETAIL'
                elif 'function_calling' in useful_content:
                    log_category = 'FUNCTION_CALLING_START'
                elif 'Completado' in useful_content:
                    log_category = 'OPENAI_RESPONSE'
                    level = "SUCCESS"
                    level_color = Fore.GREEN
            else:
                # Si no hay contenido útil, filtrar este log
                return ""
        
        # Construir JSON de datos
        json_data = parsed.get('json_data', {})
        if parsed.get('user_id'):
            json_data['userId'] = parsed['user_id']
        
        # Formatear línea completa
        formatted_line = f"[{timestamp}] [{level}] {log_category} [{source_file}]: {main_message}"
        
        # Agregar JSON si hay datos
        if json_data:
            json_str = json.dumps(json_data, ensure_ascii=False, separators=(',', ':'))
            formatted_line += f" | {json_str}"
        
        # Aplicar colores
        colored_line = f"{level_color}[{timestamp}] [{level}]{Style.RESET_ALL} {Fore.MAGENTA}{log_category}{Style.RESET_ALL} [{source_file}]: {main_message}"
        
        if json_data:
            json_str = json.dumps(json_data, ensure_ascii=False, separators=(',', ':'))
            colored_line += f" | {Fore.BLUE}{json_str}{Style.RESET_ALL}"
        
        return colored_line

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
        """Obtiene logs de Google Cloud Run"""
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
            
        cmd = [
            gcloud_cmd, 'logging', 'read',
            f'resource.type=cloud_run_revision AND resource.labels.service_name={self.service_name} AND timestamp>="{timestamp_filter}"',
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
            return self._parse_raw_logs(raw_logs)
            
        except subprocess.CalledProcessError as e:
            print(f"{Colors.RED}❌ Error ejecutando gcloud: {e}{Colors.END}")
            print(f"{Colors.RED}Stderr: {e.stderr}{Colors.END}")
            return []
        except json.JSONDecodeError as e:
            print(f"{Colors.RED}❌ Error parsing JSON: {e}{Colors.END}")
            return []
    
    def _parse_raw_logs(self, raw_logs: List[Dict]) -> List[LogEntry]:
        """Parsea logs raw de Google Cloud"""
        logs = []
        
        for raw_log in raw_logs:
            try:
                timestamp = raw_log.get('timestamp', '')
                severity = raw_log.get('severity', 'INFO')
                
                # Extraer mensaje del log
                message = ""
                if 'textPayload' in raw_log:
                    message = raw_log['textPayload']
                elif 'jsonPayload' in raw_log:
                    json_payload = raw_log['jsonPayload']
                    if 'message' in json_payload:
                        message = json_payload['message']
                    else:
                        message = json.dumps(json_payload, indent=2)
                else:
                    message = str(raw_log)
                
                log_entry = LogEntry(timestamp, severity, message, raw_log)
                logs.append(log_entry)
                
            except Exception as e:
                print(f"{Colors.RED}Error parsing log entry: {e}{Colors.END}")
                continue
        
        # Ordenar por timestamp
        logs.sort(key=lambda x: x.colombia_time)
        return logs
    
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
        
        # Crear carpeta logsGoogleCloud si no existe
        logs_dir = "../../logsGoogleCloud"
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
            filename = f"session_{session_time}_{session_id_short}.txt"
            filepath = os.path.join(logs_dir, filename)
            
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    # Contenido del archivo de sesión individual
                    session_content = []
                    session_content.append("=" * 80)
                    session_content.append(f"SESIÓN DEL BOT - {session.start_time.strftime('%Y-%m-%d %H:%M:%S')} (Colombia)")
                    session_content.append("=" * 80)
                    session_content.append(f"Session ID: {session.session_id}")
                    session_content.append(f"Deployment: {session.deployment_info}")
                    session_content.append(f"Duración: {session.duration()}")
                    session_content.append(f"Eventos procesados: {session.messages_processed}")
                    session_content.append(f"Usuarios únicos: {len(session.users)}")
                    session_content.append(f"Errores: {len(session.errors)}")
                    session_content.append(f"Warnings: {len(session.warnings)}")
                    session_content.append("=" * 80)
                    session_content.append("")
                    
                    # Logs de la sesión (sin colores, filtrar logs vacíos)
                    for log in session.logs:
                        # Saltar logs que deben filtrarse
                        if log.should_filter_out():
                            continue
                            
                        time_str = log.colombia_time.strftime('%Y-%m-%d %H:%M:%S')
                        
                        # Determinar prefijo según tipo de log
                        if log.is_error():
                            prefix = "🔴 ERROR"
                        elif log.is_warning():
                            prefix = "⚠️ WARNING"
                        elif log.is_user_message():
                            prefix = "👤 USER"
                        elif log.is_session_start():
                            prefix = "🚀 START"
                        else:
                            prefix = "ℹ️ INFO"
                        
                        session_content.append(f"[{time_str}] {prefix}: {log.message}")
                    
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
                if filename.startswith('session_') and filename.endswith('.txt'):
                    # Extraer session ID del nombre del archivo
                    # Formato: session_YYYYMMDD_HHMMSS_SessionID.txt
                    parts = filename.replace('.txt', '').split('_')
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
                if filename.startswith('session_') and filename.endswith('.txt'):
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
                        print(f"{Colors.GRAY}🗑️ Eliminado archivo antiguo: {filename}{Colors.END}")
                    except Exception as e:
                        print(f"{Colors.RED}❌ Error eliminando {filename}: {e}{Colors.END}")
                
                if files_to_delete:
                    print(f"{Colors.YELLOW}🧹 Limpieza automática: {len(files_to_delete)} archivos eliminados, {len(files_to_keep)} conservados{Colors.END}")
        
        except Exception as e:
            print(f"{Colors.RED}❌ Error en limpieza automática: {e}{Colors.END}")
    
    def copy_to_clipboard(self, content: str):
        """Copia contenido al portapapeles"""
        try:
            # Remover colores ANSI para el portapapeles
            clean_content = re.sub(r'\033\[[0-9;]*m', '', content)
            pyperclip.copy(clean_content)
            print(f"{Colors.GREEN}📋 Contenido copiado al portapapeles{Colors.END}")
        except Exception as e:
            print(f"{Colors.RED}❌ Error copiando al portapapeles: {e}{Colors.END}")

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