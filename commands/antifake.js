global.antifakeState = global.antifakeState || 'off';

const antifakeCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ Bot must be an admin to kick fake numbers.' });

    const arg = userMessage.split(' ')[1];
    if (arg === 'on' || arg === 'off') {
        global.antifakeState = arg;
        await sock.sendMessage(chatId, { text: `🌍 Anti-Fake (Foreign Number Blocker) is now turned *${arg.toUpperCase()}*` });
    } else {
        await sock.sendMessage(chatId, { text: `Usage: .antifake on/off\nCurrent status: *${global.antifakeState}*` });
    }
};

module.exports = antifakeCommand;