global.antiphotoState = global.antiphotoState || {};
global.photoWarnCooldown = global.photoWarnCooldown || {}; 

const antiphotoCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ Bot must be an admin to delete photos.' });

    const arg = userMessage.split(' ')[1]?.toLowerCase();
    
    if (arg === 'on' || arg === 'off') {
        global.antiphotoState[chatId] = arg; 
        await sock.sendMessage(chatId, { text: `🖼️ Anti-Photo is now turned *${arg.toUpperCase()}* for this group.` });
    } else {
        const currentState = global.antiphotoState[chatId] || 'off';
        await sock.sendMessage(chatId, { text: `📝 Usage: .antiphoto on/off\nCurrent status in this group: *${currentState}*` });
    }
};

const checkAntiPhoto = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, senderId) => {
    if (global.antiphotoState[chatId] !== 'on') return false;
    if (!isGroup || isSenderAdmin || message.key.fromMe) return false;

    const msgContent = message.message?.ephemeralMessage?.message || message.message?.viewOnceMessageV2?.message || message.message?.documentWithCaptionMessage?.message || message.message;
    const isPhoto = msgContent?.imageMessage;

    if (isPhoto) {
        if (isBotAdmin) {
            await sock.sendMessage(chatId, { delete: message.key }); 
            
            const now = Date.now();
            const userKey = `${chatId}-${senderId}`; 
            const lastWarned = global.photoWarnCooldown[userKey] || 0;

            if (now - lastWarned > 10000) {
                const adMessage = `🖼️ 🚫 @${senderId.split('@')[0]}, photos are not allowed here!\n\n🤖 *Protected by LEE TECHBOT MD*`;

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
                global.photoWarnCooldown[userKey] = now; 
            }
        }
        return true; 
    }
    return false;
};

module.exports = { antiphotoCommand, checkAntiPhoto };