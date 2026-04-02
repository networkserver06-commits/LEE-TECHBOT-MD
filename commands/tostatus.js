const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const tostatusCommand = async (sock, chatId, message, userMessage, isOwnerOrSudoCheck) => {
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can upload to the bot\'s status.' }, { quoted: message });
    }

    const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) {
        return await sock.sendMessage(chatId, { text: '❌ Reply to an image/video to post to status.' }, { quoted: message });
    }
    
    const msgType = Object.keys(quotedMsg)[0];
    if (msgType !== 'imageMessage' && msgType !== 'videoMessage') {
        return await sock.sendMessage(chatId, { text: '❌ Only images and videos are supported for status updates.' }, { quoted: message });
    }
    
    try {
        await sock.sendMessage(chatId, { text: '⏳ Uploading to status...' }, { quoted: message });

        // Stream and download the media buffer
        let mediaStream = await downloadContentFromMessage(quotedMsg[msgType], msgType.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of mediaStream) buffer = Buffer.concat([buffer, chunk]);

        // Get caption if user provided one
        const caption = userMessage.split(' ').slice(1).join(' ') || quotedMsg[msgType].caption || "Uploaded via LEE TECH BOT";

        // Upload to WhatsApp Status Broadcast
        await sock.sendMessage('status@broadcast', { 
            [msgType.replace('Message', '')]: buffer,
            caption: caption
        });

        await sock.sendMessage(chatId, { text: '✅ Shared to Status successfully!' }, { quoted: message });
    } catch (error) {
        console.error("Error in tostatus:", error);
        await sock.sendMessage(chatId, { text: '❌ Failed to upload status. Ensure the file is not corrupted.' }, { quoted: message });
    }
};

module.exports = tostatusCommand;