'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const antiDemote = require('../commands/antidemote');

test('anti-demote is disabled by default', () => {
    assert.equal(antiDemote.isAntiDemoteEnabled('test-antidemote-default@g.us'), false);
});

test('anti-demote supports default and group-specific settings', () => {
    const groupId = 'test-antidemote-override@g.us';
    const original = fs.existsSync(antiDemote.SETTINGS_PATH)
        ? fs.readFileSync(antiDemote.SETTINGS_PATH, 'utf8')
        : null;
    try {
        antiDemote.setAntiDemoteDefault(true);
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
