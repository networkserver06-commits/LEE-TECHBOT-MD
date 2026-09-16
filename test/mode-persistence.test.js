'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { loadBotMode, saveBotMode } = require('../lib/mode');

const modeFile = path.join(__dirname, '../data/botMode.json');
const legacyFile = path.join(__dirname, '../data/messageCount.json');

test('bot mode survives a restart and keeps legacy state compatible', () => {
    const oldMode = fs.existsSync(modeFile) ? fs.readFileSync(modeFile) : null;
    const oldLegacy = fs.existsSync(legacyFile) ? fs.readFileSync(legacyFile) : null;
    try {
        saveBotMode(false);
        assert.equal(loadBotMode().isPublic, false);
        delete require.cache[require.resolve('../lib/mode')];
        const reloaded = require('../lib/mode');
        assert.equal(reloaded.loadBotMode().isPublic, false);
        assert.equal(JSON.parse(fs.readFileSync(legacyFile, 'utf8')).isPublic, false);
    } finally {
        if (oldMode) fs.writeFileSync(modeFile, oldMode); else fs.rmSync(modeFile, { force: true });
        if (oldLegacy) fs.writeFileSync(legacyFile, oldLegacy); else fs.rmSync(legacyFile, { force: true });
    }
});
