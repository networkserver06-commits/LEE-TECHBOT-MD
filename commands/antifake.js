global.antifakeState = global.antifakeState || {};
global.fakeLinkWarnCooldown = global.fakeLinkWarnCooldown || {};

const antifakeCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ Bot must be an admin to enforce Anti-Fake.' });

    const arg = userMessage.split(' ')[1]?.toLowerCase();
    
    if (arg === 'on' || arg === 'off') {
        global.antifakeState[chatId] = arg; 
        await sock.sendMessage(chatId, { text: `🛡️ Anti-Fake (Fake Numbers & Scam Links) is now turned *${arg.toUpperCase()}* for this group.` });
    } else {
        const currentState = global.antifakeState[chatId] || 'off';
        await sock.sendMessage(chatId, { text: `📝 Usage: .antifake on/off\nCurrent status in this group: *${currentState}*` });
    }
};

const checkFakeLinks = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, senderId) => {
    if (global.antifakeState[chatId] !== 'on') return false; 
    if (!isGroup || isSenderAdmin || message.key.fromMe) return false; 

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || '';

    const fakeLinkPatterns = [
        /wa\.me\/settings/i, 
        /grabify\.link/i, /iplogger\.org/i, /2no\.co/i, 
        /ngrok\.io/i, 
        /free-.*(nitro|robux|money|followers|likes|diamonds)/i, 
        /gift.*card/i,
        /hack.*(account|whatsapp|fb|insta)/i
    ];

    const isFakeLink = fakeLinkPatterns.some(pattern => pattern.test(text));

    if (isFakeLink) {
        if (isBotAdmin) {
            await sock.sendMessage(chatId, { delete: message.key }); 
            
            const now = Date.now();
            const userKey = `${chatId}-${senderId}`;
            const lastWarned = global.fakeLinkWarnCooldown[userKey] || 0;

            if (now - lastWarned > 10000) {
                const adMessage = `⚠️ @${senderId.split('@')[0]}, malicious/scam links are strictly prohibited!\n\n🤖 *Protected by LEE TECHBOT MD*`;
                
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
                global.fakeLinkWarnCooldown[userKey] = now; 
            }
        }
        return true; 
    }
    return false;
};

module.exports = { antifakeCommand, checkFakeLinks };