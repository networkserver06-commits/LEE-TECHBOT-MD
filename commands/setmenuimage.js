const fs = require('fs');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const setMenuImageCommand = async (sock, chatId, message, isOwnerOrSudoCheck) => {
    // 1. Security Check: Only the owner can change the menu image
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use this command!' }, { quoted: message });
    }

    // 2. Check if the user replied to an image or sent an image with the caption
    const msg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || message.message;
    const msgType = Object.keys(msg || {}).find(key => key === 'imageMessage');

    if (!msgType) {
        return await sock.sendMessage(chatId, { text: '❌ Please reply to an image with *.setmenuimage* to update the menu picture.' }, { quoted: message });
    }

    await sock.sendMessage(chatId, { text: '⏳ *Updating menu image...*' }, { quoted: message });

    try {
        // 3. Download the image
        const stream = await downloadContentFromMessage(msg[msgType], 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // 4. Save it locally in your bot's main folder as 'menu.jpg'
        fs.writeFileSync('./menu.jpg', buffer);

        // 5. Success Message
        await sock.sendMessage(chatId, { text: '✅ *Menu image updated successfully!*\nType .menu to see it.' }, { quoted: message });

    } catch (error) {
        console.error('Error updating menu image:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to update menu image. The file might be too large.' }, { quoted: message });
    }
};

module.exports = setMenuImageCommand;