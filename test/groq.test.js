'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { DEFAULT_FREE_MODEL, modelCandidates, providerError } = require('../commands/groq');

test('Groq defaults to the lightweight free-tier model', () => {
    const previous = process.env.GROQ_MODEL;
    delete process.env.GROQ_MODEL;
    delete process.env.GROQ_FALLBACK_MODEL;
    try {
        assert.deepEqual(modelCandidates(), [DEFAULT_FREE_MODEL]);
        assert.equal(DEFAULT_FREE_MODEL, 'llama-3.1-8b-instant');
    } finally {
        if (previous === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = previous;
    }
});

test('Groq reports key and free-tier quota errors clearly', () => {
    assert.match(providerError({ status: 401 }), /API key was rejected/i);
    assert.match(providerError({ status: 429 }), /free-tier quota|rate limit/i);
    assert.match(providerError({ status: 404 }), /free fallback model/i);
});
