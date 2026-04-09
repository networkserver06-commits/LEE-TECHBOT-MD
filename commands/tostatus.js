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

        // 1. Gather all contacts and strip any ":device" tags from their IDs!
        const groups = await sock.groupFetchAllParticipating();
        let jids = [];
        for (const group of Object.values(groups)) {
            for (const p of group.participants) {
                // This removes the :1 device tags that break WhatsApp status uploads
                jids.push(p.id.split('@')[0].split(':')[0] + '@s.whatsapp.net');
            }
        }
        
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        jids.push(botId);
        
        const statusJidList = [...new Set(jids)];

        // 2. Handle Text
        if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
            const text = quoted.conversation || quoted.extendedTextMessage?.text;
            await sock.sendMessage(
                'status@broadcast', 
                { text: text, backgroundColor: '#000000', font: 1 }, 
                { broadcast: true, statusJidList } // broadcast: true is mandatory!
            );
            return await sock.sendMessage(chatId, { text: '✅ *Text successfully uploaded to Bot Status!*' }, { quoted: message });
        } 
        
        // 3. Handle Media
        if (msgType === 'imageMessage' || msgType === 'videoMessage') {
            const mediaStream = await downloadContentFromMessage(quoted[msgType], msgType.replace('Message', ''));
            let buffer = Buffer.from([]);
            for await (const chunk of mediaStream) buffer = Buffer.concat([buffer, chunk]);

            await sock.sendMessage(
                'status@broadcast', 
                { [msgType.replace('Message', '')]: buffer, caption: quoted[msgType].caption || '' }, 
                { broadcast: true, statusJidList } // broadcast: true is mandatory!
            );
            
            return await sock.sendMessage(chatId, { text: `✅ *Media successfully uploaded to Bot Status!*` }, { quoted: message });
        }

        return await sock.sendMessage(chatId, { text: '❌ Unsupported message type.' }, { quoted: message });

    } catch (error) {
        console.error('Error uploading to status:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to upload status.' }, { quoted: message });
    }
};

module.exports = toStatusCommand;