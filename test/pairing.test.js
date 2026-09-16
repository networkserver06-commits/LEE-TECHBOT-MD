'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { formatPairingCode, isTransientPairingError, requestPairingCodeWithRetry } = require('../lib/pairing');

test('formats WhatsApp pairing codes in four-character groups', () => {
    assert.equal(formatPairingCode('ABCDEFGH'), 'ABCD-EFGH');
    assert.equal(formatPairingCode('123456'), '1234-56');
});

test('recognizes Baileys 428 connection closures as transient', () => {
    assert.equal(isTransientPairingError({ output: { statusCode: 428 }, message: 'Connection Closed' }), true);
    assert.equal(isTransientPairingError(new Error('Precondition Required')), true);
    assert.equal(isTransientPairingError({ output: { statusCode: 401 }, message: 'logged out' }), false);
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
