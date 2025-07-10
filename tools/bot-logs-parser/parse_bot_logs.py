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
    
    def is_user_message(self) -> bool:
        """Detecta si es un mensaje de usuario"""
        patterns = [
            r'👤',
            r'573\d{9}',  # Números colombianos
            r'57\d{10}',  # Números colombianos alternativos
            r'Procesando mensaje de usuario',
            r'Usuario\s+\d+',
            r'From:\s*\d+'
        ]
        return any(re.search(pattern, self.message, re.IGNORECASE) for pattern in patterns)
    
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
            r'Bot iniciado exitosamente'
        ]
        return any(re.search(pattern, self.message, re.IGNORECASE) for pattern in patterns)
    
    def format_colored(self) -> str:
        """Formatea el log con colores"""
        time_str = self.colombia_time.strftime('%Y-%m-%d %H:%M:%S')
        
        # Determinar color según tipo de log
        if self.is_error():
            color = Colors.RED
            prefix = "🔴"
        elif self.is_warning():
            color = Colors.YELLOW
            prefix = "⚠️"
        elif self.is_user_message():
            color = Colors.BLUE
            prefix = "👤"
        elif self.is_session_start():
            color = Colors.GREEN
            prefix = "🚀"
        else:
            color = Colors.GRAY
            prefix = "ℹ️"
        
        return f"{color}{prefix} [{time_str}] {self.severity}: {self.message}{Colors.END}"

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
        
        # Logs de la sesión
        for log in self.logs:
            output.append(log.format_colored())
        
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
                    
                    # Logs de la sesión (sin colores)
                    for log in session.logs:
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
  python parse_bot_logs.py                    # últimas 10 sesiones
  python parse_bot_logs.py --sessions 5      # últimas 5 sesiones
  python parse_bot_logs.py --hours 6         # últimas 6 horas
  python parse_bot_logs.py --user 573003913251  # logs de un usuario
  python parse_bot_logs.py --errors-only      # solo sesiones problemáticas
  python parse_bot_logs.py --session session-123  # sesión específica
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
    
    # Guardar sesiones individuales en logsGoogleCloud
    if not args.no_save:
        if not args.no_individual_files:
            log_parser.save_sessions_to_individual_files(sessions, args.max_session_files)
        # También guardar archivo consolidado tradicional
        log_parser.save_to_file(full_output)
    
    # Copiar al portapapeles
    if not args.no_copy:
        log_parser.copy_to_clipboard(full_output)
    
    print(f"\n{Colors.GREEN}✅ Análisis completado exitosamente{Colors.END}")

if __name__ == "__main__":
    main() 