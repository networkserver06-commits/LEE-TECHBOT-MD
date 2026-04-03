global.alwaysOnlineState = global.alwaysOnlineState || 'off';
global.onlineInterval = global.onlineInterval || null;

const alwaysonlineCommand = async (sock, chatId, message, isOwnerOrSudoCheck, userMessage) => {
    // Only the owner should control the bot's core presence
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use this command.' }, { quoted: message });
    }

    const arg = userMessage.split(' ')[1]?.toLowerCase();

    if (arg === 'on') {
        global.alwaysOnlineState = 'on';
        
        // Clear any existing loop just in case
        if (global.onlineInterval) clearInterval(global.onlineInterval);
        
        // 1. Immediately set to online
        await sock.sendPresenceUpdate('available');
        
        // 2. Start a background heartbeat loop (Ping WhatsApp every 10 seconds)
        global.onlineInterval = setInterval(async () => {
            try {
                await sock.sendPresenceUpdate('available');
            } catch (err) {
                // Ignore minor connection hiccups
            }
        }, 10000); 

        await sock.sendMessage(chatId, { text: '🟢 *Always Online* is now activated. The bot will appear online 24/7!' });
        
    } else if (arg === 'off') {
        global.alwaysOnlineState = 'off';
        
        // Stop the heartbeat
        if (global.onlineInterval) {
            clearInterval(global.onlineInterval);
            global.onlineInterval = null;
        }
        
        // Let WhatsApp naturally hide the online status
        await sock.sendPresenceUpdate('unavailable');
        await sock.sendMessage(chatId, { text: '🔴 *Always Online* is now deactivated.' });
        
    } else {
        await sock.sendMessage(chatId, { text: `📝 Usage: .alwaysonline on/off\nCurrent status: *${global.alwaysOnlineState}*` });
    }
};

module.exports = alwaysonlineCommand;