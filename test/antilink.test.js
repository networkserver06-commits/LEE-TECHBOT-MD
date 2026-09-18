'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { shouldDeleteLink, extractDomains } = require('../lib/antilink');
const { handleAntilinkCommand } = require('../commands/antilink');
const { getAntilink, removeAntilink } = require('../lib/index');

const stateFile = path.join(process.cwd(), 'data', 'userGroupData.json');
const originalState = fs.existsSync(stateFile) ? fs.readFileSync(stateFile) : null;

function dmMessage(text) {
    return { key: { remoteJid: '254700000000@s.whatsapp.net', participant: '254700000000@s.whatsapp.net' }, message: { conversation: text } };
}

test('anti-link supports silent all-link deletion with WhatsApp allowlist', () => {
    const settings = { enabled: true, mode: 'all', silent: true, allowDomains: ['chat.whatsapp.com', 'wa.me'], denyDomains: [] };
    assert.deepEqual(extractDomains('Join https://chat.whatsapp.com/ABC and visit evil.example/path'), ['chat.whatsapp.com', 'evil.example']);
    assert.equal(shouldDeleteLink('Join https://chat.whatsapp.com/ABC', settings), false);
    assert.equal(shouldDeleteLink('Visit https://evil.example/path', settings), true);
    assert.equal(shouldDeleteLink('https://evil.example https://wa.me/123', settings), true);
});

test('anti-link supports scam-only and specific denied domains', () => {
    assert.equal(shouldDeleteLink('Visit https://example.com', { enabled: true, mode: 'scam', silent: true }), false);
    assert.equal(shouldDeleteLink('Claim your prize at https://gift.example.com', { enabled: true, mode: 'scam', silent: true }), true);
    assert.equal(shouldDeleteLink('Visit https://safe.example.com', { enabled: true, mode: 'custom', denyDomains: ['example.com'] }), true);
    assert.equal(shouldDeleteLink('Visit https://safe.example.com', { enabled: true, mode: 'custom', allowDomains: ['example.com'] }), false);
});

test('linked-account DM can configure and persist a group anti-link rule', async () => {
    const sent = [];
    const sock = { async sendMessage(chatId, payload) { sent.push({ chatId, payload }); } };
    const group = '120363000000000000@g.us';
    try {
        await handleAntilinkCommand(sock, '254700000000@s.whatsapp.net', `.antilink ${group} set all silent allow chat.whatsapp.com,wa.me deny bit.ly`, '254700000000@s.whatsapp.net', false, dmMessage(`.antilink ${group} set all silent allow chat.whatsapp.com,wa.me deny bit.ly`), true);
        const settings = await getAntilink(group, 'on');
        assert.equal(settings.enabled, true);
        assert.equal(settings.mode, 'all');
        assert.equal(settings.silent, true);
        assert.deepEqual(settings.allowDomains, ['chat.whatsapp.com', 'wa.me']);
        assert.deepEqual(settings.denyDomains, ['bit.ly']);
        assert.match(sent.at(-1).payload.text, /settings saved/i);
    } finally {
        await removeAntilink(group, 'on');
        if (originalState === null) fs.rmSync(stateFile, { force: true });
        else fs.writeFileSync(stateFile, originalState);
    }
});
