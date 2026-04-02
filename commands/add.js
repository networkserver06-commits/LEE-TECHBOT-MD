const addCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, rawText) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Only admins can use this command.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ Bot must be an admin to add users.' });

    let userToAdd = rawText.split(' ')[1];
    if (!userToAdd) return await sock.sendMessage(chatId, { text: '❌ Please provide a number to add. Example: .add 254123456789' });

    userToAdd = userToAdd.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    
    try {
        await sock.groupParticipantsUpdate(chatId, [userToAdd], "add");
        await sock.sendMessage(chatId, { 
            text: `✅ Added @${userToAdd.split('@')[0]} to the group.`, 
            mentions: [userToAdd] 
        }, { quoted: message });
    } catch (error) {
        await sock.sendMessage(chatId, { text: `❌ Failed to add user. They might have privacy settings blocking unknown invites.` });
    }
};

module.exports = addCommand;