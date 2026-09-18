'use strict';

const { getCommandContent, publishStatus } = require('../lib/status');

const toStatusCommand = async (sock, chatId, message, isOwnerOrSudoCheck) => {
    if (!isOwnerOrSudoCheck) {
        return sock.sendMessage(chatId, { text: '❌ Only the bot owner or super-owner can use this command.' }, { quoted: message });
    }

    const content = getCommandContent(message);
    if (!content) {
        return sock.sendMessage(chatId, {
            text: '❌ Use `.tostatus Your text here`, reply to text/media, or caption an image, video, audio, or document with `.tostatus`.'
        }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { text: '⏳ Uploading to your WhatsApp Status…' }, { quoted: message });
        // Let WhatsApp apply the account's native Status privacy audience. A
        // locally assembled JID list can contain stale/LID entries and cause
        // the Status upload to be rejected even when the media is valid.
        await publishStatus(sock, content);
        return sock.sendMessage(chatId, {
            text: `✅ ${content.type === 'text' ? 'Text' : `${content.type.charAt(0).toUpperCase()}${content.type.slice(1)}`} posted to your WhatsApp Status.`
        }, { quoted: message });
    } catch (error) {
        console.error('[tostatus]', error.message || error);
        return sock.sendMessage(chatId, {
            text: `❌ Status upload failed: ${String(error.message || 'WhatsApp rejected the upload').slice(0, 180)}\nCheck that the media is still available and try again.`
        }, { quoted: message });
    }
};

module.exports = toStatusCommand;
