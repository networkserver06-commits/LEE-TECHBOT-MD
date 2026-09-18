'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { canProcessMessage } = require('../lib/modeAccess');
const { normalizeMode } = require('../lib/mode');

test('mode names are normalized and validated', () => {
    assert.equal(normalizeMode('PUBLIC'), 'public');
    assert.equal(normalizeMode('group'), 'group');
    assert.equal(normalizeMode('dm'), 'dm');
    assert.equal(normalizeMode('private'), 'private');
    assert.equal(normalizeMode('owner-only'), null);
});

test('public mode allows group and private chats', () => {
    assert.equal(canProcessMessage({ mode: 'public', isGroup: true }), true);
    assert.equal(canProcessMessage({ mode: 'public', isGroup: false }), true);
});

test('group mode allows only group chats', () => {
    assert.equal(canProcessMessage({ mode: 'group', isGroup: true }), true);
    assert.equal(canProcessMessage({ mode: 'group', isGroup: false }), false);
});

test('dm mode allows only private chats', () => {
    assert.equal(canProcessMessage({ mode: 'dm', isGroup: false }), true);
    assert.equal(canProcessMessage({ mode: 'dm', isGroup: true }), false);
});

test('private mode remains a strict group-only legacy alias', () => {
    assert.equal(canProcessMessage({ mode: 'private', isGroup: true }), true);
    assert.equal(canProcessMessage({ mode: 'private', isGroup: false }), false);
});
