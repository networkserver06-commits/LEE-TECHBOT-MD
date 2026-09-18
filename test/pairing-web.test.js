'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createPairingWebServer } = require('../lib/pairingWeb');

function request(server, method, route, body, headers = {}) {
    const address = server.address();
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port: address.port, path: route, method, headers: { ...headers, 'content-type': 'application/json' } }, (res) => {
            let text = '';
            res.on('data', (chunk) => { text += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: text ? JSON.parse(text) : null }));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function cookieFrom(response) {
    return response.headers['set-cookie']?.[0]?.split(';')[0] || '';
}

async function startServer(options = {}) {
    const authDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lee-pairing-test-'));
    const server = createPairingWebServer({ host: '127.0.0.1', port: 0, authDir, logger: { log() {}, error() {}, warn() {} }, ...options });
    await new Promise((resolve) => server.once('listening', resolve));
    return { server, authDir };
}

async function closeServer(server, authDir) {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(authDir, { recursive: true, force: true });
}

test('first open requires password creation before status or pairing', async () => {
    const socket = { authState: { creds: { registered: false } }, __pairingReady: true, async requestPairingCode() { return 'ABCDEFGH'; } };
    const { server, authDir } = await startServer({ getSocket: () => socket });
    try {
        const statusBefore = await request(server, 'GET', '/api/status');
        assert.equal(statusBefore.status, 401);
        const pairingBefore = await request(server, 'POST', '/api/pairing-code', { phoneNumber: '254700000000' });
        assert.equal(pairingBefore.status, 401);

        const weak = await request(server, 'POST', '/api/auth', { password: 'short', confirmPassword: 'short' });
        assert.equal(weak.status, 400);
        const mismatch = await request(server, 'POST', '/api/auth', { password: 'secure-pass-1', confirmPassword: 'secure-pass-2' });
        assert.equal(mismatch.status, 400);

        const created = await request(server, 'POST', '/api/auth', { password: 'secure-pass-1', confirmPassword: 'secure-pass-1' });
        assert.equal(created.status, 200);
        assert.equal(created.body.created, true);
        assert.match(created.headers['set-cookie']?.[0] || '', /HttpOnly/);
        const passwordFile = path.join(authDir, '.pairing-web-password.json');
        assert.equal(fs.existsSync(passwordFile), true);
        const stored = JSON.parse(fs.readFileSync(passwordFile, 'utf8'));
        assert.equal(stored.algorithm, 'scrypt');
        assert.notEqual(stored.hash, 'secure-pass-1');
        assert.equal(stored.hash.length, 128);
        assert.equal((fs.statSync(passwordFile).mode & 0o777), 0o600);

        const cookie = cookieFrom(created);
        const health = await request(server, 'GET', '/health', null, { cookie });
        assert.equal(health.status, 200);
        const result = await request(server, 'POST', '/api/pairing-code', { phoneNumber: '254700000000' }, { cookie });
        assert.equal(result.status, 200);
        assert.equal(result.body.code, 'ABCD-EFGH');
    } finally {
        await closeServer(server, authDir);
    }
});

test('stored password must be supplied on later opens', async () => {
    const authDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lee-pairing-persist-'));
    const first = createPairingWebServer({ host: '127.0.0.1', port: 0, authDir, logger: { log() {}, error() {}, warn() {} } });
    await new Promise((resolve) => first.once('listening', resolve));
    const created = await request(first, 'POST', '/api/auth', { password: 'persistent-pass', confirmPassword: 'persistent-pass' });
    await new Promise((resolve) => first.close(resolve));

    const second = createPairingWebServer({ host: '127.0.0.1', port: 0, authDir, logger: { log() {}, error() {}, warn() {} } });
    await new Promise((resolve) => second.once('listening', resolve));
    try {
        const wrong = await request(second, 'POST', '/api/auth', { password: 'wrong-pass', confirmPassword: '' });
        assert.equal(wrong.status, 401);
        const accepted = await request(second, 'POST', '/api/auth', { password: 'persistent-pass', confirmPassword: '' });
        assert.equal(accepted.status, 200);
        assert.equal(accepted.body.created, false);
        assert.notEqual(cookieFrom(created), cookieFrom(accepted));
    } finally {
        await closeServer(second, authDir);
    }
});

test('pairing website serves authenticated health and generates a code', async () => {
    const socket = { authState: { creds: { registered: false } }, __pairingReady: true, async requestPairingCode() { return 'ABCDEFGH'; } };
    const { server, authDir } = await startServer({ getSocket: () => socket });
    try {
        const auth = await request(server, 'POST', '/api/auth', { password: 'secure-pass', confirmPassword: 'secure-pass' });
        const cookie = cookieFrom(auth);
        const health = await request(server, 'GET', '/health', null, { cookie });
        assert.equal(health.status, 200);
        assert.equal(health.body.ok, true);
        const result = await request(server, 'POST', '/api/pairing-code', { phoneNumber: '254700000000' }, { cookie });
        assert.equal(result.status, 200);
        assert.equal(result.body.code, 'ABCD-EFGH');
        server.clearWebSessions('test disconnect', true);
        const afterDisconnect = await request(server, 'GET', '/api/status', null, { cookie });
        assert.equal(afterDisconnect.status, 401);
        assert.equal(fs.existsSync(path.join(authDir, '.pairing-web-password.json')), false);
        const newPassword = await request(server, 'POST', '/api/auth', { password: 'new-secure-pass', confirmPassword: 'new-secure-pass' });
        assert.equal(newPassword.status, 200);
        assert.equal(newPassword.body.created, true);
    } finally {
        await closeServer(server, authDir);
    }
});

test('public pairing website can bind for a host proxy without crashing', async () => {
    const { server, authDir } = await startServer({ host: '0.0.0.0' });
    assert.ok(server.address().port > 0);
    await closeServer(server, authDir);
});

test('connected account gets a live dashboard after authentication', async () => {
    const socket = {
        authState: { creds: { registered: true } },
        ws: { readyState: 1 },
        user: { id: '254700000000:1@s.whatsapp.net', name: 'Connected Bot' }
    };
    const { server, authDir } = await startServer({ getSocket: () => socket });
    try {
        const auth = await request(server, 'POST', '/api/auth', { password: 'secure-pass', confirmPassword: 'secure-pass' });
        const cookie = cookieFrom(auth);
        const status = await request(server, 'GET', '/api/status', null, { cookie });
        assert.deepEqual(status.body, { connected: true, registered: true, state: 'connected', name: 'Connected Bot', number: '254700000000' });
    } finally {
        await closeServer(server, authDir);
    }
});
