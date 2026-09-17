'use strict';

const { getCommandContent, personalAudience, publishStatus } = require('../lib/status');

const toStatusCommand = async (sock, chatId, message, isOwnerOrSudoCheck) => {
    if (!isOwnerOrSudoCheck) {
        return sock.sendMessage(chatId, { text: '❌ Only the bot owner or super-owner can use this command.' }, { quoted: message });
    }

    const content = getCommandContent(message);
    if (!content) {
        return sock.sendMessage(chatId, {
            text: '❌ Reply to text, an image, video, audio, or document, then send .tostatus. You can also caption a media message with .tostatus.'
        }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { text: '⏳ Uploading to your WhatsApp Status…' }, { quoted: message });
        const recipients = await personalAudience(sock);
        if (!recipients.length) throw new Error('No WhatsApp contacts were found for the personal audience');
        await publishStatus(sock, content, recipients);
        return sock.sendMessage(chatId, {
            text: `✅ ${content.type === 'text' ? 'Text' : `${content.type.charAt(0).toUpperCase()}${content.type.slice(1)}`} posted to your WhatsApp Status for *${recipients.length}* audience contacts.`
        }, { quoted: message });
    } catch (error) {
        console.error('[tostatus]', error.message || error);
        return sock.sendMessage(chatId, {
            text: '❌ Status upload failed. Check that the media is still available and try again.'
        }, { quoted: message });
    }
};

module.exports = toStatusCommand;
