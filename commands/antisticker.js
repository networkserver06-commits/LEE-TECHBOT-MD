global.antistickerState = global.antistickerState || 'off';

// 1. The Toggle Command
const antistickerCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });

    const arg = userMessage.split(' ')[1]?.toLowerCase();
    
    if (arg === 'on' || arg === 'off') {
        global.antistickerState = arg;
        await sock.sendMessage(chatId, { text: `🚫 Anti-Sticker is now turned *${arg.toUpperCase()}*` });
    } else {
        await sock.sendMessage(chatId, { text: `📝 Usage: .antisticker on/off\nCurrent status: *${global.antistickerState}*` });
    }
};

// 2. The Merciless Interceptor
const checkAntiSticker = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, senderId) => {
    if (global.antistickerState !== 'on') return false; 
    if (!isGroup) return false; 

    // Look deep into the message layers
    const msgContent = message.message?.ephemeralMessage?.message || message.message?.viewOnceMessageV2?.message || message.message?.documentWithCaptionMessage?.message || message.message;
    const isSticker = msgContent?.stickerMessage;

    if (isSticker) {
        console.log(`⚠️ STICKER DETECTED from ${senderId}!`);
        
        if (isBotAdmin) {
            console.log(`🗑️ Bot is admin. Deleting sticker now...`);
            await sock.sendMessage(chatId, { delete: message.key });
            await sock.sendMessage(chatId, { text: `🚫 @${senderId.split('@')[0]}, stickers are disabled!`, mentions: [senderId] });
        } else {
            console.log(`❌ Bot is NOT admin. Cannot delete.`);
            await sock.sendMessage(chatId, { text: `⚠️ I caught a sticker, but I am not a Group Admin so I cannot delete it!` });
        }
        return true; // Stop processing
    }
    return false;
};

module.exports = { antistickerCommand, checkAntiSticker };