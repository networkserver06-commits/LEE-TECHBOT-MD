'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { handleChatbotCommand } = require('../commands/chatbot');

const stateFile = path.join(process.cwd(), 'data', 'userGroupData.json');

test('owner DM can enable chatbot for a numbered group', async () => {
    const original = fs.existsSync(stateFile) ? fs.readFileSync(stateFile) : null;
    const sent = [];
    const sock = {
        async groupFetchAllParticipating() {
            return { '123@g.us': { subject: 'Target Group', participants: [] } };
        },
        async sendMessage(chatId, payload) { sent.push({ chatId, payload }); }
    };
    const message = { key: { remoteJid: '999@s.whatsapp.net' }, message: { conversation: '.chatbot 1 on' } };
    await handleChatbotCommand(sock, '999@s.whatsapp.net', message, '1 on', { isOwnerDm: true });
    assert.equal(sent.at(-1).chatId, '999@s.whatsapp.net');
    assert.match(sent.at(-1).payload.text, /turned \*ON\*/i);
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.equal(data.chatbot['123@g.us'].enabled, true);
    assert.ok(sent.some((item) => item.payload.react?.text === '✅'));
    if (original === null) fs.rmSync(stateFile, { force: true }); else fs.writeFileSync(stateFile, original);
});

test('owner DM chatbot status lists every participating group', async () => {
    const original = fs.existsSync(stateFile) ? fs.readFileSync(stateFile) : null;
    fs.writeFileSync(stateFile, JSON.stringify({ chatbot: { '123@g.us': { enabled: true } } }));
    const sent = [];
    const sock = {
        async groupFetchAllParticipating() {
            return {
                '123@g.us': { subject: 'Enabled Group', participants: [] },
                '456@g.us': { subject: 'Disabled Group', participants: [] }
            };
        },
        async sendMessage(chatId, payload) { sent.push({ chatId, payload }); }
    };
    const message = { key: { remoteJid: '999@s.whatsapp.net' }, message: { conversation: '.chatbot status' } };
    await handleChatbotCommand(sock, '999@s.whatsapp.net', message, 'status', { isOwnerDm: true });
    assert.match(sent.at(-1).payload.text, /Enabled Group/);
    assert.match(sent.at(-1).payload.text, /Disabled Group/);
    assert.match(sent.at(-1).payload.text, /ON/);
    assert.match(sent.at(-1).payload.text, /OFF/);
    if (original === null) fs.rmSync(stateFile, { force: true }); else fs.writeFileSync(stateFile, original);
});

test('owner can enable chatbot replies in their own DM', async () => {
    const original = fs.existsSync(stateFile) ? fs.readFileSync(stateFile) : null;
    const sent = [];
    const sock = { async sendMessage(chatId, payload) { sent.push({ chatId, payload }); } };
    const message = { key: { remoteJid: '999@s.whatsapp.net' }, message: { conversation: '.chatbot DM on' } };
    await handleChatbotCommand(sock, '999@s.whatsapp.net', message, 'DM on', { isOwnerDm: true });
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.equal(data.chatbot['999@s.whatsapp.net'].enabled, true);
    assert.match(sent.at(-1).payload.text, /DM chatbot turned \*ON\*/i);
    if (original === null) fs.rmSync(stateFile, { force: true }); else fs.writeFileSync(stateFile, original);
});

test('owner can enable chatbot replies for contact DMs', async () => {
    const original = fs.existsSync(stateFile) ? fs.readFileSync(stateFile) : null;
    const sent = [];
    const sock = { async sendMessage(chatId, payload) { sent.push({ chatId, payload }); } };
    const message = { key: { remoteJid: '999@s.whatsapp.net' }, message: { conversation: '.chatbot contacts on' } };
    await handleChatbotCommand(sock, '999@s.whatsapp.net', message, 'contacts on', { isOwnerDm: true });
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.equal(data.chatbotContacts, true);
    assert.match(sent.at(-1).payload.text, /Contact chatbot turned \*ON\*/i);
    if (original === null) fs.rmSync(stateFile, { force: true }); else fs.writeFileSync(stateFile, original);
});
