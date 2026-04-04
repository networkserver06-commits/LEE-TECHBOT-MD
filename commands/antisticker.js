global.antistickerState = global.antistickerState || {};
global.stickerWarnCooldown = global.stickerWarnCooldown || {}; 

const antistickerCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ Bot must be an admin to delete stickers.' });

    const arg = userMessage.split(' ')[1]?.toLowerCase();
    
    if (arg === 'on' || arg === 'off') {
        global.antistickerState[chatId] = arg; 
        await sock.sendMessage(chatId, { text: `🚫 Anti-Sticker is now turned *${arg.toUpperCase()}* for this group.` });
    } else {
        const currentState = global.antistickerState[chatId] || 'off';
        await sock.sendMessage(chatId, { text: `📝 Usage: .antisticker on/off\nCurrent status in this group: *${currentState}*` });
    }
};

const checkAntiSticker = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, senderId) => {
    if (global.antistickerState[chatId] !== 'on') return false; 
    if (!isGroup || isSenderAdmin || message.key.fromMe) return false; 

    const msgContent = message.message?.ephemeralMessage?.message || message.message?.viewOnceMessageV2?.message || message.message?.documentWithCaptionMessage?.message || message.message;
    const isSticker = msgContent?.stickerMessage;

    if (isSticker) {
        if (isBotAdmin) {
            await sock.sendMessage(chatId, { delete: message.key }); 
            
            const now = Date.now();
            const userKey = `${chatId}-${senderId}`; 
            const lastWarned = global.stickerWarnCooldown[userKey] || 0;

            if (now - lastWarned > 10000) {
                const adMessage = `🚫 @${senderId.split('@')[0]}, stickers are not allowed here!\n\n🤖 *Protected by LEE TECHBOT MD*`;
                
                await sock.sendMessage(chatId, { 
                    text: adMessage, 
                    mentions: [senderId],
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363404186001130@newsletter',
                            newsletterName: 'LEE TECHBOT MD',
                            serverMessageId: -1
                        }
                    }
                });
                global.stickerWarnCooldown[userKey] = now; 
            }
        }
        return true; 
    }
    return false;
};

module.exports = { antistickerCommand, checkAntiSticker };