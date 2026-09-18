'use strict';

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const modePath = path.join(dataDir, 'botMode.json');
const legacyPath = path.join(dataDir, 'messageCount.json');
const MODES = new Set(['public', 'private', 'group', 'dm']);

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function normalizeMode(value) {
    const mode = String(value || '').toLowerCase();
    return MODES.has(mode) ? mode : null;
}

function modeRecord(mode) {
    const normalized = normalizeMode(mode) || 'public';
    return { mode: normalized, isPublic: normalized === 'public' };
}

function envMode() {
    return modeRecord(normalizeMode(process.env.BOT_MODE) || 'public');
}

function loadBotMode() {
    const dedicated = readJson(modePath, null);
    if (dedicated && normalizeMode(dedicated.mode)) return modeRecord(dedicated.mode);
    if (dedicated && typeof dedicated.isPublic === 'boolean') return modeRecord(dedicated.isPublic ? 'public' : 'private');
    const legacy = readJson(legacyPath, null);
    if (legacy && normalizeMode(legacy.mode)) return modeRecord(legacy.mode);
    if (legacy && typeof legacy.isPublic === 'boolean') return modeRecord(legacy.isPublic ? 'public' : 'private');
    return envMode();
}

function atomicWrite(file, value) {
    fs.mkdirSync(dataDir, { recursive: true });
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, file);
}

function persistEnvMode(mode) {
    const configured = process.env.ENV_FILE || path.join(process.cwd(), '.env');
    if (!fs.existsSync(configured) || !fs.statSync(configured).isFile()) return;
    const source = fs.readFileSync(configured, 'utf8');
    const updated = /^BOT_MODE=.*$/m.test(source)
        ? source.replace(/^BOT_MODE=.*$/m, `BOT_MODE=${mode}`)
        : `${source.replace(/\s*$/, '')}\nBOT_MODE=${mode}\n`;
    if (updated !== source) {
        const temporary = `${configured}.tmp`;
        fs.writeFileSync(temporary, updated, { mode: 0o600 });
        fs.renameSync(temporary, configured);
    }
    process.env.BOT_MODE = mode;
}

function saveBotMode(value) {
    const mode = modeRecord(typeof value === 'boolean' ? (value ? 'public' : 'private') : value);
    atomicWrite(modePath, mode);
    const legacy = readJson(legacyPath, {});
    atomicWrite(legacyPath, { ...legacy, ...mode });
    persistEnvMode(mode.mode);
    return mode;
}

module.exports = { modePath, MODES, normalizeMode, loadBotMode, saveBotMode };
