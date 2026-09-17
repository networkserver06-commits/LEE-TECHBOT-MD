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
    if (original === null) fs.rmSync(stateFile, { force: true }); else fs.writeFileSync(stateFile, original);
});
