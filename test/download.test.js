'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const universal = require('../commands/download');
const instagram = require('../commands/instagram');
const facebook = require('../commands/facebook');
const tiktok = require('../commands/tiktok');
const video = require('../commands/video');
const social = require('../commands/social');

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

test('universal downloader routes additional social platforms to the generic handler', () => {
    for (const url of [
        'https://x.com/user/status/123',
        'https://twitter.com/user/status/123',
        'https://www.reddit.com/r/videos/comments/example/post',
        'https://pin.it/example',
        'https://www.pinterest.com/pin/example/',
        'https://www.threads.net/@user/post/example',
        'https://www.snapchat.com/spotlight/example'
    ]) assert.equal(universal.routeFor(url), social, url);
});

test('generic social media extraction only accepts media URLs and deduplicates them', () => {
    const media = social.collectMedia({
        video: { url: 'https://cdn.example/video.mp4' },
        duplicate: 'https://cdn.example/video.mp4',
        image: { url: 'https://cdn.example/image.jpg' },
        page: 'https://example.com/not-media'
    });
    assert.deepEqual(media.map(item => item.url), [
        'https://cdn.example/video.mp4',
        'https://cdn.example/image.jpg'
    ]);
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
