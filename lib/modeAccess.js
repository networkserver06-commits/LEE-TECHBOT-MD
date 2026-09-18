'use strict';

function canProcessMessage({ isPublic, isGroup, fromMe, isOwnerOrSudo }) {
    // Public mode processes all messages. Private mode blocks ordinary DMs,
    // but keeps group commands available; owner/sudo/developer access remains
    // available in both groups and private chats.
    return Boolean(isPublic || isGroup || fromMe || isOwnerOrSudo);
}

module.exports = { canProcessMessage };
