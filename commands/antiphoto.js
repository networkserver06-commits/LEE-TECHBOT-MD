global.antiphotoState = global.antiphotoState || 'off';

const antiphotoCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ Bot must be an admin to delete photos.' });

    const arg = userMessage.split(' ')[1]?.toLowerCase();
    
    if (arg === 'on' || arg === 'off') {
        global.antiphotoState = arg;
        await sock.sendMessage(chatId, { text: `🖼️ Anti-Photo is now turned *${arg.toUpperCase()}*` });
    } else {
        await sock.sendMessage(chatId, { text: `📝 Usage: .antiphoto on/off\nCurrent status: *${global.antiphotoState}*` });
    }
};

module.exports = antiphotoCommand;