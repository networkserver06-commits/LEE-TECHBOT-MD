const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const vv2Command = async (sock, chatId, message, isOwnerOrSudoCheck) => {
    // 1. SECURITY CHECK: Block everyone except the Bot Owner
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use the .vv2 command!' }, { quoted: message });
    }

    // 2. Get the owner's phone number
    const senderId = message.key.participant || message.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');

    const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) {
        return await sock.sendMessage(chatId, { text: "❌ Reply to a View Once message." }, { quoted: message });
    }
    
    // 3. Find the View Once object
    let viewOnceMsg = quotedMsg.viewOnceMessage?.message || quotedMsg.viewOnceMessageV2?.message || quotedMsg.viewOnceMessageV2Extension?.message;
    if (!viewOnceMsg) {
        return await sock.sendMessage(chatId, { text: "❌ This is not a View Once message." }, { quoted: message });
    }
    
    try {
        const msgType = Object.keys(viewOnceMsg)[0];
        let mediaStream = await downloadContentFromMessage(viewOnceMsg[msgType], msgType.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of mediaStream) buffer = Buffer.concat([buffer, chunk]);

        // 4. Send the bypassed media privately to YOUR DM
        await sock.sendMessage(senderId, { 
            [msgType.replace('Message', '')]: buffer, 
            caption: "『 VV2 BYPASS 』\n" + (viewOnceMsg[msgType].caption || "") 
        });

        // 5. Leave a confirmation message in the group
        if (isGroup) {
            await sock.sendMessage(chatId, { 
                text: "✅ *Media sent to your DM!*\nPlease check your private messages." 
            }, { quoted: message });
        }

    } catch (error) {
        console.error("Error in vv2:", error);
        await sock.sendMessage(chatId, { text: '❌ Failed to bypass View Once message.' }, { quoted: message });
    }
};

module.exports = vv2Command;