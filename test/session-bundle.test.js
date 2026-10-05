'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { packSessionDirectory, restoreSessionBundle, SESSION_PREFIX } = require('../lib/sessionBundle')

function tempDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'lee-session-bundle-test-')) }

test('session bundle round-trips auth files and imports only once', () => {
    const source = tempDir()
    const target = tempDir()
    try {
        fs.mkdirSync(path.join(source, 'nested'), { recursive: true })
        fs.writeFileSync(path.join(source, 'creds.json'), '{"registered":true}')
        fs.writeFileSync(path.join(source, 'nested', 'key.json'), 'key-data')
        const bundle = packSessionDirectory(source)
        const first = restoreSessionBundle(bundle, target)
        const second = restoreSessionBundle(bundle, target)
        assert.equal(first.imported, true)
        assert.equal(first.files, 2)
        assert.equal(second.reason, 'already-imported')
        assert.equal(fs.readFileSync(path.join(target, 'nested', 'key.json'), 'utf8'), 'key-data')
        const prefixedTarget = tempDir()
        try {
            const prefixed = restoreSessionBundle(`${SESSION_PREFIX}${bundle}`, prefixedTarget)
            assert.equal(prefixed.imported, true)
            assert.equal(fs.readFileSync(path.join(prefixedTarget, 'creds.json'), 'utf8'), '{"registered":true}')
        } finally { fs.rmSync(prefixedTarget, { recursive: true, force: true }) }
    } finally {
        fs.rmSync(source, { recursive: true, force: true })
        fs.rmSync(target, { recursive: true, force: true })
    }
})

test('a new bundle replaces stale auth files after validation', () => {
    const sourceA = tempDir()
    const sourceB = tempDir()
    const target = tempDir()
    try {
        fs.writeFileSync(path.join(sourceA, 'creds.json'), 'a')
        fs.writeFileSync(path.join(sourceA, 'stale.json'), 'remove-me')
        fs.writeFileSync(path.join(sourceB, 'creds.json'), 'b')
        const bundleA = packSessionDirectory(sourceA)
        const bundleB = packSessionDirectory(sourceB)
        restoreSessionBundle(bundleA, target)
        restoreSessionBundle(bundleB, target)
        assert.equal(fs.readFileSync(path.join(target, 'creds.json'), 'utf8'), 'b')
        assert.equal(fs.existsSync(path.join(target, 'stale.json')), false)
    } finally {
        for (const dir of [sourceA, sourceB, target]) fs.rmSync(dir, { recursive: true, force: true })
    }
})

test('invalid bundles do not destroy an existing auth directory', () => {
    const target = tempDir()
    try {
        fs.writeFileSync(path.join(target, 'creds.json'), 'keep-me')
        assert.throws(() => restoreSessionBundle('not-a-bundle', target), /invalid|corrupted/i)
        assert.equal(fs.readFileSync(path.join(target, 'creds.json'), 'utf8'), 'keep-me')
    } finally { fs.rmSync(target, { recursive: true, force: true }) }
})
