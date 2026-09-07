'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const updater = require('../commands/update');

test('updater accepts HTTPS URLs and rejects unsafe schemes', () => {
    assert.equal(updater.isSafeUpdateUrl('https://github.com/example/repo/archive/main.zip'), true);
    assert.equal(updater.isSafeUpdateUrl('http://github.com/example/repo/archive/main.zip'), false);
    assert.equal(updater.isSafeUpdateUrl('file:///tmp/update.zip'), false);
    assert.equal(updater.isSafeUpdateUrl('not a URL'), false);
});

test('updater exposes safe helper APIs', () => {
    assert.equal(typeof updater.downloadFile, 'function');
    assert.equal(typeof updater.updateViaGit, 'function');
    assert.equal(typeof updater.updateViaZip, 'function');
});

test('archive safety allows the destination root but rejects traversal', () => {
    assert.doesNotThrow(() => updater.assertInside('/tmp/update-root', '/tmp/update-root'));
    assert.doesNotThrow(() => updater.assertInside('/tmp/update-root', '/tmp/update-root/project/file.js'));
    assert.throws(() => updater.assertInside('/tmp/update-root', '/tmp/update-root/../outside'));
});
