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

test('togstatus publishes text directly to the current group', async () => {
    const sent = [];
    const result = await togStatus(sock(sent), '123@g.us', quotedText('Exam at 8am'), true, true);
    assert.equal(result.key !== undefined, true);
    const groupPost = sent.find((item) => item.chatId === '123@g.us' && item.payload.text === 'Exam at 8am');
    assert.ok(groupPost);
    assert.deepEqual(groupPost.payload, { text: 'Exam at 8am', backgroundColor: '#000000', font: 1 });
    assert.match(sent.at(-1).payload.text, /IAM Class/);
});

test('tostatus rejects non-owner use before reading content', async () => {
    const sent = [];
    await toStatus(sock(sent), '123@g.us', quotedText('Private'), false);
    assert.match(sent[0].payload.text, /Only the bot owner/i);
});

test('tostatus sends a valid normal-number audience list for visible Status delivery', async () => {
    const sent = [];
    await toStatus(sock(sent), '999@s.whatsapp.net', quotedText('Personal status'), true);
    const status = sent.find((item) => item.chatId === 'status@broadcast');
    assert.ok(status);
    assert.deepEqual(status.options.statusJidList, ['254700000001@s.whatsapp.net', '999@s.whatsapp.net']);
    assert.match(sent.at(-1).payload.text, /posted to your WhatsApp Status/i);
});

test('group audience requires participants', async () => {
    const emptySock = { async groupMetadata() { return { subject: 'Empty', participants: [] }; } };
    await assert.rejects(() => groupAudience(emptySock, '123@g.us'), /no participants/i);
});

test('publishStatus always targets the WhatsApp status broadcast', async () => {
    const sent = [];
    await publishStatus(sock(sent), { type: 'text', value: 'Hello' }, ['254700000001@s.whatsapp.net']);
    assert.equal(sent[0].chatId, 'status@broadcast');
    assert.deepEqual(sent[0].options.statusJidList, ['254700000001@s.whatsapp.net']);
});

test('publishStatus filters invalid LIDs from the Status audience', async () => {
    const attempts = [];
    const retrySock = {
        user: { id: '999@s.whatsapp.net' },
        async groupFetchAllParticipating() {
            return { '123@g.us': { participants: [{ id: '254700000001@s.whatsapp.net' }, { id: '12345@lid' }] } };
        },
        async sendMessage(chatId, payload, options) {
            attempts.push({ chatId, options });
        }
    };
    await publishStatus(retrySock, { type: 'text', value: 'Retry me' });
    assert.equal(attempts.length, 1);
    assert.deepEqual(attempts[0].options.statusJidList, ['254700000001@s.whatsapp.net', '999@s.whatsapp.net']);
});

test('publishStatus retries with LID recipients when PN delivery is rejected', async () => {
    const attempts = [];
    const lidSock = {
        user: { id: '999@s.whatsapp.net' },
        async groupFetchAllParticipating() {
            return { '123@g.us': { participants: [{ id: '254700000001@s.whatsapp.net' }, { id: '12345@lid' }] } };
        },
        async sendMessage(chatId, payload, options) {
            attempts.push(options.statusJidList);
            if (attempts.length === 1) throw new Error('PN audience rejected');
        }
    };
    await publishStatus(lidSock, { type: 'text', value: 'LID retry' });
    assert.deepEqual(attempts, [
        ['254700000001@s.whatsapp.net', '999@s.whatsapp.net'],
        ['12345@lid']
    ]);
});
