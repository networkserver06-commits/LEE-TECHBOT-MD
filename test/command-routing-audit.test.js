'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { menuCompatCommand } = require('../commands/menuCompat');

test('recognized-command fallback never asks users to resend after connection', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'commands', 'menuCompat.js'), 'utf8');
    assert.doesNotMatch(source, /Please send it again after the bot has fully connected/i);
    assert.match(source, /handler is not available in this deployment/i);
});

test('unsupported catalog commands receive an accurate response', async () => {
    const sent = [];
    const sock = { async sendMessage(chatId, payload) { sent.push(payload); } };
    const message = { key: { remoteJid: '123@s.whatsapp.net' }, message: { conversation: '.panel' } };
    assert.equal(await menuCompatCommand(sock, message.key.remoteJid, message, '.panel', { isOwnerOrSudoCheck: true }), true);
    assert.match(sent[0].text, /handler is not available/i);
    assert.doesNotMatch(sent[0].text, /send it again after the bot has fully connected/i);
});
