'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveModerationTarget } = require('../lib/moderationTarget');

function dmMessage(text = '') {
    return {
        key: {
            remoteJid: '254700000000@s.whatsapp.net',
            fromMe: true
        },
        message: { conversation: text }
    };
}

test('owner DM resolves a numbered group and removes only the selector', async () => {
    const sock = {
        user: { id: '254700000000000:1@s.whatsapp.net' },
        groupFetchAllParticipating: async () => ({
            '120363000000000001@g.us': {
                subject: 'Announcements',
                participants: [
                    { id: '254700000000001@s.whatsapp.net', admin: 'admin' },
                    { id: '254700000000000@s.whatsapp.net', admin: 'admin' }
                ]
            }
        })
    };

    const result = await resolveModerationTarget(sock, {
        chatId: '254700000000000@s.whatsapp.net',
        message: dmMessage('.antibot 1 on'),
        userMessage: '.antibot 1 on',
        command: '.antibot'
    });

    assert.equal(result.ok, true);
    assert.equal(result.chatId, '120363000000000001@g.us');
    assert.equal(result.userMessage, '.antibot on');
    assert.equal(result.isRemote, true);
    assert.equal(result.isGroup, true);
    assert.equal(result.isSenderAdmin, true);
    assert.equal(result.isBotAdmin, true);
});

test('owner DM accepts a full group JID and reports an invalid target', async () => {
    const sock = {
        user: { id: '254700000000:1@s.whatsapp.net' },
        groupFetchAllParticipating: async () => ({
            '120363000000000002@g.us': { subject: 'Support', participants: [] }
        })
    };

    const valid = await resolveModerationTarget(sock, {
        chatId: '254700000000000@s.whatsapp.net',
        message: dmMessage('.antiall 120363000000000002@g.us status'),
        userMessage: '.antiall 120363000000000002@g.us status',
        command: '.antiall'
    });
    assert.equal(valid.ok, true);
    assert.equal(valid.chatId, '120363000000000002@g.us');
    assert.equal(valid.userMessage, '.antiall status');
    assert.equal(valid.isBotAdmin, false);

    const invalid = await resolveModerationTarget(sock, {
        chatId: '254700000000000@s.whatsapp.net',
        message: dmMessage('.antiall 9 on'),
        userMessage: '.antiall 9 on',
        command: '.antiall'
    });
    assert.equal(invalid.ok, false);
    assert.match(invalid.error, /No group matches number 9/);
});

test('non-owner DM cannot select a moderation group', async () => {
    const sock = { groupFetchAllParticipating: async () => ({}) };
    const result = await resolveModerationTarget(sock, {
        chatId: '254711111111@s.whatsapp.net',
        message: {
            key: { remoteJid: '254711111111@s.whatsapp.net', fromMe: false },
            message: { conversation: '.antispam 1 on' }
        },
        userMessage: '.antispam 1 on',
        command: '.antispam'
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /linked bot owner or sudo/);
});
