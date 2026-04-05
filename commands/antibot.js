// Store settings per group
global.antibotState = global.antibotState || {};
global.botWarnCooldown = global.botWarnCooldown || {};

// 1. The Toggle Command
const antibotCommand = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) => {
    if (!isGroup) return await sock.sendMessage(chatId, { text: '❌ Groups only.' });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return await sock.sendMessage(chatId, { text: '❌ Admins only.' });
    if (!isBotAdmin) return await sock.sendMessage(chatId, { text: '❌ Bot must be an admin to enforce Anti-Bot.' });

    const args = userMessage.split(' ').slice(1);
    const commandArg = args[0]?.toLowerCase();
    const actionArg = args[1]?.toLowerCase();

    // Initialize group state if it doesn't exist yet
    if (!global.antibotState[chatId]) {
        global.antibotState[chatId] = { status: 'off', action: 'kick' };
    }

    if (commandArg === 'on' || commandArg === 'off') {
        global.antibotState[chatId].status = commandArg;
        await sock.sendMessage(chatId, { text: `🤖 Anti-Bot is now turned *${commandArg.toUpperCase()}* for this group.\nCurrent Action: *${global.antibotState[chatId].action.toUpperCase()}*` });
    } else if (commandArg === 'action' && ['kick', 'warn', 'delete'].includes(actionArg)) {
        global.antibotState[chatId].action = actionArg;
        await sock.sendMessage(chatId, { text: `🤖 Anti-Bot action set to *${actionArg.toUpperCase()}* for this group.` });
    } else {
        const currentStatus = global.antibotState[chatId].status;
        const currentAction = global.antibotState[chatId].action;
        await sock.sendMessage(chatId, { 
            text: `📝 *Usage:*\n.antibot on/off\n.antibot action [kick/warn/delete]\n\n*Current Status:* ${currentStatus.toUpperCase()}\n*Current Action:* ${currentAction.toUpperCase()}` 
        });
    }
};

// 2. The Anti-Bot Interceptor
const checkAntiBot = async (sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, senderId) => {
    const state = global.antibotState[chatId];
    
    // Only trigger if THIS specific group has it turned 'on'
    if (!state || state.status !== 'on') return false; 
    
    // IMMUNITY: Admins, Bot, and Owner
    if (!isGroup || isSenderAdmin || message.key.fromMe) return false; 

    // Look for common Bot ID patterns (Baileys, etc.)
    const msgId = message.key.id;
    const isSuspectedBot = msgId.startsWith('BAE5') || msgId.startsWith('3EB0') || msgId.length === 22 || msgId.length === 16;

    if (isSuspectedBot) {
        if (isBotAdmin) {
            const action = state.action || 'kick';

            if (action === 'delete') {
                // Strictly delete the message silently
                await sock.sendMessage(chatId, { delete: message.key });
                
            } else if (action === 'warn') {
                // Delete and warn
                await sock.sendMessage(chatId, { delete: message.key });
                
                const now = Date.now();
                const userKey = `${chatId}-${senderId}`;
                if (now - (global.botWarnCooldown[userKey] || 0) > 10000) {
                    await sock.sendMessage(chatId, { 
                        text: `⚠️ @${senderId.split('@')[0]}, unauthorized bot scripts are not allowed here!`, 
                        mentions: [senderId] 
                    });
                    global.botWarnCooldown[userKey] = now;
                }
                
            } else if (action === 'kick') {
                // Delete, announce, and remove
                await sock.sendMessage(chatId, { text: `🤖 *Unauthorized Bot Detected!*\n\nRemoving @${senderId.split('@')[0]}...`, mentions: [senderId] });
                await sock.sendMessage(chatId, { delete: message.key });
                await sock.groupParticipantsUpdate(chatId, [senderId], "remove");
            }
        }
        return true; // Stop processing further commands
    }
    return false;
};

module.exports = { antibotCommand, checkAntiBot };