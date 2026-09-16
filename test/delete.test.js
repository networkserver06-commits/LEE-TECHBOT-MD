'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const deleteCommand = require('../commands/delete');

test('users can delete one of their own quoted messages without admin checks', async () => {
    const sent = [];
    const sock = {
        async sendMessage(chatId, payload) { sent.push({ chatId, payload }); }
    };
    const message = {
        key: { id: 'delete-command', remoteJid: 'group@g.us' },
        message: {
            extendedTextMessage: {
                text: '.del',
                contextInfo: {
                    stanzaId: 'own-message-id',
                    participant: '254700000000@s.whatsapp.net',
                    quotedMessage: { conversation: 'my message' }
                }
            }
        }
    };

    await deleteCommand(sock, 'group@g.us', message, '254700000000@s.whatsapp.net');

    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].payload.delete, {
        remoteJid: 'group@g.us',
        fromMe: true,
        id: 'own-message-id'
    });
});
