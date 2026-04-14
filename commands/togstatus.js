const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys');

const togStatusCommand = async (sock, chatId, message, isOwnerOrSudoCheck, isGroup) => {
    // 1. Validations
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use this command!' }, { quoted: message });
    }
    if (!isGroup) {
        return await sock.sendMessage(chatId, { text: '❌ This command can only be used inside a group!' }, { quoted: message });
    }

    // Get the quoted message properly
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || 
                   message.message?.imageMessage?.contextInfo?.quotedMessage || 
                   message.message?.videoMessage?.contextInfo?.quotedMessage;

    if (!quoted) {
        return await sock.sendMessage(chatId, { text: '❌ Please reply to a text, image, or video to upload it to group status.' }, { quoted: message });
    }

    // Determine content type accurately
    const msgType = getContentType(quoted);

    try {
        await sock.sendMessage(chatId, { text: '⏳ *Processing & Uploading to Group Status...*' }, { quoted: message });

        // 2. Fetch Group Members and Clean JIDs
        const groupMetadata = await sock.groupMetadata(chatId);
        const statusJidList = groupMetadata.participants.map(p => {
            // Clean device-specific IDs (e.g., 123:1@s.whatsapp.net -> 123@s.whatsapp.net)
            const id = p.id.split('@')[0].split(':')[0];
            return `${id}@s.whatsapp.net`;
        });

        // 3. Handle Text Status
        if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
            const text = quoted.conversation || quoted.extendedTextMessage?.text;
            await sock.sendMessage(
                'status@broadcast', 
                { text: text }, 
                { 
                    backgroundColor: '#000000', 
                    font: 1, 
                    statusJidList: statusJidList 
                }
            );
            return await sock.sendMessage(chatId, { text: `✅ *Text Status uploaded!*\nVisible to: *${groupMetadata.subject}*` }, { quoted: message });
        } 

        // 4. Handle Media Status (Image/Video)
        if (msgType === 'imageMessage' || msgType === 'videoMessage') {
            const mediaType = msgType.replace('Message', '');
            const stream = await downloadContentFromMessage(quoted[msgType], mediaType);
            
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            await sock.sendMessage(
                'status@broadcast', 
                { 
                    [mediaType]: buffer, 
                    caption: quoted[msgType].caption || '' 
                }, 
                { statusJidList: statusJidList }
            );

            return await sock.sendMessage(chatId, { text: `✅ *${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} Status uploaded!*` }, { quoted: message });
        }

        // 5. Fallback for other types
        return await sock.sendMessage(chatId, { text: '❌ This message type is not supported for status.' }, { quoted: message });

    } catch (error) {
        console.error('Error uploading group status:', error);
        await sock.sendMessage(chatId, { text: `❌ *Error:* ${error.message}` }, { quoted: message });
    }
};

module.exports = togStatusCommand;