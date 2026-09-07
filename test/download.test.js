'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const universal = require('../commands/download');
const instagram = require('../commands/instagram');
const facebook = require('../commands/facebook');
const tiktok = require('../commands/tiktok');
const video = require('../commands/video');

test('universal downloader routes all supported platforms and subdomains', () => {
    assert.equal(universal.routeFor('https://www.instagram.com/reel/example/'), instagram);
    assert.equal(universal.routeFor('https://m.facebook.com/watch/example'), facebook);
    assert.equal(universal.routeFor('https://vm.tiktok.com/example/'), tiktok);
    assert.equal(universal.routeFor('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), video);
    assert.equal(universal.routeFor('https://music.youtube.com/watch?v=dQw4w9WgXcQ'), video);
    assert.equal(universal.routeFor('https://youtu.be/dQw4w9WgXcQ'), video);
    assert.equal(universal.routeFor('https://example.com/file.mp4'), null);
    assert.equal(universal.routeFor('javascript:alert(1)'), null);
});

test('universal downloader extracts and normalizes clean URLs from command text', () => {
    assert.equal(universal.extractUrl('.download https://youtu.be/dQw4w9WgXcQ.'), 'https://youtu.be/dQw4w9WgXcQ');
    assert.equal(universal.extractUrl('download https://www.instagram.com/p/example/'), 'https://www.instagram.com/p/example/');
    assert.equal(universal.extractUrl('download https://youtu.be/dQw4w9WgXcQ?si=abc).'), 'https://youtu.be/dQw4w9WgXcQ?si=abc');
    assert.equal(universal.extractUrl('.download not-a-url'), '');
});

test('universal downloader reads captions as well as text messages', () => {
    assert.equal(universal.messageText({ message: { imageMessage: { caption: '.download https://youtu.be/dQw4w9WgXcQ' } } }), '.download https://youtu.be/dQw4w9WgXcQ');
});
