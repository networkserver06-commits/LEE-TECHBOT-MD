'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isSelfChat, selfChatSendOptions } = require('../lib/selfChat');

test('detects the bot account self-chat and removes only the quote', () => {
    const sock = { user: { id: '254700000111:7@s.whatsapp.net', lid: '99887766:0@lid' } };
    assert.equal(isSelfChat(sock, '254700000111@s.whatsapp.net'), true);
    assert.equal(isSelfChat(sock, '99887766:3@lid'), true);
    assert.equal(isSelfChat(sock, '254700000222@s.whatsapp.net'), false);
    assert.equal(isSelfChat(sock, '123@g.us'), false);
    const prepared = selfChatSendOptions(sock, '254700000111:2@s.whatsapp.net', { quoted: { key: { id: 'x' } }, ephemeralExpiration: 0 });
    assert.equal(prepared.jid, '254700000111@s.whatsapp.net');
    assert.equal(prepared.options.quoted, undefined);
    assert.equal(prepared.options.ephemeralExpiration, 0);
});

test('leaves ordinary contact and group sends unchanged', () => {
    const sock = { user: { id: '254700000111@s.whatsapp.net' } };
    const options = { quoted: { key: { id: 'x' } } };
    assert.deepEqual(selfChatSendOptions(sock, '254700000222@s.whatsapp.net', options), { jid: '254700000222@s.whatsapp.net', options });
    assert.deepEqual(selfChatSendOptions(sock, '123@g.us', options), { jid: '123@g.us', options });
});
