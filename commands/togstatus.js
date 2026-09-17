'use strict';

const { getCommandContent, groupAudience, publishStatus } = require('../lib/status');

const togStatusCommand = async (sock, chatId, message, isOwnerOrSudoCheck, isGroup) => {
    if (!isOwnerOrSudoCheck) {
        return sock.sendMessage(chatId, { text: '❌ Only the bot owner or super-owner can use this command.' }, { quoted: message });
    }
    if (!isGroup) {
        return sock.sendMessage(chatId, { text: '❌ Use .togstatus inside the group whose members should see the Status.' }, { quoted: message });
    }

    const content = getCommandContent(message);
    if (!content) {
        return sock.sendMessage(chatId, {
            text: '❌ Reply to text, an image, video, audio, or document, then send .togstatus. You can also caption a media message with .togstatus.'
        }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { text: '⏳ Uploading a group-audience Status…' }, { quoted: message });
        const audience = await groupAudience(sock, chatId);
        if (!audience.recipients.length) throw new Error('The group has no usable phone recipients');
        await publishStatus(sock, content, audience.recipients);
        return sock.sendMessage(chatId, {
            text: `✅ ${content.type === 'text' ? 'Text' : `${content.type.charAt(0).toUpperCase()}${content.type.slice(1)}`} Status posted for *${audience.subject}* members (*${audience.recipients.length}* recipients).`
        }, { quoted: message });
    } catch (error) {
        console.error('[togstatus]', error.message || error);
        return sock.sendMessage(chatId, {
            text: '❌ Group-audience Status failed. Confirm the group is active and try again.'
        }, { quoted: message });
    }
};

module.exports = togStatusCommand;
