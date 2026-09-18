'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { canProcessMessage } = require('../lib/modeAccess');
const { normalizeMode } = require('../lib/mode');

const access = (mode, isGroup, isOwnerOrSudo = false) => canProcessMessage({ mode, isGroup, isOwnerOrSudo });

test('mode names are normalized and validated', () => {
    assert.equal(normalizeMode('PUBLIC'), 'public');
    assert.equal(normalizeMode('group'), 'group');
    assert.equal(normalizeMode('dm'), 'dm');
    assert.equal(normalizeMode('private'), 'private');
    assert.equal(normalizeMode('owner-only'), null);
});

test('public mode allows all commands in groups and DMs', () => {
    assert.equal(access('public', true), true);
    assert.equal(access('public', false), true);
});

test('private mode allows all commands only for owner, sudo, or developer', () => {
    assert.equal(access('private', true, true), true);
    assert.equal(access('private', false, true), true);
    assert.equal(access('private', true, false), false);
    assert.equal(access('private', false, false), false);
});

test('dm mode allows all commands for everyone only in DMs', () => {
    assert.equal(access('dm', false), true);
    assert.equal(access('dm', true), false);
});

test('group mode allows all commands for everyone only in groups', () => {
    assert.equal(access('group', true), true);
    assert.equal(access('group', false), false);
});
