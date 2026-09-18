'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('dispatcher guards null and non-notify updates before reading messages', () => {
    assert.match(source, /const \{ messages, type \} = messageUpdate \|\| \{\}/);
    assert.match(source, /const message = Array\.isArray\(messages\) \? messages\[0\] : null/);
});

test('dispatcher ignores messages without a valid remote JID', () => {
    assert.match(source, /typeof message\.key\?\.remoteJid !== 'string' \|\| !message\.key\.remoteJid/);
});

test('dispatcher normalizes non-string message text safely', () => {
    assert.match(source, /let userMessage = String\(extractedText\)/);
    assert.match(source, /const rawText = String\(message\.message\?\.conversation/);
});

test('owner command routes call the imported handlers', () => {
    assert.match(source, /await creategroupCommand\(sock, chatId, message, isOwnerOrSudoCheck, groupName\)/);
    assert.match(source, /await decryptCommand\(sock, chatId, message, isOwnerOrSudoCheck, decryptArgs\)/);
    assert.match(source, /await handleTicTacToeMove\(sock, chatId, senderId, String\(position\)\)/);
    assert.doesNotMatch(source, /\bcreateGroupCommand\(/);
    assert.doesNotMatch(source, /\bdecrypt\(/);
    assert.doesNotMatch(source, /\btictactoeMove\(/);
});

test('tic-tac-toe move route validates positions before dispatch', () => {
    assert.match(source, /!Number\.isInteger\(position\) \|\| position < 1 \|\| position > 9/);
});
