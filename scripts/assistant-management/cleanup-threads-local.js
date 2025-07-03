#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const THREADS_FILE = path.join('tmp', 'threads.json');
const BACKUP_DIR = path.join('tmp', 'backups');

function backupFile(filePath) {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `threads-backup-${timestamp}.json`);
    fs.copyFileSync(filePath, backupPath);
    console.log(`🗂️ Backup creado: ${backupPath}`);
}

function cleanupThreadsLocal() {
    if (!fs.existsSync(THREADS_FILE)) {
        console.error('❌ No se encontró tmp/threads.json');
        return;
    }
    // Backup antes de modificar
    backupFile(THREADS_FILE);
    const data = JSON.parse(fs.readFileSync(THREADS_FILE, 'utf8'));
    let count = 0;
    for (const entry of data) {
        if (entry[1] && entry[1].threadId) {
            entry[1].threadId = null;
            count++;
        }
    }
    fs.writeFileSync(THREADS_FILE, JSON.stringify(data, null, 2));
    console.log(`\n🎉 Limpiados ${count} threadId(s) en tmp/threads.json (otros datos conservados)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    cleanupThreadsLocal();
}

export { cleanupThreadsLocal }; 