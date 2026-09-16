'use strict';

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const modePath = path.join(dataDir, 'botMode.json');
const legacyPath = path.join(dataDir, 'messageCount.json');

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function loadBotMode() {
    const dedicated = readJson(modePath, null);
    if (dedicated && typeof dedicated.isPublic === 'boolean') return dedicated;
    const legacy = readJson(legacyPath, { isPublic: true });
    return { isPublic: typeof legacy.isPublic === 'boolean' ? legacy.isPublic : true };
}

function atomicWrite(file, value) {
    fs.mkdirSync(dataDir, { recursive: true });
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, file);
}

function saveBotMode(isPublic) {
    const mode = { isPublic: Boolean(isPublic) };
    atomicWrite(modePath, mode);
    const legacy = readJson(legacyPath, {});
    atomicWrite(legacyPath, { ...legacy, ...mode });
    return mode;
}

module.exports = { modePath, loadBotMode, saveBotMode };
