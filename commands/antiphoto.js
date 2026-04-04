global.antiphotoState = global.antiphotoState || 'off';

// 1. The Toggle Command
const antiphotoCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });

    const arg = userMessage.split(' ')[1]?.toLowerCase();
    
    if (arg === 'on' || arg === 'off') {
        global.antiphotoState = arg;
        await sock.sendMessage(chatId, { text: `🖼️ Anti-Photo is now turned *${arg.toUpperCase()}*` });
    } else {
        await sock.sendMessage(chatId, { text: `📝 Usage: .antiphoto on/off\nCurrent status: *${global.antiphotoState}*` });
    }
};

// 2. The Merciless Interceptor
const checkAntiPhoto = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, senderId) => {
    if (global.antiphotoState !== 'on') return false;
    if (!isGroup) return false;

    // Look deep into the message layers
    const msgContent = message.message?.ephemeralMessage?.message || message.message?.viewOnceMessageV2?.message || message.message?.documentWithCaptionMessage?.message || message.message;
    const isPhoto = msgContent?.imageMessage;

    if (isPhoto) {
        console.log(`⚠️ PHOTO DETECTED from ${senderId}!`);
        
        if (isBotAdmin) {
            console.log(`🗑️ Bot is admin. Deleting photo now...`);
            await sock.sendMessage(chatId, { delete: message.key });
            await sock.sendMessage(chatId, { text: `🖼️ 🚫 @${senderId.split('@')[0]}, photos are disabled!`, mentions: [senderId] });
        } else {
            console.log(`❌ Bot is NOT admin. Cannot delete.`);
            await sock.sendMessage(chatId, { text: `⚠️ I caught a photo, but I am not a Group Admin so I cannot delete it!` });
        }
        return true; // Stop processing
    }
    return false;
};

module.exports = { antiphotoCommand, checkAntiPhoto };