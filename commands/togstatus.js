const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const togStatusCommand = async (sock, chatId, message, isOwnerOrSudoCheck, isGroup) => {
    // 1. Security & Group Check
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

        // 2. Fetch Group Participants to restrict status visibility
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants.map(p => p.id);

        // 3. Handle Text Status (Restricted to Group Members)
        if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
            const text = quoted.conversation || quoted.extendedTextMessage?.text;
            
            await sock.sendMessage('status@broadcast', { text: text }, { statusJidList: participants });
            return await sock.sendMessage(chatId, { text: `✅ *Text uploaded to Status!*\n👀 _Visible ONLY to members of ${groupMetadata.subject}_` }, { quoted: message });
        } 
        
        // 4. Handle Media Status (Restricted to Group Members)
        if (msgType === 'imageMessage' || msgType === 'videoMessage') {
            const mediaStream = await downloadContentFromMessage(quoted[msgType], msgType.replace('Message', ''));
            let buffer = Buffer.from([]);
            for await (const chunk of mediaStream) buffer = Buffer.concat([buffer, chunk]);

            const caption = quoted[msgType].caption || '';

            await sock.sendMessage('status@broadcast', {
                [msgType.replace('Message', '')]: buffer,
                caption: caption
            }, { statusJidList: participants }); // <-- This makes it private to the group!
            
            return await sock.sendMessage(chatId, { text: `✅ *Media uploaded to Status!*\n👀 _Visible ONLY to members of ${groupMetadata.subject}_` }, { quoted: message });
        }

        return await sock.sendMessage(chatId, { text: '❌ Unsupported message type.' }, { quoted: message });

    } catch (error) {
        console.error('Error uploading to group status:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to upload group status.' }, { quoted: message });
    }
};

module.exports = togStatusCommand;