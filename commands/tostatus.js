const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const toStatusCommand = async (sock, chatId, message, isOwnerOrSudoCheck) => {
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use this command!' }, { quoted: message });
    }

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
        return await sock.sendMessage(chatId, { text: '❌ Please reply to a text, image, or video.' }, { quoted: message });
    }

    const msgType = Object.keys(quoted)[0];

    try {
        await sock.sendMessage(chatId, { text: '⏳ *Uploading to Bot Status...*' }, { quoted: message });

        // 1. GATHER ALL KNOWN CONTACTS
        // We fetch everyone from all groups the bot is in so the status is actually visible!
        const groups = await sock.groupFetchAllParticipating();
        let jids = [];
        for (const group of Object.values(groups)) {
            jids.push(...group.participants.map(p => p.id));
        }
        
        // Add the bot's own number
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        jids.push(botId);
        
        // Remove duplicates to create the final broadcast list
        const statusJidList = [...new Set(jids)];

        // 2. UPLOAD TEXT (Requires Color & Font)
        if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
            const text = quoted.conversation || quoted.extendedTextMessage?.text;
            await sock.sendMessage('status@broadcast', { 
                text: text,
                backgroundColor: '#1E1E1E', // WhatsApp requires a background color!
                font: 1                      // WhatsApp requires a font type!
            }, { statusJidList });
            return await sock.sendMessage(chatId, { text: '✅ *Text successfully uploaded to Bot Status!*' }, { quoted: message });
        } 
        
        // 3. UPLOAD MEDIA
        if (msgType === 'imageMessage' || msgType === 'videoMessage') {
            const mediaStream = await downloadContentFromMessage(quoted[msgType], msgType.replace('Message', ''));
            let buffer = Buffer.from([]);
            for await (const chunk of mediaStream) buffer = Buffer.concat([buffer, chunk]);

            await sock.sendMessage('status@broadcast', {
                [msgType.replace('Message', '')]: buffer,
                caption: quoted[msgType].caption || ''
            }, { statusJidList }); // Essential for visibility!
            
            return await sock.sendMessage(chatId, { text: `✅ *Media successfully uploaded to Bot Status!*` }, { quoted: message });
        }

        return await sock.sendMessage(chatId, { text: '❌ Unsupported message type. Only text, images, and videos are supported.' }, { quoted: message });

    } catch (error) {
        console.error('Error uploading to status:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to upload status. Ensure the bot is in at least one group.' }, { quoted: message });
    }
};

module.exports = toStatusCommand;