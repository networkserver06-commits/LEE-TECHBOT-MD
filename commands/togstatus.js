'use strict';

const { getCommandContent, groupAudience, publishToChat } = require('../lib/status');

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
            text: '❌ Use `.togstatus Your text here`, reply to text/media, or caption an image, video, audio, or document with `.togstatus` inside the target group.'
        }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { text: '⏳ Sending to this group and mentioning its members…' }, { quoted: message });
        const audience = await groupAudience(sock, chatId);
        if (!audience.recipients.length) throw new Error('The group has no usable phone recipients');
        const mentions = audience.recipients.filter((jid) => /@s\.whatsapp\.net$/i.test(jid)).slice(0, 100);
        await publishToChat(sock, chatId, content, mentions);
        return sock.sendMessage(chatId, {
            text: `✅ ${content.type === 'text' ? 'Text' : `${content.type.charAt(0).toUpperCase()}${content.type.slice(1)}`} sent to *${audience.subject}* with member mentions.`
        }, { quoted: message });
    } catch (error) {
        console.error('[togstatus]', error.message || error);
        return sock.sendMessage(chatId, {
            text: '❌ Group mention post failed. Confirm the group is active and try again.'
        }, { quoted: message });
    }
};

module.exports = togStatusCommand;
