import express from 'express';
import fs from 'fs';
import path from 'path';

interface BotMetrics {
  totalMessages: number;
  messagesPerUser: Map<string, number>;
  averageResponseTime: number;
  lastMessages: Array<{
    timestamp: string;
    user: string;
    message: string;
    responseTime?: number;
    status: 'received' | 'processing' | 'completed' | 'error';
  }>;
  systemStatus: {
    uptime: number;
    environment: string;
    lastRestart: string;
  };
}

class BotDashboard {
  private metrics: BotMetrics;
  private logBuffer: string[] = [];
  private maxLogBuffer = 1000;

  constructor() {
    this.metrics = {
      totalMessages: 0,
      messagesPerUser: new Map(),
      averageResponseTime: 0,
      lastMessages: [],
      systemStatus: {
        uptime: Date.now(),
        environment: process.env.NODE_ENV || 'development',
        lastRestart: new Date().toISOString()
      }
    };
  }

  // Registrar nueva actividad
  logActivity(user: string, message: string, type: 'received' | 'processing' | 'completed' | 'error', responseTime?: number) {
    const activity = {
      timestamp: new Date().toISOString(),
      user,
      message: message.substring(0, 100), // Truncar mensajes largos
      responseTime,
      status: type
    };

    this.metrics.lastMessages.unshift(activity);
    if (this.metrics.lastMessages.length > 50) {
      this.metrics.lastMessages = this.metrics.lastMessages.slice(0, 50);
    }

    if (type === 'received') {
      this.metrics.totalMessages++;
      const currentCount = this.metrics.messagesPerUser.get(user) || 0;
      this.metrics.messagesPerUser.set(user, currentCount + 1);
    }

    if (type === 'completed' && responseTime) {
      // Calcular tiempo promedio de respuesta
      const currentAvg = this.metrics.averageResponseTime;
      this.metrics.averageResponseTime = (currentAvg + responseTime) / 2;
    }
  }

  // Agregar log al buffer
  addLog(logEntry: string) {
    const timestamp = new Date().toISOString();
    const formattedLog = `[${timestamp}] ${logEntry}`;
    
    this.logBuffer.unshift(formattedLog);
    if (this.logBuffer.length > this.maxLogBuffer) {
      this.logBuffer = this.logBuffer.slice(0, this.maxLogBuffer);
    }
  }

