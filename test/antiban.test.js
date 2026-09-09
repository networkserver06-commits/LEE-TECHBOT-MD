'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const antiBan = require('../commands/antiban');

test('anti-ban is disabled by default and supports a global toggle', () => {
    const original = fs.existsSync(antiBan.SETTINGS_PATH)
        ? fs.readFileSync(antiBan.SETTINGS_PATH, 'utf8')
        : null;
    try {
        antiBan.setAntiBanDefault(false);
        assert.equal(antiBan.isAntiBanEnabled(), false);
        antiBan.setAntiBanDefault(true);
        assert.equal(antiBan.isAntiBanEnabled(), true);
    } finally {
        if (original === null) fs.rmSync(antiBan.SETTINGS_PATH, { force: true });
        else fs.writeFileSync(antiBan.SETTINGS_PATH, original);
    }
});

test('anti-ban owner identity only accepts the linked bot account', () => {
    const sock = { user: { id: '254700000001@s.whatsapp.net' } };
    assert.equal(antiBan.isLinkedOwner(sock, { key: { participant: '254700000001@s.whatsapp.net' } }), true);
    assert.equal(antiBan.isLinkedOwner(sock, { key: { participant: '254700000002@s.whatsapp.net' } }), false);
});
