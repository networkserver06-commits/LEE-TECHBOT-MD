'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { menuCompatCommand } = require('../commands/menuCompat');

function mockSock() {
    const sent = [];
    return {
        sent,
        async sendMessage(chatId, payload) { sent.push({ chatId, payload }); return { key: {} }; }
    };
}

const message = { key: { remoteJid: '123@s.whatsapp.net' }, message: { conversation: '.test' } };

test('missing test command is routed by compatibility handler', async () => {
    const sock = mockSock();
    const handled = await menuCompatCommand(sock, '123@s.whatsapp.net', message, '.test', {});
    assert.equal(handled, true);
    assert.match(sock.sent[0].payload.text, /router is working/i);
});

test('owner-only missing commands are rejected for non-owners', async () => {
    const sock = mockSock();
    const handled = await menuCompatCommand(sock, '123@s.whatsapp.net', message, '.restart', { isOwnerOrSudoCheck: false });
    assert.equal(handled, true);
    assert.match(sock.sent[0].payload.text, /owner or sudo/i);
});

test('group-only missing commands are rejected outside groups', async () => {
    const sock = mockSock();
    const handled = await menuCompatCommand(sock, '123@s.whatsapp.net', message, '.addall', { isGroup: false, isOwnerOrSudoCheck: false });
    assert.equal(handled, true);
    assert.match(sock.sent[0].payload.text, /only be used in a group/i);
});

test('local poll command produces a native WhatsApp poll payload', async () => {
    const sock = mockSock();
    const handled = await menuCompatCommand(sock, '123@g.us', message, '.poll Choose | A | B', { isGroup: true, isSenderAdmin: true });
    assert.equal(handled, true);
    assert.deepEqual(sock.sent[0].payload.poll.values, ['A', 'B']);
});

test('autoviewstatus uses the persistent auto-status handler instead of a provider warning', async () => {
    const sock = mockSock();
    const ownerMessage = { key: { remoteJid: '123@s.whatsapp.net', fromMe: true }, message: { conversation: '.autoviewstatus' } };
    const handled = await menuCompatCommand(sock, '123@s.whatsapp.net', ownerMessage, '.autoviewstatus', { isOwnerOrSudoCheck: true });
    assert.equal(handled, true);
    assert.match(sock.sent[0].payload.text, /AUTO STATUS SETTINGS|Auto-View/i);
});

test('group menu command calls the real group-info handler', async () => {
    const sock = mockSock();
    sock.user = { id: '254700000000:1@s.whatsapp.net' };
    sock.groupMetadata = async () => ({ id: '123@g.us', subject: 'Test Group', participants: [], announce: false, restrict: false });
    const ownerMessage = { key: { remoteJid: '123@g.us', fromMe: true }, message: { conversation: '.group' } };
    const handled = await menuCompatCommand(sock, '123@g.us', ownerMessage, '.group', { isGroup: true, isSenderAdmin: true, isOwnerOrSudoCheck: true });
    assert.equal(handled, true);
    assert.match(sock.sent[0].payload.text || sock.sent[0].payload.caption, /GROUP INFO|SUBJECT/i);
});

test('local note and rate commands execute without an external provider', async () => {
    const sock = mockSock();
    const ownerMessage = { key: { remoteJid: '123@s.whatsapp.net', fromMe: true }, message: { conversation: '.note test item' } };
    assert.equal(await menuCompatCommand(sock, '123@s.whatsapp.net', ownerMessage, '.note test item', {}), true);
    assert.match(sock.sent.at(-1).payload.text, /Note saved/i);
    assert.equal(await menuCompatCommand(sock, '123@s.whatsapp.net', ownerMessage, '.listnote', {}), true);
    assert.match(sock.sent.at(-1).payload.text, /test item/i);
    assert.equal(await menuCompatCommand(sock, '123@s.whatsapp.net', ownerMessage, '.rate music', {}), true);
    assert.match(sock.sent.at(-1).payload.text, /rate/i);
});

test('internal general aliases execute real handlers without generic warnings', async () => {
    const sock = mockSock();
    const message = { key: { remoteJid: '123@s.whatsapp.net', fromMe: true }, message: { conversation: '.audiospeed' } };
    assert.equal(await menuCompatCommand(sock, '123@s.whatsapp.net', message, '.audiospeed', { isOwnerOrSudoCheck: true }), true);
    assert.match(sock.sent.at(-1).payload.text, /Reply to an audio|Speed must/i);
    assert.equal(await menuCompatCommand(sock, '123@s.whatsapp.net', message, '.lid', {}), true);
    assert.equal(await menuCompatCommand(sock, '123@s.whatsapp.net', message, '.clearchat', {}), true);
    assert.ok(sock.sent.length >= 2);
});

test('joingc accepts an invite link and calls groupAcceptInvite', async () => {
    const sock = mockSock();
    let accepted;
    sock.groupAcceptInvite = async (code) => { accepted = code; return '123@g.us'; };
    const message = { key: { remoteJid: '123@s.whatsapp.net', fromMe: true }, message: { conversation: '.joingc https://chat.whatsapp.com/ABC_123' } };
    assert.equal(await menuCompatCommand(sock, '123@s.whatsapp.net', message, message.message.conversation, { isOwnerOrSudoCheck: true }), true);
    assert.equal(accepted, 'ABC_123');
    assert.match(sock.sent.at(-1).payload.text, /Successfully joined/i);
});

test('joingc returns usage instead of a provider warning when link is missing', async () => {
    const sock = mockSock();
    const message = { key: { remoteJid: '123@s.whatsapp.net', fromMe: true }, message: { conversation: '.joingc' } };
    assert.equal(await menuCompatCommand(sock, '123@s.whatsapp.net', message, '.joingc', { isOwnerOrSudoCheck: true }), true);
    assert.match(sock.sent.at(-1).payload.text, /Usage:/i);
});
