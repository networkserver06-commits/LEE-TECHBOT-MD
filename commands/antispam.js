global.antispamState = global.antispamState || 'off';

const antispamCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });

    const arg = userMessage.split(' ')[1];
    if (arg === 'on' || arg === 'off') {
        global.antispamState = arg;
        await sock.sendMessage(chatId, { text: `🛡️ Anti-Spam is now turned *${arg.toUpperCase()}*` });
    } else {
        await sock.sendMessage(chatId, { text: `Usage: .antispam on/off\nCurrent status: *${global.antispamState}*` });
    }
};

module.exports = antispamCommand;