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

module.exports = { bareJid, isSelfChat, selfChatSendOptions };
