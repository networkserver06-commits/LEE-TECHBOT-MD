global.antistickerState = global.antistickerState || 'off';

// 1. The Toggle Command (.antisticker on/off)
const antistickerCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ Bot must be an admin to delete stickers.' });

    const arg = userMessage.split(' ')[1]?.toLowerCase();
    
    if (arg === 'on' || arg === 'off') {
        global.antistickerState = arg;
        await sock.sendMessage(chatId, { text: `🚫 Anti-Sticker is now turned *${arg.toUpperCase()}*` });
    } else {
        await sock.sendMessage(chatId, { text: `📝 Usage: .antisticker on/off\nCurrent status: *${global.antistickerState}*` });
    }
};

// 2. The Interceptor (Checks every message and deletes if it's a sticker)
const checkAntiSticker = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, senderId) => {
    if (global.antistickerState !== 'on') return false; // Do nothing if feature is off
    if (!isGroup || isSenderAdmin || message.key.fromMe) return false; // Ignore Admins & Bot

    const msgContent = message.message?.ephemeralMessage?.message || message.message?.viewOnceMessageV2?.message || message.message?.documentWithCaptionMessage?.message || message.message;
    const isSticker = msgContent?.stickerMessage;

    if (isSticker) {
        if (isBotAdmin) {
            await sock.sendMessage(chatId, { delete: message.key });
            await sock.sendMessage(chatId, { text: `🚫 @${senderId.split('@')[0]}, stickers are disabled!`, mentions: [senderId] });
        }
        return true; // Tells main.js "I deleted a sticker, stop processing this message!"
    }
    return false;
};

module.exports = { antistickerCommand, checkAntiSticker };