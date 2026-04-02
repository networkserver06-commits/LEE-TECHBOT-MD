global.autodlState = global.autodlState || 'off';

const autodlCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });

    const arg = userMessage.split(' ')[1]?.toLowerCase();
    
    if (arg === 'on' || arg === 'off') {
        global.autodlState = arg;
        await sock.sendMessage(chatId, { text: `📥 Auto-Downloader is now turned *${arg.toUpperCase()}*` });
    } else {
        await sock.sendMessage(chatId, { text: `Usage: .autodl on/off\nCurrent status: *${global.autodlState}*` });
    }
};

module.exports = autodlCommand;