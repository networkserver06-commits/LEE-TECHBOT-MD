const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const togStatusCommand = async (sock, chatId, message, isOwnerOrSudoCheck, isGroup) => {
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use this command!' }, { quoted: message });
    }
    if (!isGroup) {
        return await sock.sendMessage(chatId, { text: '❌ This command can only be used inside a group!' }, { quoted: message });
    }

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
        return await sock.sendMessage(chatId, { text: '❌ Please reply to a text, image, or video.' }, { quoted: message });
    }

    const msgType = Object.keys(quoted)[0];

    try {
        await sock.sendMessage(chatId, { text: '⏳ *Uploading to Group Status...*' }, { quoted: message });

        // 1. Get ONLY the members of this specific group
        const groupMetadata = await sock.groupMetadata(chatId);
        const statusJidList = groupMetadata.participants.map(p => p.id);

        // 2. UPLOAD TEXT
        if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
            const text = quoted.conversation || quoted.extendedTextMessage?.text;
            await sock.sendMessage('status@broadcast', { 
                text: text,
                backgroundColor: '#1E1E1E', // Required
                font: 1                     // Required
            }, { statusJidList });          // Locked to group members
            return await sock.sendMessage(chatId, { text: `✅ *Text uploaded! Visible ONLY to members of ${groupMetadata.subject}*` }, { quoted: message });
        } 
        
        // 3. UPLOAD MEDIA
        if (msgType === 'imageMessage' || msgType === 'videoMessage') {
            const mediaStream = await downloadContentFromMessage(quoted[msgType], msgType.replace('Message', ''));
            let buffer = Buffer.from([]);
            for await (const chunk of mediaStream) buffer = Buffer.concat([buffer, chunk]);

            await sock.sendMessage('status@broadcast', {
                [msgType.replace('Message', '')]: buffer,
                caption: quoted[msgType].caption || ''
            }, { statusJidList });         // Locked to group members
            
            return await sock.sendMessage(chatId, { text: `✅ *Media uploaded! Visible ONLY to members of ${groupMetadata.subject}*` }, { quoted: message });
        }

        return await sock.sendMessage(chatId, { text: '❌ Unsupported message type.' }, { quoted: message });

    } catch (error) {
        console.error('Error uploading group status:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to upload group status.' }, { quoted: message });
    }
};

module.exports = togStatusCommand;