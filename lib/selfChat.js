'use strict';

function bareJid(jid) {
    const value = String(jid || '').trim().toLowerCase();
    const at = value.indexOf('@');
    if (at < 0) return value.split(':')[0];
    return `${value.slice(0, at).split(':')[0]}${value.slice(at)}`;
}

function isSelfChat(sock, jid) {
    const target = bareJid(jid);
    const ownIds = [sock?.user?.id, sock?.user?.jid, sock?.user?.lid]
        .map(bareJid)
        .filter(Boolean);
    return Boolean(target && ownIds.includes(target) && !target.endsWith('@g.us'));
}

function selfChatSendOptions(sock, jid, options = {}) {
    if (!isSelfChat(sock, jid)) return { jid, options };
    const normalizedJid = bareJid(sock?.user?.id) || jid;
    const safeOptions = { ...options };
    // A self-chat reply quoting a message from the primary device can leave
    // the primary client waiting for a message it cannot decrypt. The reply
    // itself remains end-to-end encrypted; only the optional quote is removed.
    delete safeOptions.quoted;
    return { jid: normalizedJid, options: safeOptions };
}

function persistMessage(store, message, maxMessages = 20) {
    if (typeof store?.saveMessage === 'function') return store.saveMessage(message);
    const jid = String(message?.key?.remoteJid || '').trim();
    const id = String(message?.key?.id || '');
    if (!jid || !id || !store) return false;

    // Compatibility path for a process that hot-reloaded index.js while the
    // old lightweight_store module was still cached in memory.
    if (!store.messages || typeof store.messages !== 'object') store.messages = {};
    const bucket = Array.isArray(store.messages[jid]) ? store.messages[jid] : [];
    const existing = bucket.findIndex(item => String(item?.key?.id || '') === id);
    if (existing >= 0) bucket[existing] = message;
    else bucket.push(message);
    const limit = Math.max(1, Number(maxMessages) || 20);
    store.messages[jid] = bucket.slice(-limit);
    store.dirty = true;
    return true;
}

module.exports = { bareJid, isSelfChat, selfChatSendOptions, persistMessage };
