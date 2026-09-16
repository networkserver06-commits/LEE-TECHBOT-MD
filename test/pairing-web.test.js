'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { createPairingWebServer } = require('../lib/pairingWeb');

function request(server, method, route, body, headers = {}) {
    const address = server.address();
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port: address.port, path: route, method, headers: { ...headers, 'content-type': 'application/json' } }, (res) => {
            let text = '';
            res.on('data', (chunk) => { text += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

test('pairing website serves health and generates a code through the socket', async () => {
    const socket = { authState: { creds: { registered: false } }, __pairingReady: true, async requestPairingCode() { return 'ABCDEFGH'; } };
    const server = createPairingWebServer({ host: '127.0.0.1', port: 0, getSocket: () => socket, logger: { log() {}, error() {} } });
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        const health = await request(server, 'GET', '/health');
        assert.equal(health.status, 200);
        assert.equal(health.body.ok, true);
        const page = await new Promise((resolve, reject) => {
            http.get(`http://127.0.0.1:${server.address().port}/`, (res) => { let text = ''; res.on('data', (chunk) => { text += chunk; }); res.on('end', () => resolve({ status: res.statusCode, text })); }).on('error', reject);
        });
        assert.equal(page.status, 200);
        assert.match(page.text, /Generate pairing code/);
        assert.match(page.text, /Copy code/);
        const result = await request(server, 'POST', '/api/pairing-code', { phoneNumber: '254700000000' });
        assert.equal(result.status, 200);
        assert.equal(result.body.code, 'ABCD-EFGH');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('public pairing website can bind for a host proxy without crashing', async () => {
    const server = createPairingWebServer({ host: '0.0.0.0', port: 0, logger: { warn() {}, log() {}, error() {} } });
    await new Promise((resolve) => server.once('listening', resolve));
    assert.ok(server.address().port > 0);
    await new Promise((resolve) => server.close(resolve));
});

test('connected account gets a live dashboard instead of the pairing page', async () => {
    const socket = {
        authState: { creds: { registered: true } },
        ws: { readyState: 1 },
        user: { id: '254700000000:1@s.whatsapp.net', name: 'Connected Bot' }
    };
    const server = createPairingWebServer({ host: '127.0.0.1', port: 0, getSocket: () => socket, logger: { log() {}, error() {} } });
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        const status = await request(server, 'GET', '/api/status');
        assert.deepEqual(status.body, { connected: true, registered: true, state: 'connected', name: 'Connected Bot', number: '254700000000' });
        const page = await new Promise((resolve, reject) => {
            http.get(`http://127.0.0.1:${server.address().port}/`, (res) => { let text = ''; res.on('data', (chunk) => { text += chunk; }); res.on('end', () => resolve({ status: res.statusCode, text })); }).on('error', reject);
        });
        assert.equal(page.status, 200);
        assert.match(page.text, /WhatsApp connected/);
        assert.match(page.text, /Connected Bot/);
        assert.doesNotMatch(page.text, /Generate pairing code/);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
