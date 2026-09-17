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
