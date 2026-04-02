global.antibotState = global.antibotState || 'off';

const antibotCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ Bot must be an admin to kick other bots.' });

    const arg = userMessage.split(' ')[1];
    if (arg === 'on' || arg === 'off') {
        global.antibotState = arg;
        await sock.sendMessage(chatId, { text: `🤖 Anti-Bot is now turned *${arg.toUpperCase()}*` });
    } else {
        await sock.sendMessage(chatId, { text: `Usage: .antibot on/off\nCurrent status: *${global.antibotState}*` });
    }
};

module.exports = antibotCommand;