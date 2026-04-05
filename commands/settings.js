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

async function settingsCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use this command!' }, { quoted: message });
            return;
        }

        const isGroup = chatId.endsWith('@g.us');
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
            const antilinkOn = Boolean(userGroupData.antilink && userGroupData.antilink[chatId]);
            const antibadwordOn = Boolean(userGroupData.antibadword && userGroupData.antibadword[chatId]);
            const welcomeOn = Boolean(userGroupData.welcome && userGroupData.welcome[chatId]);
            const goodbyeOn = Boolean(userGroupData.goodbye && userGroupData.goodbye[chatId]);
            const chatbotOn = Boolean(userGroupData.chatbot && userGroupData.chatbot[chatId]);
            const antitagCfg = userGroupData.antitag && userGroupData.antitag[chatId];

            lines.push(`🔗 *Antilink:* ${antilinkOn ? 'ON' : 'OFF'}`);
            lines.push(`🤬 *Antibadword:* ${antibadwordOn ? 'ON' : 'OFF'}`);
            lines.push(`🏷️ *Antitag:* ${(antitagCfg && antitagCfg.enabled) ? 'ON' : 'OFF'}`);
            lines.push(`👋 *Welcome:* ${welcomeOn ? 'ON' : 'OFF'}`);
            lines.push(`🚪 *Goodbye:* ${goodbyeOn ? 'ON' : 'OFF'}`);
            lines.push(`🤖 *Chatbot:* ${chatbotOn ? 'ON' : 'OFF'}`);

            // Function to safely check our new dynamic memory objects
            const getGroupState = (stateObj) => (stateObj && stateObj[chatId] === 'on') ? 'ON' : 'OFF';

            // New Features from Live Global Memory
            lines.push(`🚫 *Anti-Sticker:* ${getGroupState(global.antistickerState)}`);
            lines.push(`🖼️ *Anti-Photo:* ${getGroupState(global.antiphotoState)}`);
            lines.push(`🛡️ *Anti-Fake / Links:* ${getGroupState(global.antifakeState)}`);
            
            // Anti-Bot is now a group-specific object, so we extract the status and action!
            const botState = global.antibotState && global.antibotState[chatId];
            const botStatus = (botState && botState.status === 'on') ? `ON (${botState.action.toUpperCase()})` : 'OFF';
            lines.push(`🤖 *Anti-Bot:* ${botStatus}`);
            
            // Global Toggles (Applies everywhere if ON)
            lines.push(`\n*Global Protections:*`);
            lines.push(`🛑 *Anti-Spam:* ${global.antispamState === 'on' ? 'ON' : 'OFF'}`);
            lines.push(`📥 *Auto-DL:* ${global.autodlState === 'on' ? 'ON' : 'OFF'}`);

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