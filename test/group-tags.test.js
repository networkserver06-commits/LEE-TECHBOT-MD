'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { menuCompatCommand } = require('../commands/menuCompat');
const { clearGroupMetadataCache } = require('../lib/groupMetadata');
const fs = require('node:fs');
const path = require('node:path');

function mockSock() {
    const sent = [];
    let metadataCalls = 0;
    const sock = {
        sent,
        get metadataCalls() { return metadataCalls; },
        user: { id: '100@s.whatsapp.net' },
        async groupMetadata() {
            metadataCalls += 1;
            return {
                id: '123@g.us',
                subject: 'Test Group',
                participants: [
                    { id: '100@s.whatsapp.net', admin: 'admin' },
                    { id: '200@s.whatsapp.net' },
                    { id: '300@s.whatsapp.net', admin: 'superadmin' }
                ]
            };
        },
        async sendMessage(chatId, payload) { sent.push({ chatId, payload }); return { key: {} }; }
    };
    return sock;
}

const message = { key: { remoteJid: '123@g.us', participant: '300@s.whatsapp.net' }, message: { conversation: '.all' } };

test('all alias performs a real all-member tag', async () => {
    const sock = mockSock();
    clearGroupMetadataCache(sock);
    assert.equal(await menuCompatCommand(sock, '123@g.us', message, '.all', { isGroup: true, isSenderAdmin: true, isOwnerOrSudoCheck: false }), true);
    assert.match(sock.sent.at(-1).payload.text, /@100|@200|@300/);
    assert.deepEqual(sock.sent.at(-1).payload.mentions, ['100@s.whatsapp.net', '200@s.whatsapp.net', '300@s.whatsapp.net']);
});

test('contacttag sends a contact card instead of the recognized-command fallback', async () => {
    const sock = mockSock();
    clearGroupMetadataCache(sock);
    assert.equal(await menuCompatCommand(sock, '123@g.us', message, '.contacttag', { isGroup: true, isSenderAdmin: true, isOwnerOrSudoCheck: false }), true);
    const payload = sock.sent.at(-1).payload;
    assert.ok(payload.contacts);
    assert.equal(payload.contacts.contacts.length, 3);
    assert.doesNotMatch(sock.sent.map((entry) => entry.payload.text || '').join('\n'), /send it again after the bot has fully connected/i);
});

test('admin metadata is cached across the authorization and command data fetch', async () => {
    const sock = mockSock();
    clearGroupMetadataCache(sock);
    await menuCompatCommand(sock, '123@g.us', message, '.all', { isGroup: true, isSenderAdmin: true, isOwnerOrSudoCheck: false });
    assert.equal(sock.metadataCalls, 1);
});

test('rate-limited metadata returns a cooldown response without throwing', async () => {
    const sock = mockSock();
    sock.groupMetadata = async () => { throw Object.assign(new Error('rate-overlimit'), { output: { statusCode: 429 } }); };
    clearGroupMetadataCache(sock);
    await menuCompatCommand(sock, '123@g.us', message, '.all', { isGroup: true, isSenderAdmin: true, isOwnerOrSudoCheck: false });
    assert.match(sock.sent.at(-1).payload.text, /temporarily unavailable|rate-limited/i);
});

test('main dispatcher recognizes raw @ll as the group-wide mention trigger', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    assert.match(source, /isGroup && \/\^@ll\(\?:\\s\|\$\)\/i\.test\(userMessage\)/);
});
