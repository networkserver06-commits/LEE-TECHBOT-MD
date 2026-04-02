global.antimentionState = global.antimentionState || 'off';

const antimentionCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });

    const arg = userMessage.split(' ')[1];
    if (arg === 'on' || arg === 'off') {
        global.antimentionState = arg;
        await sock.sendMessage(chatId, { text: `✅ Antimention is now turned *${arg.toUpperCase()}*` });
    } else {
        await sock.sendMessage(chatId, { text: `Usage: .antimention on/off\nCurrent status: *${global.antimentionState}*` });
    }
};

module.exports = antimentionCommand;