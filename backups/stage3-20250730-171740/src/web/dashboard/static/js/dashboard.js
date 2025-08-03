/**
 * TeAlquilamos Bot Dashboard - JavaScript Cliente
 */

// Configuración
const CONFIG = {
    AUTO_REFRESH_INTERVAL: 30000, // 30 segundos
    API_ENDPOINTS: {
        metrics: '/api/metrics',
        logs: '/api/logs'
    }
};

// Estado de la aplicación
let isAutoRefreshEnabled = true;
let refreshInterval;

/**
 * Inicialización del dashboard
 */
function initDashboard() {
    updateLastRefreshTime();
    setupEventListeners();
    startAutoRefresh();
    
    console.log('Dashboard inicializado correctamente');
}

/**
 * Configurar event listeners
 */
function setupEventListeners() {
    // Botón de refresh manual
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshPage);
    }
    
    // Detectar visibilidad de la página para pausar/reanudar auto-refresh
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Refrescar página completa
 */
function refreshPage() {
    location.reload();
}

/**
 * Actualizar solo los datos (AJAX)
 */
async function updateDashboardData() {
    try {
        const response = await fetch(CONFIG.API_ENDPOINTS.metrics);
        const data = await response.json();
        
        // Actualizar métricas
        updateMetrics(data);
        updateLastRefreshTime();
        
        console.log('Dashboard actualizado via AJAX');
    } catch (error) {
        console.error('Error actualizando dashboard:', error);
        // Fallback a refresh completo
        refreshPage();
    }
}

/**
 * Actualizar métricas en el DOM
 */
function updateMetrics(data) {
    // Total mensajes
    const totalElement = document.querySelector('.metric-value');
    if (totalElement) {
        totalElement.textContent = data.totalMessages || 0;
    }
    
    // Tiempo promedio (asumiendo orden específico)
    const metricValues = document.querySelectorAll('.metric-value');
    if (metricValues[1]) {
        metricValues[1].textContent = `${(data.averageResponseTime || 0).toFixed(1)}s`;
    }
    
    // Usuarios únicos
    if (metricValues[2]) {
        metricValues[2].textContent = Object.keys(data.messagesPerUser || {}).length;
    }
}

/**
 * Actualizar timestamp de última actualización
 */
function updateLastRefreshTime() {
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
        lastUpdateElement.textContent = new Date().toLocaleString('es-ES');
    }
}

/**
 * Iniciar auto-refresh
 */
function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(() => {
        if (isAutoRefreshEnabled && !document.hidden) {
            refreshPage(); // O usar updateDashboardData() para AJAX
        }
    }, CONFIG.AUTO_REFRESH_INTERVAL);
    
    console.log(`Auto-refresh iniciado: cada ${CONFIG.AUTO_REFRESH_INTERVAL/1000}s`);
}

/**
 * Detener auto-refresh
 */
function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    console.log('Auto-refresh detenido');
}

/**
 * Manejar cambios de visibilidad de la página
 */
function handleVisibilityChange() {
    if (document.hidden) {
        console.log('Página oculta - pausando auto-refresh');
        isAutoRefreshEnabled = false;
    } else {
        console.log('Página visible - reanudando auto-refresh');
        isAutoRefreshEnabled = true;
        updateLastRefreshTime();
    }
}

/**
 * Atajos de teclado
 */
function handleKeyboardShortcuts(event) {
    // R = Refresh
    if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        refreshPage();
    }
    
    // F5 = Refresh (por defecto del browser)
    // Espacio = Toggle auto-refresh
    if (event.key === ' ') {
        event.preventDefault();
        toggleAutoRefresh();
    }
}

/**
 * Toggle auto-refresh
 */
function toggleAutoRefresh() {
    isAutoRefreshEnabled = !isAutoRefreshEnabled;
    console.log(`Auto-refresh ${isAutoRefreshEnabled ? 'activado' : 'desactivado'}`);
    
    // Mostrar feedback visual (opcional)
    showNotification(`Auto-refresh ${isAutoRefreshEnabled ? 'activado' : 'desactivado'}`);
}

/**
 * Mostrar notificación temporal
 */
function showNotification(message) {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #3498db;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 1000;
        transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

/**
 * Utilidades de formato
 */
const Utils = {
    formatTimestamp: (timestamp) => {
        return new Date(timestamp).toLocaleString('es-ES');
    },
    
    formatUptime: (seconds) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    },
    
    truncateText: (text, maxLength = 50) => {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initDashboard);

// Limpiar intervalos al cerrar la página
window.addEventListener('beforeunload', stopAutoRefresh);