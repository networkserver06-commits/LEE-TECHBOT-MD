'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const store = require('../lib/lightweight_store')

test('message store loads self-chat retries across device-suffixed JIDs', async () => {
    const previousMessages = store.messages
    const previousDirty = store.dirty
    try {
        store.messages = {}
        store.dirty = false
        const original = {
            key: { remoteJid: '254700000111:2@s.whatsapp.net', id: 'self-reply-1' },
            message: { conversation: 'Pong!' }
        }
        assert.equal(store.saveMessage(original), true)
        assert.deepEqual(await store.loadMessage('254700000111@s.whatsapp.net', 'self-reply-1'), original)
        assert.deepEqual(await store.loadMessage('99887766:4@lid', 'self-reply-1'), original)
    } finally {
        store.messages = previousMessages
        store.dirty = previousDirty
    }
})

test('message store merges legacy JID buckets and preserves the latest message per ID', () => {
    const previousMessages = store.messages
    try {
        store.messages = {
            '254700000111:1@s.whatsapp.net': [
                { key: { remoteJid: '254700000111:1@s.whatsapp.net', id: 'legacy-1' }, message: { conversation: 'old' } }
            ],
            '254700000111@s.whatsapp.net': [
                { key: { remoteJid: '254700000111@s.whatsapp.net', id: 'legacy-1' }, message: { conversation: 'new' } }
            ]
        }
        store.cleanupData()
        assert.deepEqual(Object.keys(store.messages), ['254700000111@s.whatsapp.net'])
        assert.deepEqual(store.messages['254700000111@s.whatsapp.net'], [
            { key: { remoteJid: '254700000111@s.whatsapp.net', id: 'legacy-1' }, message: { conversation: 'new' } }
        ])
    } finally {
        store.messages = previousMessages
    }
})
