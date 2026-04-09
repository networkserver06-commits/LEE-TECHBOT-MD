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

// Path to store auto status configuration
const configPath = path.join(__dirname, '../data/autoStatus.json');

// Initialize config file if it doesn't exist
if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ 
        enabled: false, 
        reactOn: false,
        emoji: 'random' // Defaulting to random because it's awesome!
    }));
}

async function autoStatusCommand(sock, chatId, msg, args) {
    try {
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!msg.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command can only be used by the owner!',
                ...channelInfo
            });
            return;
        }

        // Read current config
        let config = JSON.parse(fs.readFileSync(configPath));

        // If no arguments, show current status menu
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
            if (!args[1]) {
                return await sock.sendMessage(chatId, { text: '❌ Please specify on/off!\nUse: *.autostatus react on*', ...channelInfo });
            }
            
            const reactCommand = args[1].toLowerCase();
            if (reactCommand === 'on') {
                config.reactOn = true;
                fs.writeFileSync(configPath, JSON.stringify(config));
                await sock.sendMessage(chatId, { text: `💫 *Auto-React Enabled!*\nBot will now react to statuses.`, ...channelInfo });
            } else if (reactCommand === 'off') {
                config.reactOn = false;
                fs.writeFileSync(configPath, JSON.stringify(config));
                await sock.sendMessage(chatId, { text: '❌ *Auto-React Disabled!*\nBot will no longer react to statuses.', ...channelInfo });
            } else {
                await sock.sendMessage(chatId, { text: '❌ Invalid command! Use: *.autostatus react on/off*', ...channelInfo });
            }
            
        } else if (command === 'emoji') {
            if (!args[1]) {
                return await sock.sendMessage(chatId, { text: '❌ Please provide an emoji or type "random"!\nUse: *.autostatus emoji 🥳* OR *.autostatus emoji random*', ...channelInfo });
            }
            
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
        await sock.sendMessage(chatId, { text: '❌ Error occurred while managing auto status!\n' + error.message, ...channelInfo });
    }
}

// Function to react to status using proper relay method
async function reactToStatus(sock, statusKey, emoji) {
    try {
        await sock.relayMessage(
            'status@broadcast',
            {
                reactionMessage: {
                    key: {
                        remoteJid: 'status@broadcast',
                        id: statusKey.id,
                        participant: statusKey.participant || statusKey.remoteJid,
                        fromMe: false
                    },
                    text: emoji
                }
            },
            {
                messageId: statusKey.id,
                statusJidList: [statusKey.participant || statusKey.remoteJid]
            }
        );
    } catch (error) {
        console.error('❌ Error reacting to status:', error.message);
    }
}

// Function to handle status updates
async function handleStatusUpdate(sock, status) {
    try {
        let config;
        try {
            config = JSON.parse(fs.readFileSync(configPath));
        } catch (e) {
            return; // If file is broken, do nothing
        }

        const shouldView = config.enabled;
        const shouldReact = config.reactOn;
        const emojiSetting = config.emoji || 'random';

        // If BOTH are disabled, skip processing entirely
        if (!shouldView && !shouldReact) return;

        // Extract the status keys from Baileys
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

        // Add initial delay to look natural and prevent instant-read bans
        await new Promise(resolve => setTimeout(resolve, 2500));

        // Pool of natural reactions for random mode
        const randomEmojis = ['💚', '🔥', '😂', '😍', '👍', '💯', '✨', '🎉', '🙌', '😎', '❤️', '🥰', '🙏'];

        // Process each status independently
        for (const key of keysToProcess) {
            // 1. View it if viewing is ON
            if (shouldView) {
                try {
                    await sock.readMessages([key]);
                } catch (err) {
                    if (err.message?.includes('rate-overlimit')) {
                        console.log('⚠️ Rate limit hit while reading status, pausing...');
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        await sock.readMessages([key]).catch(()=>null);
                    }
                }
            }

            // 2. React to it if reacting is ON
            if (shouldReact) {
                let currentEmoji = emojiSetting;
                
                // If set to random, pick one from the array!
                if (currentEmoji === 'random') {
                    currentEmoji = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
                }

                await reactToStatus(sock, key, currentEmoji);
            }

            // Small delay between multiple statuses from the same person
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

    } catch (error) {
        console.error('❌ Error in auto status view/react:', error.message);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
};