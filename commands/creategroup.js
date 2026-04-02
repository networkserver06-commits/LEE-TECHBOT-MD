const creategroupCommand = async (sock, chatId, message, isOwnerOrSudoCheck, rawText) => {
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can create groups.' }, { quoted: message });
    }

    // Command format: .creategroup Group Name | @user
    const groupArgs = rawText.slice(12).trim().split('|');
    const groupName = groupArgs[0].trim() || "LEE TECH Bot Group";
    const membersToAdd = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    try {
        await sock.sendMessage(chatId, { text: '⏳ Creating group...' }, { quoted: message });
        
        const group = await sock.groupCreate(groupName, membersToAdd);
        const inviteCode = await sock.groupInviteCode(group.id);
        
        await sock.sendMessage(chatId, { 
            text: `✅ Group *${groupName}* created successfully!\n\n🔗 Invite link: https://chat.whatsapp.com/${inviteCode}` 
        }, { quoted: message });
    } catch (error) {
        await sock.sendMessage(chatId, { text: `❌ Failed to create group. Error: ${error.message}` }, { quoted: message });
    }
};

module.exports = creategroupCommand;