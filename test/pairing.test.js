'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { formatPairingCode, isTransientPairingError, isQrRefsExpired, requestPairingCodeWithRetry } = require('../lib/pairing');

test('formats WhatsApp pairing codes in four-character groups', () => {
    assert.equal(formatPairingCode('ABCDEFGH'), 'ABCD-EFGH');
    assert.equal(formatPairingCode('123456'), '1234-56');
});

test('recognizes Baileys 428 connection closures as transient', () => {
    assert.equal(isTransientPairingError({ output: { statusCode: 428 }, message: 'Connection Closed' }), true);
    assert.equal(isTransientPairingError(new Error('Precondition Required')), true);
    assert.equal(isTransientPairingError({ output: { statusCode: 401 }, message: 'logged out' }), false);
});

test('recognizes expired QR reference pools separately from ordinary disconnects', () => {
    assert.equal(isQrRefsExpired({ output: { statusCode: 408 }, message: 'QR refs attempts ended' }), true);
    assert.equal(isTransientPairingError({ output: { statusCode: 408 }, message: 'QR refs attempts ended' }), true);
    assert.equal(isQrRefsExpired(new Error('Connection Closed')), false);
});

test('retries a transient pairing failure and returns the generated code', async () => {
    let calls = 0;
    const socket = {
        authState: { creds: { registered: false } },
        async requestPairingCode() {
            calls += 1;
            if (calls === 1) throw { output: { statusCode: 428 }, message: 'Connection Closed' };
            return 'ABCDEFGH';
        }
    };
    const code = await requestPairingCodeWithRetry({ socket, phoneNumber: '254700000000', retryDelayMs: 1, logger: { log() {} } });
    assert.equal(code, 'ABCD-EFGH');
    assert.equal(calls, 2);
});

test('uses a fresh active socket after the original socket closes', async () => {
    let current;
    const first = {
        authState: { creds: { registered: false } },
        async requestPairingCode() { throw { output: { statusCode: 428 }, message: 'Connection Closed' }; }
    };
    const second = {
        authState: { creds: { registered: false } },
        async requestPairingCode() { return 'IJKL5678'; }
    };
    current = first;
    setTimeout(() => { current = second; }, 10);
    const code = await requestPairingCodeWithRetry({
        socket: first,
        getSocket: () => current,
        isActive: () => Boolean(current),
        retryDelayMs: 1,
        logger: { log() {} }
    });
    assert.equal(code, 'IJKL-5678');
});
