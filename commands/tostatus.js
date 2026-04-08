const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const toStatusCommand = async (sock, chatId, message, isOwnerOrSudoCheck) => {
    // 1. Security Check
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use this command!' }, { quoted: message });
    }

    // 2. Check what message the user is replying to
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
        return await sock.sendMessage(chatId, { text: '❌ Please reply to a text, image, or video to upload it to status.' }, { quoted: message });
    }

    const msgType = Object.keys(quoted)[0];

    try {
        await sock.sendMessage(chatId, { text: '⏳ *Uploading to Bot Status...*' }, { quoted: message });

        // 3. Handle Text Status
        if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
            const text = quoted.conversation || quoted.extendedTextMessage?.text;
            await sock.sendMessage('status@broadcast', { text: text });
            return await sock.sendMessage(chatId, { text: '✅ *Text successfully uploaded to Bot Status!*' }, { quoted: message });
        } 
        
        // 4. Handle Image or Video Status
        if (msgType === 'imageMessage' || msgType === 'videoMessage') {
            const mediaStream = await downloadContentFromMessage(quoted[msgType], msgType.replace('Message', ''));
            let buffer = Buffer.from([]);
            for await (const chunk of mediaStream) buffer = Buffer.concat([buffer, chunk]);

            const caption = quoted[msgType].caption || '';

            await sock.sendMessage('status@broadcast', {
                [msgType.replace('Message', '')]: buffer,
                caption: caption
            });
            return await sock.sendMessage(chatId, { text: `✅ *${msgType === 'imageMessage' ? 'Image' : 'Video'} successfully uploaded to Bot Status!*` }, { quoted: message });
        }

        return await sock.sendMessage(chatId, { text: '❌ Unsupported message type. Only text, images, and videos are supported.' }, { quoted: message });

    } catch (error) {
        console.error('Error uploading to status:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to upload status.' }, { quoted: message });
    }
};

module.exports = toStatusCommand;