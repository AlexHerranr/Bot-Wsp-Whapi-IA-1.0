import express from 'express';
import path from 'path';
import handlebars from 'handlebars';
import fs from 'fs/promises';
import { botDashboard } from '../../../utils/monitoring/dashboard.js';

const router = express.Router();

/**
 * Preparar datos para el template
 */
function prepareDashboardData(metrics: any): any {
    const uptime = Math.floor((Date.now() - metrics.systemStatus.uptime) / 1000);
    
    return {
        environment: metrics.systemStatus.environment,
        uptime: formatUptime(uptime),
        totalMessages: metrics.totalMessages,
        averageResponseTime: metrics.averageResponseTime.toFixed(1),
        uniqueUsers: metrics.messagesPerUser.size || Object.keys(metrics.messagesPerUser || {}).length,
        lastMessages: metrics.lastMessages.slice(0, 10).map((msg: any) => ({
            user: msg.user,
            message: msg.message.substring(0, 80),
            timestamp: new Date(msg.timestamp).toLocaleString('es-ES'),
            status: msg.status,
            responseTime: msg.responseTime ? msg.responseTime.toFixed(1) : null
        })),
        logs: metrics.logs?.slice(0, 200).map((log: string) => ({
            content: escapeHtml(log),
            cssClass: getLogCssClass(log)
        })) || []
    };
}

/**
 * Formatear uptime
 */
function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
}

/**
 * Escapar HTML
 */
function escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Obtener clase CSS para log
 */
function getLogCssClass(log: string): string {
    let cssClass = 'log-entry';
    if (log.includes('👤')) cssClass += ' log-user';
    else if (log.includes('🤖') || log.includes('[BOT]')) cssClass += ' log-bot';
    else if (log.includes('ERROR') || log.includes('❌')) cssClass += ' log-error';
    return cssClass;
}

// Rutas
router.get('/dashboard', async (req, res) => {
    try {
        const templatePath = path.join(__dirname, '../templates/dashboard.html');
        const templateSource = await fs.readFile(templatePath, 'utf-8');
        const template = handlebars.compile(templateSource);
        
        const metrics = botDashboard.getMetrics();
        const logs = botDashboard.getLogs();
        
        const data = prepareDashboardData({
            ...metrics,
            logs
        });
        
        const html = template(data);
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error) {
        console.error('Error renderizando dashboard:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// API endpoints
router.get('/api/metrics', (req, res) => {
    const metrics = botDashboard.getMetrics();
    const logs = botDashboard.getLogs();
    
    res.json({
        ...metrics,
        messagesPerUser: Object.fromEntries(metrics.messagesPerUser),
        logs: logs.slice(0, 100)
    });
});

router.get('/api/logs', (req, res) => {
    const logs = botDashboard.getLogs();
    
    res.json({
        logs: logs,
        count: logs.length
    });
});

export default router;