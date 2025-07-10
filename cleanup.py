#!/usr/bin/env python3
"""
Script de limpieza para bot-logs-parser
Mantiene el directorio organizado eliminando archivos temporales y antiguos
"""

import os
import glob
import time
from datetime import datetime, timedelta

def cleanup_old_consolidated_files(max_age_days=7):
    """Elimina archivos consolidados antiguos"""
    print("🧹 Limpiando archivos consolidados antiguos...")
    
    pattern = "bot_sessions_*.txt"
    files_removed = 0
    
    for file_path in glob.glob(pattern):
        try:
            # Obtener fecha de modificación
            file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
            age = datetime.now() - file_time
            
            if age.days > max_age_days:
                os.remove(file_path)
                print(f"  ❌ Eliminado: {file_path} (antigüedad: {age.days} días)")
                files_removed += 1
        except Exception as e:
            print(f"  ⚠️ Error eliminando {file_path}: {e}")
    
    if files_removed == 0:
        print("  ✅ No hay archivos consolidados antiguos para eliminar")
    else:
        print(f"  ✅ {files_removed} archivos consolidados eliminados")

def cleanup_temp_files():
    """Elimina archivos temporales"""
    print("🧹 Limpiando archivos temporales...")
    
    temp_patterns = [
        "*.tmp",
        "*.temp", 
        "*.log",
        "__pycache__/",
        "*.pyc",
        ".pytest_cache/"
    ]
    
    files_removed = 0
    
    for pattern in temp_patterns:
        for file_path in glob.glob(pattern, recursive=True):
            try:
                if os.path.isdir(file_path):
                    import shutil
                    shutil.rmtree(file_path)
                    print(f"  ❌ Directorio eliminado: {file_path}")
                else:
                    os.remove(file_path)
                    print(f"  ❌ Archivo eliminado: {file_path}")
                files_removed += 1
            except Exception as e:
                print(f"  ⚠️ Error eliminando {file_path}: {e}")
    
    if files_removed == 0:
        print("  ✅ No hay archivos temporales para eliminar")
    else:
        print(f"  ✅ {files_removed} archivos temporales eliminados")

def organize_examples():
    """Organiza archivos de ejemplo"""
    print("📁 Organizando archivos de ejemplo...")
    
    if not os.path.exists("examples"):
        os.makedirs("examples")
        print("  📁 Carpeta examples/ creada")
    
    # Mover archivos de ejemplo si existen
    example_patterns = [
        "ejemplo_*.txt",
        "sample_*.txt",
        "test_output_*.txt"
    ]
    
    files_moved = 0
    
    for pattern in example_patterns:
        for file_path in glob.glob(pattern):
            try:
                new_path = os.path.join("examples", os.path.basename(file_path))
                if not os.path.exists(new_path):
                    os.rename(file_path, new_path)
                    print(f"  📁 Movido: {file_path} → examples/")
                    files_moved += 1
            except Exception as e:
                print(f"  ⚠️ Error moviendo {file_path}: {e}")
    
    if files_moved == 0:
        print("  ✅ No hay archivos de ejemplo para organizar")
    else:
        print(f"  ✅ {files_moved} archivos organizados en examples/")

def cleanup_individual_sessions(max_files=10):
    """Verifica limpieza de sesiones individuales"""
    print("📋 Verificando sesiones individuales...")
    
    sessions_dir = "../../logsGoogleCloud"
    if not os.path.exists(sessions_dir):
        print(f"  ⚠️ Directorio {sessions_dir} no existe")
        return
    
    session_files = []
    for file_name in os.listdir(sessions_dir):
        if file_name.startswith('session_') and file_name.endswith('.txt'):
            file_path = os.path.join(sessions_dir, file_name)
            mtime = os.path.getmtime(file_path)
            session_files.append((file_path, mtime, file_name))
    
    session_files.sort(key=lambda x: x[1], reverse=True)  # Más recientes primero
    
    print(f"  📊 Encontradas {len(session_files)} sesiones individuales")
    
    if len(session_files) > max_files:
        files_to_remove = session_files[max_files:]
        print(f"  🧹 Eliminando {len(files_to_remove)} sesiones antiguas...")
        
        for file_path, _, file_name in files_to_remove:
            try:
                os.remove(file_path)
                print(f"    ❌ Eliminado: {file_name}")
            except Exception as e:
                print(f"    ⚠️ Error eliminando {file_name}: {e}")
    else:
        print(f"  ✅ Número de sesiones OK ({len(session_files)}/{max_files})")

def show_directory_status():
    """Muestra el estado actual del directorio"""
    print("\n📊 Estado actual del directorio:")
    
    # Archivos principales
    main_files = [
        "parse_bot_logs.py",
        "log_config.yaml", 
        "requirements.txt",
        "README.md"
    ]
    
    print("  📄 Archivos principales:")
    for file_name in main_files:
        if os.path.exists(file_name):
            size = os.path.getsize(file_name)
            print(f"    ✅ {file_name} ({size:,} bytes)")
        else:
            print(f"    ❌ {file_name} (faltante)")
    
    # Directorios
    directories = ["docs", "examples", "tests"]
    print("\n  📁 Directorios:")
    for dir_name in directories:
        if os.path.exists(dir_name):
            file_count = len([f for f in os.listdir(dir_name) if os.path.isfile(os.path.join(dir_name, f))])
            print(f"    ✅ {dir_name}/ ({file_count} archivos)")
        else:
            print(f"    ❌ {dir_name}/ (faltante)")
    
    # Archivos consolidados
    consolidated_files = glob.glob("bot_sessions_*.txt")
    print(f"\n  📋 Archivos consolidados: {len(consolidated_files)}")
    
    # Sesiones individuales
    sessions_dir = "../../logsGoogleCloud"
    if os.path.exists(sessions_dir):
        session_files = [f for f in os.listdir(sessions_dir) if f.startswith('session_') and f.endswith('.txt')]
        print(f"  🗂️ Sesiones individuales: {len(session_files)}")
    else:
        print(f"  🗂️ Sesiones individuales: directorio no existe")

def main():
    """Función principal de limpieza"""
    print("🧹 Bot Logs Parser - Script de Limpieza")
    print("=" * 50)
    
    try:
        # Limpiar archivos temporales
        cleanup_temp_files()
        print()
        
        # Limpiar archivos consolidados antiguos
        cleanup_old_consolidated_files(max_age_days=3)
        print()
        
        # Organizar ejemplos
        organize_examples()
        print()
        
        # Verificar sesiones individuales
        cleanup_individual_sessions(max_files=10)
        print()
        
        # Mostrar estado final
        show_directory_status()
        
        print("\n✅ Limpieza completada exitosamente")
        
    except Exception as e:
        print(f"\n❌ Error durante la limpieza: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 