  // Generar HTML del dashboard
  generateDashboardHTML(): string {
    const uptime = Math.floor((Date.now() - this.metrics.systemStatus.uptime) / 1000);
    const uptimeFormatted = this.formatUptime(uptime);

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TeAlquilamos Bot - Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333; 
            min-height: 100vh;
        }
        .container { 
            max-width: 1400px; 
            margin: 0 auto; 
            padding: 20px; 
        }
        .header {
            background: rgba(255,255,255,0.95);
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .header h1 {
            color: #2c3e50;
            text-align: center;
            margin-bottom: 10px;
        }
        .status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }
        .status-item {
            background: #f8f9fa;
            padding: 10px 15px;
            border-radius: 5px;
            border-left: 4px solid #28a745;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .metric-card {
            background: rgba(255,255,255,0.95);
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .metric-card h3 {
            color: #2c3e50;
            margin-bottom: 15px;
            border-bottom: 2px solid #3498db;
            padding-bottom: 5px;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #3498db;
            text-align: center;
            margin: 10px 0;
        }
        .logs-section {
            background: rgba(255,255,255,0.95);
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .logs-container {
            background: #1e1e1e;
            color: #fff;
            padding: 15px;
            border-radius: 5px;
            height: 400px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
        }
        .log-entry {
            margin-bottom: 5px;
            padding: 2px 0;
        }
        .log-timestamp {
            color: #888;
        }
        .log-user {
            color: #4CAF50;
            font-weight: bold;
        }
        .log-bot {
            color: #2196F3;
            font-weight: bold;
        }
        .log-error {
            color: #f44336;
            font-weight: bold;
        }
        .activity-list {
            max-height: 300px;
            overflow-y: auto;
        }
        .activity-item {
            padding: 10px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .activity-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        .status-received { background: #e3f2fd; color: #1976d2; }
        .status-processing { background: #fff3e0; color: #f57c00; }
        .status-completed { background: #e8f5e8; color: #388e3c; }
        .status-error { background: #ffebee; color: #d32f2f; }
        .refresh-btn {
            background: #3498db;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin-bottom: 10px;
        }
        .refresh-btn:hover {
            background: #2980b9;
        }
    </style>
    <script>
        function refreshPage() {
            location.reload();
        }
        
        // Auto-refresh cada 30 segundos
        setInterval(refreshPage, 30000);
        
        // Mostrar último refresh
        window.onload = function() {
            document.getElementById('lastUpdate').textContent = new Date().toLocaleString('es-ES');
        }
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏨 TeAlquilamos Bot - Monitor en Vivo</h1>
            <div class="status-bar">
                <div class="status-item">
                    <strong>Estado:</strong> ✅ Activo
                </div>
                <div class="status-item">
                    <strong>Entorno:</strong> ${this.metrics.systemStatus.environment}
                </div>
                <div class="status-item">
                    <strong>Uptime:</strong> ${uptimeFormatted}
                </div>
                <div class="status-item">
                    <strong>Última actualización:</strong> <span id="lastUpdate"></span>
                </div>
            </div>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <h3>📊 Mensajes Totales</h3>
                <div class="metric-value">${this.metrics.totalMessages}</div>
                <p>Mensajes procesados desde el inicio</p>
            </div>

            <div class="metric-card">
                <h3>⚡ Tiempo Promedio</h3>
                <div class="metric-value">${this.metrics.averageResponseTime.toFixed(1)}s</div>
                <p>Tiempo promedio de respuesta</p>
            </div>

            <div class="metric-card">
                <h3>👥 Usuarios Activos</h3>
                <div class="metric-value">${this.metrics.messagesPerUser.size}</div>
                <p>Usuarios únicos que han interactuado</p>
            </div>

            <div class="metric-card">
                <h3>📈 Actividad Reciente</h3>
                <div class="activity-list">
                    ${this.metrics.lastMessages.slice(0, 10).map(msg => `
                        <div class="activity-item">
                            <div>
                                <strong>${msg.user}</strong>: ${msg.message}
                                <br><small>${new Date(msg.timestamp).toLocaleString('es-ES')}</small>
                            </div>
                            <span class="activity-status status-${msg.status}">
                                ${msg.status}${msg.responseTime ? ` (${msg.responseTime.toFixed(1)}s)` : ''}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <div class="logs-section">
            <h3>📋 Logs del Sistema</h3>
            <button class="refresh-btn" onclick="refreshPage()">🔄 Actualizar</button>
            <div class="logs-container">
                ${this.logBuffer.slice(0, 200).map(log => {
                    let cssClass = 'log-entry';
                    if (log.includes('👤')) cssClass += ' log-user';
                    else if (log.includes('🤖') || log.includes('[BOT]')) cssClass += ' log-bot';
                    else if (log.includes('ERROR') || log.includes('❌')) cssClass += ' log-error';
                    
                    return `<div class="${cssClass}">${this.escapeHtml(log)}</div>`;
                }).join('')}
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // Configurar rutas Express
  setupRoutes(app: express.Application) {
    // Dashboard principal
    app.get('/dashboard', (req, res) => {
      const html = this.generateDashboardHTML();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    });

    // API para datos en JSON
    app.get('/api/metrics', (req, res) => {
      res.json({
        ...this.metrics,
        messagesPerUser: Object.fromEntries(this.metrics.messagesPerUser),
        logs: this.logBuffer.slice(0, 100)
      });
    });

    // API para logs solamente
    app.get('/api/logs', (req, res) => {
      res.json({
        logs: this.logBuffer,
        count: this.logBuffer.length
      });
    });
  }
}

export const botDashboard = new BotDashboard();
export default BotDashboard; 