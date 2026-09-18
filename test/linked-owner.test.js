'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const isOwnerOrSudo = require('../lib/isOwner');

test('the currently linked WhatsApp phone identity is owner-authorized', async () => {
    const sock = { user: { id: '254799000111:7@s.whatsapp.net' } };
    assert.equal(await isOwnerOrSudo('254799000111@s.whatsapp.net', sock, '123@s.whatsapp.net'), true);
});

test('the currently linked WhatsApp identity works for group LID messages', async () => {
    const sock = { user: { id: '254799000112:7@s.whatsapp.net', lid: '99887766:0@lid' } };
    assert.equal(await isOwnerOrSudo('99887766:4@lid', sock, '123@g.us'), true);
});

test('the auth credential identity authorizes private-mode commands', async () => {
    const sock = { authState: { creds: { me: { id: '254799000114:2@s.whatsapp.net' } } } };
    assert.equal(await isOwnerOrSudo('254799000114@s.whatsapp.net', sock, '254799000114@s.whatsapp.net'), true);
});

test('an unrelated sender is not authorized by linked-account matching', async () => {
    const sock = { user: { id: '254799000113:7@s.whatsapp.net' } };
    assert.equal(await isOwnerOrSudo('254700000999@s.whatsapp.net', sock, '123@s.whatsapp.net'), false);
});
