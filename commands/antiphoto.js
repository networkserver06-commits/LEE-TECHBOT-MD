global.antiphotoState = global.antiphotoState || 'off';

// 1. The Toggle Command (.antiphoto on/off)
const antiphotoCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ Bot must be an admin to delete photos.' });

    const arg = userMessage.split(' ')[1]?.toLowerCase();
    
    if (arg === 'on' || arg === 'off') {
        global.antiphotoState = arg;
        await sock.sendMessage(chatId, { text: `🖼️ Anti-Photo is now turned *${arg.toUpperCase()}*` });
    } else {
        await sock.sendMessage(chatId, { text: `📝 Usage: .antiphoto on/off\nCurrent status: *${global.antiphotoState}*` });
    }
};

// 2. The Interceptor (Checks every message and deletes if it's a photo)
const checkAntiPhoto = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, senderId) => {
    if (global.antiphotoState !== 'on') return false;
    if (!isGroup || isSenderAdmin || message.key.fromMe) return false;

    const msgContent = message.message?.ephemeralMessage?.message || message.message?.viewOnceMessageV2?.message || message.message?.documentWithCaptionMessage?.message || message.message;
    const isPhoto = msgContent?.imageMessage;

    if (isPhoto) {
        if (isBotAdmin) {
            await sock.sendMessage(chatId, { delete: message.key });
            await sock.sendMessage(chatId, { text: `🖼️ 🚫 @${senderId.split('@')[0]}, photos are disabled!`, mentions: [senderId] });
        }
        return true; // Tells main.js to stop
    }
    return false;
};

module.exports = { antiphotoCommand, checkAntiPhoto };