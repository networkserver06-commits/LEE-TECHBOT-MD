const fs = require('fs');

function readJsonSafe(path, fallback) {
    try {
        const txt = fs.readFileSync(path, 'utf8');
        return JSON.parse(txt);
    } catch (_) {
        return fallback;
    }
}

const isOwnerOrSudo = require('../lib/isOwner');
const { resolveGroupTarget, targetHelp } = require('../lib/groupTarget');

async function settingsCommand(sock, chatId, message, targetArg = '') {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use this command!' }, { quoted: message });
            return;
        }

        const target = targetArg ? await resolveGroupTarget(sock, chatId, targetArg) : { jid: chatId, source: 'current' };
        if (target.error) {
            await sock.sendMessage(chatId, { text: `❌ ${target.error}\n\n${targetHelp('.settings')}` }, { quoted: message });
            return;
        }
        const targetChatId = target.jid;
        const isGroup = targetChatId.endsWith('@g.us');
        const dataDir = './data';

        // Read saved JSON files for base features
        const mode = readJsonSafe(`${dataDir}/messageCount.json`, { isPublic: true });
        const autoStatus = readJsonSafe(`${dataDir}/autoStatus.json`, { enabled: false });
        const autoread = readJsonSafe(`${dataDir}/autoread.json`, { enabled: false });
        const autotyping = readJsonSafe(`${dataDir}/autotyping.json`, { enabled: false });
        const pmblocker = readJsonSafe(`${dataDir}/pmblocker.json`, { enabled: false });
        const anticall = readJsonSafe(`${dataDir}/anticall.json`, { enabled: false });
        const userGroupData = readJsonSafe(`${dataDir}/userGroupData.json`, {
            antilink: {}, antibadword: {}, welcome: {}, goodbye: {}, chatbot: {}, antitag: {}
        });
        const autoReaction = Boolean(userGroupData.autoReaction);

        const lines = [];
        lines.push('⚙️ *BOT SETTINGS PANEL* ⚙️');
        lines.push('──────────────────');
        lines.push(`🌍 *Mode:* ${mode.isPublic ? 'Public' : 'Private'}`);
        lines.push(`📱 *Auto Status:* ${autoStatus.enabled ? 'ON' : 'OFF'}`);
        lines.push(`👀 *Autoread:* ${autoread.enabled ? 'ON' : 'OFF'}`);
        lines.push(`⌨️ *Autotyping:* ${autotyping.enabled ? 'ON' : 'OFF'}`);
        lines.push(`🚫 *PM Blocker:* ${pmblocker.enabled ? 'ON' : 'OFF'}`);
        lines.push(`📵 *Anticall:* ${anticall.enabled ? 'ON' : 'OFF'}`);
        lines.push(`❤️ *Auto Reaction:* ${autoReaction ? 'ON' : 'OFF'}`);
        
        // Per-group features
        if (isGroup) {
            lines.push('──────────────────');
            lines.push('🏢 *GROUP-SPECIFIC SETTINGS*');
            lines.push('──────────────────');
            
            // From saved JSON data
            const antilinkOn = Boolean(userGroupData.antilink && userGroupData.antilink[targetChatId]?.enabled);
            const antibadwordOn = Boolean(userGroupData.antibadword && userGroupData.antibadword[targetChatId]?.enabled);
            const welcomeOn = Boolean(userGroupData.welcome && userGroupData.welcome[targetChatId]?.enabled);
            const goodbyeOn = Boolean(userGroupData.goodbye && userGroupData.goodbye[targetChatId]?.enabled);
            const chatbotOn = Boolean(userGroupData.chatbot && userGroupData.chatbot[targetChatId]?.enabled);
            const antitagCfg = userGroupData.antitag && userGroupData.antitag[targetChatId];

            lines.push(`🔗 *Antilink:* ${antilinkOn ? 'ON' : 'OFF'}`);
            lines.push(`🤬 *Antibadword:* ${antibadwordOn ? 'ON' : 'OFF'}`);
            lines.push(`🏷️ *Antitag:* ${(antitagCfg && antitagCfg.enabled) ? 'ON' : 'OFF'}`);
            lines.push(`👋 *Welcome:* ${welcomeOn ? 'ON' : 'OFF'}`);
            lines.push(`🚪 *Goodbye:* ${goodbyeOn ? 'ON' : 'OFF'}`);
            lines.push(`🤖 *Chatbot:* ${chatbotOn ? 'ON' : 'OFF'}`);

            // New Features from Live Global Memory
            const getTargetGroupState = (stateObj) => (stateObj && stateObj[targetChatId] === 'on') ? 'ON' : 'OFF';
            lines.push(`🚫 *Anti-Sticker:* ${getTargetGroupState(global.antistickerState)}`);
            lines.push(`🖼️ *Anti-Photo:* ${getTargetGroupState(global.antiphotoState)}`);
            lines.push(`👁️ *Anti-ViewOnce:* ${getTargetGroupState(global.antiviewonceState)}`);
            lines.push(`🛡️ *Anti-Fake / Links:* ${getTargetGroupState(global.antifakeState)}`);
            
            // Anti-Bot is now a group-specific object, so we extract the status and action!
            const botState = global.antibotState && global.antibotState[targetChatId];
            const botStatus = (botState && botState.status === 'on') ? `ON (${botState.action.toUpperCase()})` : 'OFF';
            lines.push(`🤖 *Anti-Bot:* ${botStatus}`);
            
            // Global Toggles (Applies everywhere if ON)
            lines.push(`\n*Global Protections:*`);
            lines.push(`🛑 *Anti-Spam:* ${global.antispamState === 'on' ? 'ON' : 'OFF'}`);
            lines.push(`📥 *Auto-DL:* ${global.autodlState === 'on' ? 'ON' : 'OFF'}`);

            lines.push(`\n🎯 *Target:* ${target.subject || targetChatId}\n🆔 ${targetChatId}`);
        } else {
            lines.push('──────────────────');
            lines.push('ℹ️ *Note:* Use this command inside a group chat to view Group-Specific protections (Anti-Link, Anti-Sticker, Anti-Fake, Anti-Bot, etc).');
        }

        await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
    } catch (error) {
        console.error('Error in settings command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to read settings.' }, { quoted: message });
    }
}

module.exports = settingsCommand;
