'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const antiDemote = require('../commands/antidemote');

test('anti-demote can be disabled by default', { concurrency: false }, () => {
    const original = fs.existsSync(antiDemote.SETTINGS_PATH)
        ? fs.readFileSync(antiDemote.SETTINGS_PATH, 'utf8')
        : null;
    try {
        antiDemote.setAntiDemoteDefault(false);
        assert.equal(antiDemote.isAntiDemoteEnabled('test-antidemote-default@g.us'), false);
    } finally {
        if (original === null) fs.rmSync(antiDemote.SETTINGS_PATH, { force: true });
        else fs.writeFileSync(antiDemote.SETTINGS_PATH, original);
    }
});

test('anti-demote supports default and group-specific settings', { concurrency: false }, () => {
    const groupId = 'test-antidemote-override@g.us';
    const original = fs.existsSync(antiDemote.SETTINGS_PATH)
        ? fs.readFileSync(antiDemote.SETTINGS_PATH, 'utf8')
        : null;
    try {
        antiDemote.setAntiDemoteDefault(true);
        antiDemote.setAntiDemote(groupId, true);
        assert.equal(antiDemote.isAntiDemoteEnabled(groupId), true);
        antiDemote.setAntiDemote(groupId, false);
        assert.equal(antiDemote.isAntiDemoteEnabled(groupId), false);
        antiDemote.setAntiDemote(groupId, true);
        assert.equal(antiDemote.isAntiDemoteEnabled(groupId), true);
    } finally {
        if (original === null) fs.rmSync(antiDemote.SETTINGS_PATH, { force: true });
        else fs.writeFileSync(antiDemote.SETTINGS_PATH, original);
    }
});

test('anti-demote protects the hardcoded developer account', { concurrency: false }, async () => {
    const sock = { user: { id: '254700000001@s.whatsapp.net' }, async groupMetadata() { return { participants: [] }; } };
    assert.equal(await antiDemote.isProtectedIdentity(sock, 'protected@g.us', '254116553618@s.whatsapp.net'), true);
});

test('anti-demote protects a configured sudo account', { concurrency: false }, async () => {
    const original = fs.readFileSync(antiDemote.SETTINGS_PATH, 'utf8');
    try {
        const data = JSON.parse(original);
        data.sudo = ['254700000099@s.whatsapp.net'];
        fs.writeFileSync(antiDemote.SETTINGS_PATH, `${JSON.stringify(data, null, 2)}\n`);
        const sock = { user: { id: '254700000001@s.whatsapp.net' }, async groupMetadata() { return { participants: [] }; } };
        assert.equal(await antiDemote.isProtectedIdentity(sock, 'protected@g.us', '254700000099@s.whatsapp.net'), true);
    } finally {
        fs.writeFileSync(antiDemote.SETTINGS_PATH, original);
    }
});
