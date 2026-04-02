const leaveCommand = async (sock, chatId, message, isGroup, isOwnerOrSudoCheck) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ This is not a group.' });
    if (!isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use this command.' }, { quoted: message });

    await sock.sendMessage(chatId, { text: 'Goodbye everyone! 👋 It was nice being here.' });
    await sock.groupLeave(chatId);
};

module.exports = leaveCommand;