'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const song = require('../commands/song');

test('play query removes the command prefix before searching', () => {
    assert.equal(song.normalizePlayQuery('.play Sauti Sol Suzanna'), 'Sauti Sol Suzanna');
    assert.equal(song.normalizePlayQuery('.song Bien Kenya'), 'Bien Kenya');
});

test('music search uses the exact user query without regional expansion', () => {
    assert.deepEqual(song.buildSearchQueries('latest love song'), ['latest love song']);
    assert.deepEqual(song.buildSearchQueries('Sauti Sol Suzanna'), ['Sauti Sol Suzanna']);
});

test('official results rank ahead of generic covers and instrumentals', () => {
    const ranked = song.rankMusicResults([
        { url: 'generic', title: 'Suzanna Cover Karaoke', author: { name: 'Random Channel' } },
        { url: 'kenya', title: 'Sauti Sol - Suzanna (Official Audio)', author: { name: 'Sauti Sol' } }
    ], 'Suzanna');
    assert.equal(ranked[0].url, 'kenya');
});

test('song handler no longer contains an image thumbnail message', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'commands', 'song.js'), 'utf8');
    assert.doesNotMatch(source, /image:\s*\{\s*url:\s*video\.thumbnail/);
    assert.match(source, /audio:\s*finalBuffer/);
});
