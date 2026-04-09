const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363404186001130@newsletter',
            newsletterName: 'LEE TECHBot MD',
            serverMessageId: -1
        }
    }
};

const configPath = path.join(__dirname, '../data/autoStatus.json');

if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ 
        enabled: false, 
        reactOn: false,
        emoji: 'random' 
    }));
}

async function autoStatusCommand(sock, chatId, msg, args) {
    try {
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!msg.key.fromMe && !isOwner) {
            return await sock.sendMessage(chatId, { text: '❌ This command can only be used by the owner!', ...channelInfo });
        }

        let config = JSON.parse(fs.readFileSync(configPath));

        if (!args || args.length === 0) {
            const status = config.enabled ? 'ON ✅' : 'OFF ❌';
            const reactStatus = config.reactOn ? 'ON ✅' : 'OFF ❌';
            const currentEmoji = config.emoji === 'random' ? 'Random 🎲' : config.emoji;
            
            await sock.sendMessage(chatId, { 
                text: `🔄 *AUTO STATUS SETTINGS*\n\n👀 *Auto View:* ${status}\n💫 *Auto React:* ${reactStatus}\n🎭 *Reaction Emoji:* ${currentEmoji}\n\n*Commands:*\n➤ .autostatus on/off _(Toggles viewing)_\n➤ .autostatus react on/off _(Toggles reacting)_\n➤ .autostatus emoji <emoji or "random"> _(Sets emoji)_`,
                ...channelInfo
            });
            return;
        }

        const command = args[0].toLowerCase();
        
        if (command === 'on') {
            config.enabled = true;
            fs.writeFileSync(configPath, JSON.stringify(config));
            await sock.sendMessage(chatId, { text: '✅ *Auto-View Enabled!*\nBot will now automatically read all statuses.', ...channelInfo });
        } else if (command === 'off') {
            config.enabled = false;
            fs.writeFileSync(configPath, JSON.stringify(config));
            await sock.sendMessage(chatId, { text: '❌ *Auto-View Disabled!*\nBot will no longer read statuses.', ...channelInfo });
        } else if (command === 'react') {
            if (!args[1]) return await sock.sendMessage(chatId, { text: '❌ Please specify on/off!\nUse: *.autostatus react on*', ...channelInfo });
            
            const reactCommand = args[1].toLowerCase();
            if (reactCommand === 'on') {
                config.reactOn = true;
                fs.writeFileSync(configPath, JSON.stringify(config));
                await sock.sendMessage(chatId, { text: `💫 *Auto-React Enabled!*\nBot will now react to statuses.`, ...channelInfo });
            } else if (reactCommand === 'off') {
                config.reactOn = false;
                fs.writeFileSync(configPath, JSON.stringify(config));
                await sock.sendMessage(chatId, { text: '❌ *Auto-React Disabled!*\nBot will no longer react to statuses.', ...channelInfo });
            }
        } else if (command === 'emoji') {
            if (!args[1]) return await sock.sendMessage(chatId, { text: '❌ Please provide an emoji or type "random"!\nUse: *.autostatus emoji 🥳* OR *.autostatus emoji random*', ...channelInfo });
            
            const newEmoji = args[1].toLowerCase() === 'random' ? 'random' : args[1];
            config.emoji = newEmoji;
            fs.writeFileSync(configPath, JSON.stringify(config));
            
            const displayEmoji = newEmoji === 'random' ? 'Random 🎲' : newEmoji;
            await sock.sendMessage(chatId, { text: `🎭 *Emoji Updated!*\nThe bot will now react to statuses using: ${displayEmoji}`, ...channelInfo });
        } else {
            await sock.sendMessage(chatId, { text: '❌ Invalid command!', ...channelInfo });
        }
    } catch (error) {
        console.error('Error in autostatus command:', error);
        await sock.sendMessage(chatId, { text: '❌ Error occurred while managing auto status!', ...channelInfo });
    }
}

// 🔧 FIXED REACTION FUNCTION
async function reactToStatus(sock, statusKey, emoji) {
    try {
        // You MUST target the user who posted the status, not the broadcast channel
        const sender = statusKey.participant || statusKey.remoteJid;
        
        await sock.sendMessage(sender, {
            react: {
                text: emoji,
                key: statusKey
            }
        });
    } catch (error) {
        console.error('❌ Error reacting to status:', error.message);
    }
}

async function handleStatusUpdate(sock, status) {
    try {
        let config;
        try {
            config = JSON.parse(fs.readFileSync(configPath));
        } catch (e) { return; }

        const shouldView = config.enabled;
        const shouldReact = config.reactOn;
        const emojiSetting = config.emoji || 'random';

        if (!shouldView && !shouldReact) return;

        let keysToProcess = [];

        if (status.messages && status.messages.length > 0) {
            for (const msg of status.messages) {
                if (msg.key && msg.key.remoteJid === 'status@broadcast') {
                    keysToProcess.push(msg.key);
                }
            }
        } else if (status.key && status.key.remoteJid === 'status@broadcast') {
            keysToProcess.push(status.key);
        }

        if (keysToProcess.length === 0) return;

        await new Promise(resolve => setTimeout(resolve, 2500));

        const randomEmojis = ['💚', '🔥', '😂', '😍', '👍', '💯', '✨', '🎉', '🙌', '😎', '❤️', '🥰', '🙏'];

        for (const key of keysToProcess) {
            if (shouldView) {
                try {
                    await sock.readMessages([key]);
                } catch (err) {
                    if (err.message?.includes('rate-overlimit')) {
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        await sock.readMessages([key]).catch(()=>null);
                    }
                }
            }

            if (shouldReact) {
                let currentEmoji = emojiSetting;
                if (currentEmoji === 'random') {
                    currentEmoji = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
                }
                await reactToStatus(sock, key, currentEmoji);
            }

            await new Promise(resolve => setTimeout(resolve, 1500));
        }

    } catch (error) {
        console.error('❌ Error in auto status view/react:', error.message);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
};