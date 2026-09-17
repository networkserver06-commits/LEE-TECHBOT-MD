'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getCommandContent, groupAudience, publishStatus } = require('../lib/status');
const toStatus = require('../commands/tostatus');
const togStatus = require('../commands/togstatus');

function quotedText(text) {
    return {
        message: {
            extendedTextMessage: {
                text: '.tostatus',
                contextInfo: { quotedMessage: { conversation: text } }
            }
        }
    };
}

function directImage() {
    return { message: { imageMessage: { url: 'https://example.invalid/image', caption: '.tostatus' } } };
}

function sock(sent) {
    return {
        user: { id: '999@s.whatsapp.net' },
        async groupMetadata() {
            return { subject: 'IAM Class', participants: [
                { id: '999@s.whatsapp.net', admin: 'superadmin' },
                { id: '254700000001@s.whatsapp.net', admin: null }
            ] };
        },
        async groupFetchAllParticipating() {
            return { '123@g.us': { participants: [{ id: '254700000001@s.whatsapp.net' }] } };
        },
        async sendMessage(chatId, payload, options) {
            sent.push({ chatId, payload, options });
            return { key: {} };
        }
    };
}

test('status content accepts quoted text and directly captioned media', () => {
    assert.deepEqual(getCommandContent(quotedText('Exam at 8am')), { type: 'text', value: 'Exam at 8am' });
    assert.equal(getCommandContent(directImage()).type, 'image');
});

test('togstatus publishes text to all usable group recipients', async () => {
    const sent = [];
    const result = await togStatus(sock(sent), '123@g.us', quotedText('Exam at 8am'), true, true);
    assert.equal(result.key !== undefined, true);
    const status = sent.find((item) => item.chatId === 'status@broadcast');
    assert.ok(status);
    assert.deepEqual(status.payload, { text: 'Exam at 8am', backgroundColor: '#000000', font: 1 });
    assert.deepEqual(status.options.statusJidList, ['999@s.whatsapp.net', '254700000001@s.whatsapp.net']);
    assert.match(sent.at(-1).payload.text, /IAM Class/);
});

test('tostatus rejects non-owner use before reading content', async () => {
    const sent = [];
    await toStatus(sock(sent), '123@g.us', quotedText('Private'), false);
    assert.match(sent[0].payload.text, /Only the bot owner/i);
});

test('group audience requires participants', async () => {
    const emptySock = { async groupMetadata() { return { subject: 'Empty', participants: [] }; } };
    await assert.rejects(() => groupAudience(emptySock, '123@g.us'), /no participants/i);
});

test('publishStatus always targets the WhatsApp status broadcast', async () => {
    const sent = [];
    await publishStatus(sock(sent), { type: 'text', value: 'Hello' }, ['254700000001@s.whatsapp.net']);
    assert.equal(sent[0].chatId, 'status@broadcast');
    assert.equal(sent[0].options.broadcast, true);
});
