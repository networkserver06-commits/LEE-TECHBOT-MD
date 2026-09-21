'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { Antilink, shouldDeleteLink, extractDomains } = require('../lib/antilink');
const { handleAntilinkCommand } = require('../commands/antilink');
const { getAntilink, removeAntilink, setAntilink } = require('../lib/index');

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

test('silent anti-link deletes only and sends no warning or information', async () => {
    const sent = [];
    const group = '120363000000000001@g.us';
    const sender = '254700000001@s.whatsapp.net';
    const sock = {
        user: { id: '254700000099@s.whatsapp.net' },
        async groupMetadata() { return { participants: [{ id: '254700000099@s.whatsapp.net', admin: 'admin' }] }; },
        async sendMessage(chatId, payload) { sent.push({ chatId, payload }); }
    };
    try {
        await setAntilink(group, 'on', 'delete', { mode: 'all', silent: true });
        await Antilink({ key: { remoteJid: group, participant: sender, id: 'message-1' }, message: { conversation: 'https://blocked.example/scam' } }, sock);
        assert.equal(sent.length, 1);
        assert.deepEqual(sent[0].payload, { delete: { remoteJid: group, participant: sender, id: 'message-1' } });
    } finally {
        await removeAntilink(group, 'on');
    }
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

test('DM status includes the resolved group name and group ID', async () => {
    const sent = [];
    const group = '120363000000000002@g.us';
    const sock = {
        async groupMetadata(chatId) {
            assert.equal(chatId, group);
            return { subject: 'Family & Friends' };
        },
        async sendMessage(chatId, payload) { sent.push({ chatId, payload }); }
    };
    try {
        await setAntilink(group, 'on', 'delete', { mode: 'all', silent: true });
        await handleAntilinkCommand(sock, '254700000000@s.whatsapp.net', `.antilink ${group} get`, '254700000000@s.whatsapp.net', false, dmMessage(`.antilink ${group} get`), true);
        assert.match(sent.at(-1).payload.text, /Group: Family & Friends/);
        assert.match(sent.at(-1).payload.text, /Group ID: 120363000000000002@g\.us/);
    } finally {
        await removeAntilink(group, 'on');
        if (originalState === null) fs.rmSync(stateFile, { force: true });
        else fs.writeFileSync(stateFile, originalState);
    }
});

test('DM status still works when group metadata is unavailable', async () => {
    const sent = [];
    const group = '120363000000000003@g.us';
    const sock = {
        async groupMetadata() { throw new Error('temporary metadata failure'); },
        async sendMessage(chatId, payload) { sent.push({ chatId, payload }); }
    };
    try {
        await handleAntilinkCommand(sock, '254700000000@s.whatsapp.net', `.antilink ${group} get`, '254700000000@s.whatsapp.net', false, dmMessage(`.antilink ${group} get`), true);
        assert.match(sent.at(-1).payload.text, /Group: Unknown group/);
        assert.match(sent.at(-1).payload.text, /Group ID: 120363000000000003@g\.us/);
    } finally {
        await removeAntilink(group, 'on');
        if (originalState === null) fs.rmSync(stateFile, { force: true });
        else fs.writeFileSync(stateFile, originalState);
    }
});
