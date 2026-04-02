const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const vv2Command = async (sock, chatId, message) => {
    const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) {
        return await sock.sendMessage(chatId, { text: "❌ Reply to a View Once message." }, { quoted: message });
    }
    
    // Find the View Once object
    let viewOnceMsg = quotedMsg.viewOnceMessage?.message || quotedMsg.viewOnceMessageV2?.message || quotedMsg.viewOnceMessageV2Extension?.message;
    if (!viewOnceMsg) {
        return await sock.sendMessage(chatId, { text: "❌ This is not a View Once message." }, { quoted: message });
    }
    
    try {
        const msgType = Object.keys(viewOnceMsg)[0];
        let mediaStream = await downloadContentFromMessage(viewOnceMsg[msgType], msgType.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of mediaStream) buffer = Buffer.concat([buffer, chunk]);

        await sock.sendMessage(chatId, { 
            [msgType.replace('Message', '')]: buffer, 
            caption: "『 VV2 BYPASS 』\n" + (viewOnceMsg[msgType].caption || "") 
        }, { quoted: message });

    } catch (error) {
        console.error("Error in vv2:", error);
        await sock.sendMessage(chatId, { text: '❌ Failed to bypass View Once message.' }, { quoted: message });
    }
};

module.exports = vv2Command;