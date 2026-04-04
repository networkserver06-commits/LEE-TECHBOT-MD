const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const vv2Command = async (sock, chatId, message, isOwnerOrSudoCheck) => {
    // 1. SECURITY CHECK: Block everyone except the Bot Owner
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use the .vv2 command!' }, { quoted: message });
    }

    const senderId = message.key.participant || message.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');

    const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) {
        return await sock.sendMessage(chatId, { text: "❌ Reply to a View Once message." }, { quoted: message });
    }
    
    // 2. BULLETPROOF VIEW ONCE DETECTION
    let mediaContent;
    let msgType;

    // Check Format 1: The old wrapper format
    const wrapper = quotedMsg.viewOnceMessage?.message || quotedMsg.viewOnceMessageV2?.message || quotedMsg.viewOnceMessageV2Extension?.message;
    
    if (wrapper) {
        msgType = Object.keys(wrapper)[0]; // Will be 'imageMessage' or 'videoMessage'
        mediaContent = wrapper[msgType];
    } 
    // Check Format 2: The new boolean flag format
    else if (quotedMsg.imageMessage?.viewOnce) {
        msgType = 'imageMessage';
        mediaContent = quotedMsg.imageMessage;
    } else if (quotedMsg.videoMessage?.viewOnce) {
        msgType = 'videoMessage';
        mediaContent = quotedMsg.videoMessage;
    } else if (quotedMsg.audioMessage?.viewOnce) {
        msgType = 'audioMessage'; // In case they send a view once voice note!
        mediaContent = quotedMsg.audioMessage;
    } 
    // If it doesn't match ANY of those, it's really not a view once message
    else {
        return await sock.sendMessage(chatId, { text: "❌ This is not a View Once message." }, { quoted: message });
    }
    
    try {
        // 3. Download the media
        let mediaStream = await downloadContentFromMessage(mediaContent, msgType.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of mediaStream) buffer = Buffer.concat([buffer, chunk]);

        // 4. Send the bypassed media privately to YOUR DM
        await sock.sendMessage(senderId, { 
            [msgType.replace('Message', '')]: buffer, 
            caption: "『 VV2 BYPASS 』\n" + (mediaContent.caption || "") 
        });

        // 5. Leave a confirmation message in the group
        if (isGroup) {
            await sock.sendMessage(chatId, { 
                text: "✅ *Media sent to your DM!*\nPlease check your private messages." 
            }, { quoted: message });
        }

    } catch (error) {
        console.error("Error in vv2:", error);
        await sock.sendMessage(chatId, { text: '❌ Failed to download View Once message. The media might have expired.' }, { quoted: message });
    }
};

module.exports = vv2Command;