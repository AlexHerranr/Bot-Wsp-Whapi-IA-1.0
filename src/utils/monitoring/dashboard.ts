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

  // Obtener métricas (público para las rutas)
  getMetrics() {
    return this.metrics;
  }

  // Obtener logs (público para las rutas)
  getLogs() {
    return this.logBuffer;
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

  // Configurar rutas Express (delegado al nuevo sistema modular)
  setupRoutes(app: express.Application) {
    // Configurar archivos estáticos
    app.use('/static', express.static(path.join(__dirname, '../../web/dashboard/static')));
    
    // Importar rutas del dashboard modular
    import('../../web/dashboard/routes/dashboard.routes.js').then(({ default: dashboardRoutes }) => {
      app.use('/', dashboardRoutes);
    }).catch(error => {
      console.error('Error cargando rutas del dashboard:', error);
      // Fallback a las rutas legacy si hay problemas
      this.setupLegacyRoutes(app);
    });
  }

  // Rutas legacy como respaldo
  private setupLegacyRoutes(app: express.Application) {
    app.get('/api/metrics', (req, res) => {
      res.json({
        ...this.metrics,
        messagesPerUser: Object.fromEntries(this.metrics.messagesPerUser),
        logs: this.logBuffer.slice(0, 100)
      });
    });

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