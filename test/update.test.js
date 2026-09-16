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

test('runtime settings are treated as preserved paths', () => {
    assert.equal(updater.isPreservedPath('.env'), true);
    assert.equal(updater.isPreservedPath('env'), true);
    assert.equal(updater.isPreservedPath('config.env'), true);
    assert.equal(updater.isPreservedPath('data/userGroupData.json'), true);
    assert.equal(updater.isPreservedPath('session/creds.json'), true);
    assert.equal(updater.isPreservedPath('commands/update.js'), false);
});

test('preservation snapshot can be created and restored safely', () => {
    const snapshot = updater.snapshotPreservedFiles();
    assert.ok(snapshot.snapshotRoot);
    assert.ok(Array.isArray(snapshot.copied));
    assert.ok(snapshot.copied.includes('.env') || snapshot.copied.includes('data/'));
    assert.doesNotThrow(() => updater.restorePreservedFiles(snapshot));
    assert.doesNotThrow(() => updater.restorePreservedFiles(snapshot));
});
