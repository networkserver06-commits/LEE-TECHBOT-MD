const broadcastCommand = async (sock, chatId, message, isOwnerOrSudoCheck, userMessage) => {
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use the broadcast feature.' }, { quoted: message });
    }

    // Extract the message after the .bc or .broadcast command
    const bcText = userMessage.split(' ').slice(1).join(' ');
    
    if (!bcText) {
        return await sock.sendMessage(chatId, { text: '📝 Please provide a message to broadcast.\nExample: .bc Hello everyone, bot update tonight!' }, { quoted: message });
    }

    try {
        // Fetch all groups the bot is currently in
        const allGroups = await sock.groupFetchAllParticipating();
        const groupJids = Object.keys(allGroups);

        await sock.sendMessage(chatId, { text: `⏳ Broadcasting your message to ${groupJids.length} groups. Please wait...` }, { quoted: message });

        let successCount = 0;

        for (let jid of groupJids) {
            try {
                await sock.sendMessage(jid, { 
                    text: `*『 📢 LEE TECH BROADCAST 』*\n\n${bcText}` 
                });
                successCount++;
                // CRITICAL: 1.5 second delay between sends to prevent WhatsApp from banning the bot
                await new Promise(resolve => setTimeout(resolve, 1500)); 
            } catch (err) {
                console.error(`Failed to broadcast to ${jid}:`, err.message);
            }
        }

        await sock.sendMessage(chatId, { text: `✅ Broadcast finished! Successfully sent to ${successCount} out of ${groupJids.length} groups.` }, { quoted: message });

    } catch (error) {
        console.error("Broadcast Error:", error);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch groups for broadcast.' }, { quoted: message });
    }
};

module.exports = broadcastCommand;