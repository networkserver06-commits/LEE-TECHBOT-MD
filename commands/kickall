// kickall.js
async function kickallCommand(sock, chatId, message, senderId, isGroup) {
    try {
        // 1. Double check that this is actually a group
        if (!isGroup) {
            return await sock.sendMessage(chatId, { 
                text: '❌ This command can only be used in groups.' 
            }, { quoted: message });
        }

        // 2. Send a starting message
        await sock.sendMessage(chatId, { 
            text: 'Starting group cleanup... please wait. 🧹' 
        }, { quoted: message });

        // 3. Get all members in the group
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        // 4. Loop through everyone and remove non-admins
        for (let user of participants) {
            // Safety check: Do not kick the bot itself, group admins, or the person sending the command
            if (!user.admin && user.id !== sock.user.id && user.id !== senderId) {
                await sock.groupParticipantsUpdate(chatId, [user.id], "remove");
                
                // CRITICAL: Wait 1 second between each kick to prevent WhatsApp from banning your bot for spamming
                await new Promise(resolve => setTimeout(resolve, 1000)); 
            }
        }

        // 5. Send completion message
        await sock.sendMessage(chatId, { 
            text: '✅ Cleanup complete. All non-admins have been removed.' 
        }, { quoted: message });

    } catch (error) {
        console.error('Error in kickall command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to execute kickall. Please make sure I am an Admin in this group!' 
        }, { quoted: message });
    }
}

module.exports = kickallCommand;