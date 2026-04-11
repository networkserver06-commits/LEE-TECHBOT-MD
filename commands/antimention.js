const fs = require('fs');
const path = require('path');

// 1. Setup Permanent Storage
const dbPath = path.join(__dirname, '../data/antimention.json');

// Create the file if it doesn't exist yet
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({}));
}

// Load saved states into global memory on startup
global.antimentionState = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
global.mentionWarnCooldown = {}; // Keep cooldowns in temporary memory

const antimentionCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Only admins can use this command.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ Make the bot an admin first to delete mentions.' });

    const arg = userMessage.split(' ')[1]?.toLowerCase();
    
    if (arg === 'on' || arg === 'off') {
        global.antimentionState[chatId] = arg; 
        
        // SAVE TO DISK PERMANENTLY
        fs.writeFileSync(dbPath, JSON.stringify(global.antimentionState, null, 2));
        
        await sock.sendMessage(chatId, { text: `🚫 Anti-Mention is now  turned *${arg.toUpperCase()}* for this group.\n\n_Non-admins who tag others will have their messages deleted._` });
    } else {
        const currentState = global.antimentionState[chatId] || 'off';
        await sock.sendMessage(chatId, { text: `📝 Usage: .antimention on/off\nCurrent status in this group: *${currentState}*` });
    }
};

const checkAntiMention = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, senderId) => {
    // If feature is off, or user is admin, or it's the bot itself -> ignore
    if (global.antimentionState[chatId] !== 'on') return false;
    if (!isGroup || isSenderAdmin || message.key.fromMe) return false;

    // Check if the message contains any @mentions
    const mentionedJidList = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentionedJidList.length > 0) {
        if (isBotAdmin) {
            // Delete the message containing the mention
            await sock.sendMessage(chatId, { delete: message.key }).catch(()=>null); 
            
            const now = Date.now();
            const userKey = `${chatId}-${senderId}`; 
            const lastWarned = global.mentionWarnCooldown[userKey] || 0;

            // Warn the user (with a 10-second cooldown so the bot doesn't spam)
            if (now - lastWarned > 10000) {
                const adMessage = `🚫 @${senderId.split('@')[0]}, mentioning/tagging users is not allowed in this group!\n\n🤖 *Protected by LEE TECHBOT MD*`;

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
                }).catch(()=>null);
                
                global.mentionWarnCooldown[userKey] = now; 
            }
        }
        return true; // Tells the bot to stop processing this message
    }
    return false;
};

module.exports = { antimentionCommand, checkAntiMention };