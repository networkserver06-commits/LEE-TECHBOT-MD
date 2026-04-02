global.joinapprovalState = global.joinapprovalState || 'off';

const joinapprovalCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ Bot must be an admin to manage join settings.' });

    const arg = userMessage.split(' ')[1];
    if (arg === 'on' || arg === 'off') {
        global.joinapprovalState = arg;
        
        // This toggles the actual WhatsApp group setting
        await sock.groupSettingUpdate(chatId, arg === 'on' ? 'announcement' : 'not_announcement');
        await sock.sendMessage(chatId, { text: `✅ Auto Join-Approval is now turned *${arg.toUpperCase()}*` });
    } else {
        await sock.sendMessage(chatId, { text: `Usage: .joinapproval on/off\nCurrent status: *${global.joinapprovalState}*` });
    }
};

module.exports = joinapprovalCommand;