const savestatusCommand = async (sock, chatId, message, senderId) => {
    const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const participant = message.message?.extendedTextMessage?.contextInfo?.participant;
    
    // Check if the user is actually replying to a status
    if (!quotedMsg || !participant?.includes('status@broadcast')) {
        return await sock.sendMessage(chatId, { text: '❌ Reply to a status update to save it.' }, { quoted: message });
    }
    
    try {
        // Forward the status to the person who triggered the command
        await sock.sendMessage(senderId, { forward: message.message.extendedTextMessage.contextInfo }, { quoted: message });
        await sock.sendMessage(chatId, { text: '✅ Status successfully sent to your DM!' }, { quoted: message });
    } catch (error) {
        console.error("Error saving status:", error);
        await sock.sendMessage(chatId, { text: '❌ Failed to save status.' }, { quoted: message });
    }
};

module.exports = savestatusCommand;