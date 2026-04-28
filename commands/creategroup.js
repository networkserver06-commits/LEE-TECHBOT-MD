const createGroupCommand = async (sock, chatId, message, isOwnerOrSudoCheck, groupName) => {
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the owner can create groups.' }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { text: `⏳ *Creating group: "${groupName}"...*` }, { quoted: message });

        // Creating the group (Note: You must invite at least one other participant or yourself)
        // Usually, the bot uses the sender's ID as the participant
        const response = await sock.groupCreate(groupName, [message.key.participant || message.key.remoteJid]);

        await sock.sendMessage(chatId, { text: `✅ *Success!*\nGroup *"${groupName}"* has been created.` }, { quoted: message });

    } catch (error) {
        // This catches the error so your bot doesn't crash!
        console.error('Group Creation Error:', error);
        
        await sock.sendMessage(chatId, { 
            text: `❌ *Failed to create group.*\nReason: ${error.message || 'Unknown permission error'}` 
        }, { quoted: message });
    }
};

module.exports = createGroupCommand;