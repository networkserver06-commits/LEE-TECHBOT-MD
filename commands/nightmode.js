const nightmodeCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ I need to be an Admin to lock/unlock the group.' });

    const arg = userMessage.split(' ')[1]?.toLowerCase();
    
    if (arg === 'on') {
        // 'announcement' means only admins can send messages
        await sock.groupSettingUpdate(chatId, 'announcement');
        await sock.sendMessage(chatId, { text: '🌙 *NIGHT MODE ACTIVATED*\n\nThe group is now locked. Only admins can send messages. Goodnight!' });
    } else if (arg === 'off') {
        // 'not_announcement' opens the group to everyone
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        await sock.sendMessage(chatId, { text: '☀️ *NIGHT MODE DEACTIVATED*\n\nThe group is now open. Everyone can send messages. Good morning!' });
    } else {
        await sock.sendMessage(chatId, { text: '📝 *Usage:* .nightmode on | .nightmode off' });
    }
};

module.exports = nightmodeCommand;