const setprefixCommand = async (sock, chatId, message, isOwnerOrSudoCheck, userMessage) => {
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can change the prefix.' }, { quoted: message });
    }

    const newPrefix = userMessage.split(' ')[1];
    if (!newPrefix) {
        return await sock.sendMessage(chatId, { text: '📝 Please provide a prefix. Example: .setprefix ! or .setprefix none' }, { quoted: message });
    }

    // Set global prefix (handles 'none' state gracefully)
    global.prefix = newPrefix.toLowerCase() === 'none' ? '' : newPrefix;
    const displayPrefix = global.prefix === '' ? 'none (No prefix)' : global.prefix;

    await sock.sendMessage(chatId, { text: `✅ Prefix has been set to: *${displayPrefix}*` }, { quoted: message });
};

module.exports = setprefixCommand;