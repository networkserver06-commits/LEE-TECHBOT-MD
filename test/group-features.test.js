'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { menuCompatCommand } = require('../commands/menuCompat');
const kickCommand = require('../commands/kick');

const stateFile = path.join(process.cwd(), 'data', 'groupFeatures.json');
function mockSock(sent) {
    return {
        user: { id: '999@s.whatsapp.net' },
        async groupMetadata() {
            return {
                id: '123@g.us', subject: 'Test Group', desc: 'Test description',
                participants: [
                    { id: '999@s.whatsapp.net', admin: 'superadmin' },
                    { id: '111@s.whatsapp.net', admin: 'admin' }
                ]
            };
        },
        async groupParticipantsUpdate(chatId, jids, action) { sent.push({ chatId, jids, action }); },
        async sendMessage(chatId, payload) { sent.push(payload); return { key: {} }; }
    };
}
function message(text = '') {
    return { key: { remoteJid: '123@g.us', participant: '999@s.whatsapp.net' }, message: { conversation: text } };
}

test('all remaining catalog group commands use concrete handlers', async () => {
    const commands = [
        ['addall', '254700000001'],
        ['unwarn', ''], ['antistatus', 'status'], ['gcalert', 'status'],
        ['addmetaai', ''], ['removemetaai', ''], ['opentime', 'status'], ['closetime', 'status']
    ];
    for (const [command, args] of commands) {
        const sent = [];
        const sock = mockSock(sent);
        const input = `.${command}${args ? ` ${args}` : ''}`;
        const handled = await menuCompatCommand(sock, '123@g.us', message(input), input, {
            isGroup: true, isSenderAdmin: true, isBotAdmin: true, isOwnerOrSudoCheck: true,
            senderId: '999@s.whatsapp.net'
        });
        assert.equal(handled, true, command);
        assert.ok(sent.length > 0, command);
        assert.doesNotMatch(sent.at(-1).text || '', /handler is not available/i, command);
    }
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
});

test('open and close commands accept relative durations', async () => {
    for (const command of ['opentime', 'closetime']) {
        const sent = [];
        const sock = mockSock(sent);
        const input = `.${command} 5 min`;
        await menuCompatCommand(sock, '123@g.us', message(input), input, {
            isGroup: true, isSenderAdmin: true, isBotAdmin: true, isOwnerOrSudoCheck: true,
            senderId: '999@s.whatsapp.net'
        });
        assert.match(sent.at(-1).text, /timer set for \*5 mins?\*/i);
    }
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
});

test('.out removes a mentioned member and uses removal wording', async () => {
    const sent = [];
    const removals = [];
    const sock = mockSock(sent);
    sock.groupParticipantsUpdate = async (chatId, ids, action) => removals.push({ chatId, ids, action });
    const target = '222@s.whatsapp.net';
    await kickCommand(sock, '123@g.us', '999@s.whatsapp.net', [target], {
        key: { remoteJid: '123@g.us', fromMe: true },
        message: { extendedTextMessage: { contextInfo: { mentionedJid: [target] } } }
    }, 'out');
    assert.deepEqual(removals, [{ chatId: '123@g.us', ids: [target], action: 'remove' }]);
    assert.match(sent.at(-1).text, /removed successfully/i);
});

test('.out refuses to remove the bot itself', async () => {
    const sent = [];
    const removals = [];
    const sock = mockSock(sent);
    sock.groupParticipantsUpdate = async (chatId, ids, action) => removals.push({ chatId, ids, action });
    await kickCommand(sock, '123@g.us', '999@s.whatsapp.net', ['999@s.whatsapp.net'], {
        key: { remoteJid: '123@g.us', fromMe: true },
        message: { extendedTextMessage: { contextInfo: { mentionedJid: ['999@s.whatsapp.net'] } } }
    }, 'out');
    assert.equal(removals.length, 0);
    assert.match(sent.at(-1).text, /can't out myself/i);
});
