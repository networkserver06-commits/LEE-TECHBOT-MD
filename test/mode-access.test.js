'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { canProcessMessage } = require('../lib/modeAccess');

test('private mode allows ordinary group messages and commands', () => {
    assert.equal(canProcessMessage({ isPublic: false, isGroup: true, fromMe: false, isOwnerOrSudo: false }), true);
});

test('private mode is silent for ordinary private chats', () => {
    assert.equal(canProcessMessage({ isPublic: false, isGroup: false, fromMe: false, isOwnerOrSudo: false }), false);
});

test('private mode blocks every private chat, including owner and sudo DMs', () => {
    assert.equal(canProcessMessage({ isPublic: false, isGroup: false, fromMe: true, isOwnerOrSudo: false }), false);
    assert.equal(canProcessMessage({ isPublic: false, isGroup: false, fromMe: false, isOwnerOrSudo: true }), false);
});

test('public mode allows all chats', () => {
    assert.equal(canProcessMessage({ isPublic: true, isGroup: false, fromMe: false, isOwnerOrSudo: false }), true);
});
