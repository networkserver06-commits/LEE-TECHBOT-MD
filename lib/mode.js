'use strict';

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const modePath = path.join(dataDir, 'botMode.json');
const legacyPath = path.join(dataDir, 'messageCount.json');

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function envMode() {
    return String(process.env.BOT_MODE || '').toLowerCase() === 'private' ? { isPublic: false } : null;
}

function loadBotMode() {
    const dedicated = readJson(modePath, null);
    if (dedicated && typeof dedicated.isPublic === 'boolean') return dedicated;
    const legacy = readJson(legacyPath, null);
    if (legacy && typeof legacy.isPublic === 'boolean') return { isPublic: legacy.isPublic };
    return envMode() || { isPublic: true };
}

function atomicWrite(file, value) {
    fs.mkdirSync(dataDir, { recursive: true });
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, file);
}

function persistEnvMode(isPublic) {
    const configured = process.env.ENV_FILE || path.join(process.cwd(), '.env');
    if (!fs.existsSync(configured) || !fs.statSync(configured).isFile()) return;
    const value = isPublic ? 'public' : 'private';
    const source = fs.readFileSync(configured, 'utf8');
    const updated = /^BOT_MODE=.*$/m.test(source)
        ? source.replace(/^BOT_MODE=.*$/m, `BOT_MODE=${value}`)
        : `${source.replace(/\s*$/, '')}\nBOT_MODE=${value}\n`;
    if (updated !== source) {
        const temporary = `${configured}.tmp`;
        fs.writeFileSync(temporary, updated, { mode: 0o600 });
        fs.renameSync(temporary, configured);
    }
    process.env.BOT_MODE = value;
}

function saveBotMode(isPublic) {
    const mode = { isPublic: Boolean(isPublic) };
    atomicWrite(modePath, mode);
    const legacy = readJson(legacyPath, {});
    atomicWrite(legacyPath, { ...legacy, ...mode });
    persistEnvMode(mode.isPublic);
    return mode;
}

module.exports = { modePath, loadBotMode, saveBotMode };
