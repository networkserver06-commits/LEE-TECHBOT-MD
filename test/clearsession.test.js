'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const clearSessionCommand = require('../commands/clearsession');

function message() {
    return { key: { remoteJid: '999@s.whatsapp.net', fromMe: true } };
}

test('clearsession refuses to delete cryptographic keys on a live socket', async () => {
    const originalAuthDir = process.env.AUTH_DIR;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lee-session-'));
    process.env.AUTH_DIR = dir;
    fs.writeFileSync(path.join(dir, 'creds.json'), '{}');
    fs.writeFileSync(path.join(dir, 'pre-key-1'), 'key');
    const sent = [];
    const sock = {
        user: { id: '254700000111:1@s.whatsapp.net' },
        authState: { creds: { registered: true } },
        async sendMessage(chatId, payload) { sent.push(payload.text); }
    };
    await clearSessionCommand(sock, '999@s.whatsapp.net', message());
    assert.equal(fs.existsSync(path.join(dir, 'pre-key-1')), true);
    assert.match(sent.at(-1), /Waiting for this message/i);
    fs.rmSync(dir, { recursive: true, force: true });
    if (originalAuthDir === undefined) delete process.env.AUTH_DIR; else process.env.AUTH_DIR = originalAuthDir;
});

test('clearsession uses AUTH_DIR and removes only stale temporary files offline', async () => {
    const originalAuthDir = process.env.AUTH_DIR;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lee-session-'));
    process.env.AUTH_DIR = dir;
    fs.writeFileSync(path.join(dir, 'creds.json'), '{}');
    fs.writeFileSync(path.join(dir, 'pre-key-1'), 'key');
    fs.writeFileSync(path.join(dir, 'stale.tmp'), 'temporary');
    const sent = [];
    const sock = { async sendMessage(chatId, payload) { sent.push(payload.text); } };
    await clearSessionCommand(sock, '999@s.whatsapp.net', message());
    assert.equal(fs.existsSync(path.join(dir, 'creds.json')), true);
    assert.equal(fs.existsSync(path.join(dir, 'pre-key-1')), true);
    assert.equal(fs.existsSync(path.join(dir, 'stale.tmp')), false);
    assert.match(sent.at(-1), /Signal keys preserved: yes/i);
    fs.rmSync(dir, { recursive: true, force: true });
    if (originalAuthDir === undefined) delete process.env.AUTH_DIR; else process.env.AUTH_DIR = originalAuthDir;
});
