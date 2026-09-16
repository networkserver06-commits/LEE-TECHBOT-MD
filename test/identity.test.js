'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { loadIdentity, saveIdentity } = require('../lib/identity');
const { normalizeWhatsAppNumber } = require('../lib/phone');

const identityFile = path.join(__dirname, '../data/botIdentity.json');

test('menu identity stores full owner number and survives reload', () => {
    const previous = fs.existsSync(identityFile) ? fs.readFileSync(identityFile) : null;
    try {
        saveIdentity({ userName: 'Network Server', ownerNumber: normalizeWhatsAppNumber('+254 723 456 789') });
        assert.deepEqual(loadIdentity(), { userName: 'Network Server', ownerNumber: '254723456789' });
        delete require.cache[require.resolve('../lib/identity')];
        assert.deepEqual(require('../lib/identity').loadIdentity(), { userName: 'Network Server', ownerNumber: '254723456789' });
    } finally {
        if (previous) fs.writeFileSync(identityFile, previous); else fs.rmSync(identityFile, { force: true });
    }
});
