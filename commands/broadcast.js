const broadcastCommand = async (sock, chatId, message, isOwnerOrSudoCheck, userMessage) => {
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use the broadcast feature.' }, { quoted: message });
    }

    // This grabs everything you typed after .bc or .broadcast
    const bcText = userMessage.split(' ').slice(1).join(' ');
    
    if (!bcText) {
        return await sock.sendMessage(chatId, { text: '📝 Please provide a message to broadcast.\nExample: .bc Hello everyone!' }, { quoted: message });
    }

    try {
        const allGroups = await sock.groupFetchAllParticipating();
        const groupJids = Object.keys(allGroups);

        await sock.sendMessage(chatId, { text: `⏳ Broadcasting your message to ${groupJids.length} groups. Please wait...` }, { quoted: message });

        let successCount = 0;

        for (let jid of groupJids) {
            try {
                // This sends the fixed header + your exact message (bcText)
                await sock.sendMessage(jid, { 
                    text: `*📢 BROADCAST MESSAGE BY LEE TECH BOT*\n\n${bcText}` 
                });
                successCount++;
                
                // Keep this delay! It prevents WhatsApp from flagging you as spam.
                await new Promise(resolve => setTimeout(resolve, 1500)); 
            } catch (err) {
                console.error(`Failed to broadcast to ${jid}:`, err.message);
            }
        }

        await sock.sendMessage(chatId, { text: `✅ Broadcast finished! Successfully sent to ${successCount} groups.` }, { quoted: message });

    } catch (error) {
        console.error("Broadcast Error:", error);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch groups for broadcast.' }, { quoted: message });
    }
};

module.exports = broadcastCommand;