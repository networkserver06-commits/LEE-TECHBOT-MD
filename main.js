// 🧹 Fix for ENOSPC / temp overflow in hosted panels
const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys'); 

// ==========================================
// 1. INITIALIZE GLOBAL PREFIX PERMANENTLY
// ==========================================
let currentPrefix = '.'; // Fallback default
try {
    const prefixPath = path.join(__dirname, './data/prefix.json');
    if (fs.existsSync(prefixPath)) {
        const prefixData = JSON.parse(fs.readFileSync(prefixPath, 'utf8'));
        currentPrefix = prefixData.prefix || '.';
    }
} catch (e) {
    console.log("Error loading prefix, using default.");
}
global.prefix = currentPrefix; // Make sure the bot memory knows the prefix!

// ==========================================
// 2. TEMP FOLDER MANAGEMENT
// ==========================================
const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

setInterval(() => {
    fs.readdir(customTemp, (err, files) => {
        if (err) return;
        for (const file of files) {
            const filePath = path.join(customTemp, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && Date.now() - stats.mtimeMs > 3 * 60 * 60 * 1000) {
                    fs.unlink(filePath, () => { }).catch(()=>null);
                }
            });
        }
    });
    console.log('🧹 Temp folder auto-cleaned');
}, 3 * 60 * 60 * 1000);

// ==========================================
// 3. IMPORTS
// ==========================================
const settings = require('./settings');
require('./config.js');
const { isBanned } = require('./lib/isBanned');
const yts = require('yt-search');
const { fetchBuffer } = require('./lib/myfunc');
const fetch = require('node-fetch');
const ytdl = require('ytdl-core');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const { isSudo } = require('./lib/index');
const isOwnerOrSudo = require('./lib/isOwner');
const { autotypingCommand, isAutotypingEnabled, handleAutotypingForMessage, handleAutotypingForCommand, showTypingAfterCommand } = require('./commands/autotyping');
const { autoreadCommand, isAutoreadEnabled, handleAutoread } = require('./commands/autoread');

// Command imports
const tagAllCommand = require('./commands/tagall');
const helpCommand = require('./commands/help');
const banCommand = require('./commands/ban');
const { promoteCommand } = require('./commands/promote');
const { demoteCommand } = require('./commands/demote');
const muteCommand = require('./commands/mute');
const unmuteCommand = require('./commands/unmute');
const stickerCommand = require('./commands/sticker');
const isAdmin = require('./lib/isAdmin');
const warnCommand = require('./commands/warn');
const warningsCommand = require('./commands/warnings');
const ttsCommand = require('./commands/tts');
const { tictactoeCommand, handleTicTacToeMove } = require('./commands/tictactoe');
const { incrementMessageCount, topMembers } = require('./commands/topmembers');
const ownerCommand = require('./commands/owner');
const deleteCommand = require('./commands/delete');
const { handleAntilinkCommand, handleLinkDetection } = require('./commands/antilink');
const { handleAntitagCommand, handleTagDetection } = require('./commands/antitag');
const { Antilink } = require('./lib/antilink');
const { handleMentionDetection, mentionToggleCommand, setMentionCommand } = require('./commands/mention');
const memeCommand = require('./commands/meme');
const tagCommand = require('./commands/tag');
const tagNotAdminCommand = require('./commands/tagnotadmin');
const hideTagCommand = require('./commands/hidetag');
const jokeCommand = require('./commands/joke');
const quoteCommand = require('./commands/quote');
const factCommand = require('./commands/fact');
const weatherCommand = require('./commands/weather');
const newsCommand = require('./commands/news');
const kickCommand = require('./commands/kick');
const kickallcommand = require('./commands/kickall');
const simageCommand = require('./commands/simage');
const attpCommand = require('./commands/attp');
const { startHangman, guessLetter } = require('./commands/hangman');
const { startTrivia, answerTrivia } = require('./commands/trivia');
const { complimentCommand } = require('./commands/compliment');
const { insultCommand } = require('./commands/insult');
const { eightBallCommand } = require('./commands/eightball');
const { lyricsCommand } = require('./commands/lyrics');
const { dareCommand } = require('./commands/dare');
const { truthCommand } = require('./commands/truth');
const { clearCommand } = require('./commands/clear');
const pingCommand = require('./commands/ping');
const aliveCommand = require('./commands/alive');
const blurCommand = require('./commands/img-blur');
const { welcomeCommand, handleJoinEvent } = require('./commands/welcome');
const { goodbyeCommand, handleLeaveEvent } = require('./commands/goodbye');
const githubCommand = require('./commands/github');
const { handleAntiBadwordCommand, handleBadwordDetection } = require('./lib/antibadword');
const antibadwordCommand = require('./commands/antibadword');
const { handleChatbotCommand, handleChatbotResponse } = require('./commands/chatbot');
const takeCommand = require('./commands/take');
const { flirtCommand } = require('./commands/flirt');
const characterCommand = require('./commands/character');
const wastedCommand = require('./commands/wasted');
const shipCommand = require('./commands/ship');
const groupInfoCommand = require('./commands/groupinfo');
const resetlinkCommand = require('./commands/resetlink');
const staffCommand = require('./commands/staff');
const unbanCommand = require('./commands/unban');
const emojimixCommand = require('./commands/emojimix');
const { handlePromotionEvent } = require('./commands/promote');
const { handleDemotionEvent } = require('./commands/demote');
const viewOnceCommand = require('./commands/viewonce');
const clearSessionCommand = require('./commands/clearsession');
const { autoStatusCommand, handleStatusUpdate } = require('./commands/autostatus');
const { simpCommand } = require('./commands/simp');
const { stupidCommand } = require('./commands/stupid');
const stickerTelegramCommand = require('./commands/stickertelegram');
const textmakerCommand = require('./commands/textmaker');
const { handleAntideleteCommand, handleMessageRevocation, storeMessage } = require('./commands/antidelete');
const clearTmpCommand = require('./commands/cleartmp');
const setProfilePicture = require('./commands/setpp');
const { setGroupDescription, setGroupName, setGroupPhoto } = require('./commands/groupmanage');
const instagramCommand = require('./commands/instagram');
const facebookCommand = require('./commands/facebook');
const spotifyCommand = require('./commands/spotify');
const playCommand = require('./commands/play');
const tiktokCommand = require('./commands/tiktok');
const songCommand = require('./commands/song');
const aiCommand = require('./commands/ai');
const urlCommand = require('./commands/url');
const { handleTranslateCommand } = require('./commands/translate');
const { handleSsCommand } = require('./commands/ss');
const { addCommandReaction, handleAreactCommand } = require('./lib/reactions');
const { goodnightCommand } = require('./commands/goodnight');
const { shayariCommand } = require('./commands/shayari');
const { rosedayCommand } = require('./commands/roseday');
const imagineCommand = require('./commands/imagine');
const videoCommand = require('./commands/video');
const sudoCommand = require('./commands/sudo');
const { miscCommand, handleHeart } = require('./commands/misc');
const { animeCommand } = require('./commands/anime');
const { piesCommand, piesAlias } = require('./commands/pies');
const stickercropCommand = require('./commands/stickercrop');
const updateCommand = require('./commands/update');
const removebgCommand = require('./commands/removebg');
const { reminiCommand } = require('./commands/remini');
const { igsCommand } = require('./commands/igs');
const { anticallCommand, readState: readAnticallState } = require('./commands/anticall');
const { pmblockerCommand, readState: readPmBlockerState } = require('./commands/pmblocker');
const settingsCommand = require('./commands/settings');
const soraCommand = require('./commands/sora');
const creategroupCommand = require('./commands/creategroup');
const addCommand = require('./commands/add');
const leaveCommand = require('./commands/leave');
const vcfCommand = require('./commands/vcf');
const antimentionCommand = require('./commands/antimention');
const joinapprovalCommand = require('./commands/joinapproval');
const savestatusCommand = require('./commands/savestatus');
const vv2Command = require('./commands/vv2');
const broadcastCommand = require('./commands/broadcast');
const nightmodeCommand = require('./commands/nightmode');
const backupCommand = require('./commands/backup');
const antispamCommand = require('./commands/antispam');
const evalCommand = require('./commands/eval');
const autodlCommand = require('./commands/autodl');
const autobioCommand = require('./commands/autobio');
const alwaysonlineCommand = require('./commands/alwaysonline');
const groupVcfCommand = require('./commands/groupvcf');
const setMenuImageCommand = require('./commands/setmenuimage');
const linkCommand = require('./commands/link');
const toStatusCommand = require('./commands/tostatus');
const togStatusCommand = require('./commands/togstatus');

// MODERATION IMPORTS
const { antistickerCommand, checkAntiSticker } = require('./commands/antisticker');
const { antiphotoCommand, checkAntiPhoto } = require('./commands/antiphoto');
const { antifakeCommand, checkFakeLinks } = require('./commands/antifake'); 
const { antibotCommand, checkAntiBot } = require('./commands/antibot'); 

// ==========================================
// 4. GLOBAL SETTINGS
// ==========================================
global.packname = settings.packname || 'LEE TECH';
global.author = settings.author || 'Bot';
global.channelLink = "https://whatsapp.com/channel/0029VbBu1EgJUM2iVI3tPE0S";
global.ytch = "@ServerNetwork-yt";

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363404186001130@newsletter',
            newsletterName: 'LEE TECHBOT MD',
            serverMessageId: -1
        }
    }
};

// ==========================================
// 5. MAIN MESSAGE HANDLER
// ==========================================
async function handleMessages(sock, messageUpdate, printLog) {
    try {
        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;

        const message = messages[0];
        if (!message?.message) return;

        // Handle autoread safely
        await handleAutoread(sock, message).catch(()=>null);

        // Store message for antidelete feature
        if (message.message) {
            try { storeMessage(sock, message); } catch(e) {}
        }

        // Handle message revocation
        if (message.message?.protocolMessage?.type === 0) {
            await handleMessageRevocation(sock, message).catch(()=>null);
            return;
        }

        const chatId = message.key.remoteJid;
        const senderId = message.key.participant || message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        
        // Prevent bot from reading its own broadcasts
        if (chatId === 'status@broadcast') return;

        const senderIsSudo = await isSudo(senderId).catch(()=>false);
        const senderIsOwnerOrSudo = await isOwnerOrSudo(senderId, sock, chatId).catch(()=>false);

        // Handle button responses
        if (message.message?.buttonsResponseMessage) {
            const buttonId = message.message.buttonsResponseMessage.selectedButtonId;
            if (buttonId === 'channel') {
                return await sock.sendMessage(chatId, { text: '📢 *Join our Channel:*\nhttps://whatsapp.com/channel/0029VbBu1EgJUM2iVI3tPE0S' }, { quoted: message });
            } else if (buttonId === 'owner') {
                return await ownerCommand(sock, chatId);
            } else if (buttonId === 'support') {
                return await sock.sendMessage(chatId, { text: `🔗 *Support*\n\nhttps://chat.whatsapp.com/LIjzygth3mvBKUxwgN6zYt?mode=gi_t` }, { quoted: message });
            }
        }

        let userMessage = (
            message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            message.message?.buttonsResponseMessage?.selectedButtonId?.trim() ||
            ''
        ).toLowerCase().replace(/\.\s+/g, '.').trim();

        // Preserve raw message for commands like .tag that need original casing
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';

        // Read bot mode safely
        let isPublic = true;
        try {
            const data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
            if (typeof data.isPublic === 'boolean') isPublic = data.isPublic;
        } catch (error) {}
        const isOwnerOrSudoCheck = message.key.fromMe || senderIsOwnerOrSudo;

        // Check if user is banned
        if (isBanned(senderId) && !userMessage.startsWith('.unban')) {
            if (Math.random() < 0.1) {
                await sock.sendMessage(chatId, { text: '❌ You are banned from using the bot. Contact an admin to get unbanned.', ...channelInfo });
            }
            return;
        }
        
        let isBotAdmin = false;
        let isSenderAdmin = false;

        // Check admin status safely
        if (isGroup) {
            try {
                const adminStatus = await isAdmin(sock, chatId, senderId);
                isSenderAdmin = adminStatus.isSenderAdmin;
                isBotAdmin = adminStatus.isBotAdmin;
            } catch (err) { }
        }

        // Tic Tac Toe Move
        if (/^[1-9]$/.test(userMessage) || userMessage.toLowerCase() === 'surrender') {
            await handleTicTacToeMove(sock, chatId, senderId, userMessage).catch(()=>null);
            return;
        }

        if (!message.key.fromMe) incrementMessageCount(chatId, senderId);

        // =====================================================================
        // THE FRONT-LINE INTERCEPTORS (Badwords, Links, Photos, Stickers, Bots)
        // Wrapped in catches so a single failure doesn't crash the bot
        // =====================================================================
        if (isGroup && !message.key.fromMe) {
            if (userMessage) {
                await handleBadwordDetection(sock, chatId, message, userMessage, senderId).catch(()=>null);
            }
            if (typeof Antilink === 'function') await Antilink(message, sock).catch(()=>null);

            if (await checkAntiBot(sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, senderId).catch(()=>false)) return; 
            if (await checkAntiSticker(sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, senderId).catch(()=>false)) return;
            if (await checkAntiPhoto(sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, senderId).catch(()=>false)) return;
            if (await checkFakeLinks(sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, senderId).catch(()=>false)) return; 
        }

        // PM blocker
        if (!isGroup && !message.key.fromMe && !senderIsSudo) {
            try {
                const pmState = readPmBlockerState();
                if (pmState.enabled) {
                    await sock.sendMessage(chatId, { text: pmState.message || 'Private messages are blocked. Please contact the owner in groups only.' });
                    await new Promise(r => setTimeout(r, 1500));
                    try { await sock.updateBlockStatus(chatId, 'block'); } catch (e) { }
                    return;
                }
            } catch (e) { }
        }

        let actualPrefix = global.prefix === 'none' ? '' : global.prefix;
        let isCmd = false;

        if (actualPrefix === '') {
            isCmd = userMessage.length > 0;
        } else {
            isCmd = userMessage.startsWith(actualPrefix);
        }

        if (!isCmd) {
            await handleAutotypingForMessage(sock, chatId, userMessage).catch(()=>null);

            if (isGroup) {
                await handleTagDetection(sock, chatId, message, senderId).catch(()=>null);
                await handleMentionDetection(sock, chatId, message).catch(()=>null);

                if (isPublic || isOwnerOrSudoCheck) {
                    await handleChatbotResponse(sock, chatId, message, userMessage, senderId).catch(()=>null);
                }
            }
            return;
        }

        // --- AUTO-DOWNLOADER INTERCEPTOR ---
        if (isGroup && global.autodlState === 'on' && !message.key.fromMe) {
            const urlMatch = rawText.match(/(https?:\/\/[^\s]+)/);
            
            if (urlMatch) {
                const extractedUrl = urlMatch[0];
                let mockMessage = JSON.parse(JSON.stringify(message)); 
                
                if (extractedUrl.includes('tiktok.com')) {
                    mockMessage.message = { conversation: `.tiktok ${extractedUrl}` };
                    await tiktokCommand(sock, chatId, mockMessage).catch(()=>null);
                    return; 
                } 
                else if (extractedUrl.includes('instagram.com')) {
                    mockMessage.message = { conversation: `.ig ${extractedUrl}` };
                    await instagramCommand(sock, chatId, mockMessage).catch(()=>null);
                    return;
                } 
                else if (extractedUrl.includes('facebook.com') || extractedUrl.includes('fb.watch')) {
                    mockMessage.message = { conversation: `.fb ${extractedUrl}` };
                    await facebookCommand(sock, chatId, mockMessage).catch(()=>null);
                    return;
                }
            }
        }

        // NORMALIZATION HACK
        if (actualPrefix !== '.' && actualPrefix !== '') {
            userMessage = '.' + userMessage.slice(actualPrefix.length).trim();
        } else if (actualPrefix === '') {
            if (!userMessage.startsWith('.')) {
                userMessage = '.' + userMessage.trim();
            }
        }
        
        console.log(`📝 Command used in ${isGroup ? 'group' : 'private'}: ${userMessage}`);

        if (!isPublic && !isOwnerOrSudoCheck) {
            return;
        }

        // List of admin commands
        const adminCommands = ['.add', '.groupvcf', '.savecontacts', '.extract', '.mute', '.unmute', '.link', '.ban', '.unban', '.promote', '.demote', '.kick', "antifake", '.tagall', '.tagnotadmin', '.hidetag', '.antilink', '.antiphoto', '.antisticker', '.antitag', '.setgdesc', '.setgname', '.setgpp', '.kickall'];
        const isAdminCommand = adminCommands.some(cmd => userMessage.startsWith(cmd));

        // List of owner commands
        const ownerCommands = ['.mode', '.autostatus', '.antidelete', '.cleartmp', '.setpp', '.tostatus', '.togstatus', '.clearsession', '.areact', '.autoreact', '.autotyping', '.autoread', '.pmblocker', '.mention', '.setprefix'];
        const isOwnerCommand = ownerCommands.some(cmd => userMessage.startsWith(cmd));

        // Check admin status only for admin commands in groups
        if (isGroup && isAdminCommand) {
            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { text: 'Please make the bot an admin to use admin commands.', ...channelInfo }, { quoted: message });
                return;
            }

            if (userMessage.startsWith('.mute') || userMessage === '.unmute' || userMessage.startsWith('.ban') || userMessage.startsWith('.unban') || userMessage.startsWith('.promote') || userMessage.startsWith('.demote') || userMessage === '.kickall') {
                if (!isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo }, { quoted: message });
                    return;
                }
            }
        }

        // Check owner status for owner commands
        if (isOwnerCommand) {
            if (!message.key.fromMe && !senderIsOwnerOrSudo) {
                await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner or sudo!' }, { quoted: message });
                return;
            }
        }

        let commandExecuted = false;

        switch (true) {
            case userMessage === '.simage': {
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMessage?.stickerMessage) {
                    await simageCommand(sock, quotedMessage, chatId);
                } else {
                    await sock.sendMessage(chatId, { text: 'Please reply to a sticker with the .simage command to convert it.', ...channelInfo }, { quoted: message });
                }
                commandExecuted = true;
                break;
            }
            case userMessage === '.vv2':
                await vv2Command(sock, chatId, message, isOwnerOrSudoCheck);
                commandExecuted = true;
                break;

            case userMessage === '.savestatus': {
                const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const participant = message.message?.extendedTextMessage?.contextInfo?.participant;
                if (!quotedMsg || !participant?.includes('status@broadcast')) {
                    await sock.sendMessage(chatId, { text: 'Reply to a status update to save it.', ...channelInfo }, { quoted: message });
                    break;
                }
                await sock.sendMessage(senderId, { forward: message.message.extendedTextMessage.contextInfo }, { quoted: message });
                await sock.sendMessage(chatId, { text: 'Status sent to your DM.', ...channelInfo }, { quoted: message });
                commandExecuted = true;
                break;
            }
            
            case userMessage === '.kickall': {
                await sock.sendMessage(chatId, { text: 'Starting group cleanup... please wait.', ...channelInfo }, { quoted: message });
                const groupMetadata = await sock.groupMetadata(chatId);
                const participants = groupMetadata.participants;

                for (let user of participants) {
                    if (!user.admin && user.id !== sock.user.id && user.id !== senderId) {
                        await sock.groupParticipantsUpdate(chatId, [user.id], "remove");
                        await new Promise(r => setTimeout(r, 1000)); 
                    }
                }
                await sock.sendMessage(chatId, { text: 'Cleanup complete. Non-admins removed.', ...channelInfo }, { quoted: message });
                commandExecuted = true;
                break;
            }

            case userMessage.startsWith('.setprefix'): {
                if (!isOwnerOrSudoCheck) {
                    await sock.sendMessage(chatId, { text: '❌ Only the bot owner can change the prefix.', ...channelInfo }, { quoted: message });
                    break;
                }
                const newPrefix = userMessage.split(' ')[1];
                if (!newPrefix) {
                    await sock.sendMessage(chatId, { text: '📝 Please provide a prefix. Example: *.setprefix !* or *.setprefix none*', ...channelInfo }, { quoted: message });
                    break;
                }

                global.prefix = newPrefix.toLowerCase() === 'none' ? '' : newPrefix;
                const displayPrefix = global.prefix === '' ? 'none (No prefix)' : global.prefix;

                const prefixPath = path.join(__dirname, './data/prefix.json');
                fs.writeFileSync(prefixPath, JSON.stringify({ prefix: global.prefix }, null, 2));

                await sock.sendMessage(chatId, { text: `✅ Prefix has been permanently set to: *${displayPrefix}*`, ...channelInfo }, { quoted: message });
                commandExecuted = true;
                break;
            }

            case userMessage.startsWith('.nightmode'):
                await nightmodeCommand(sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, userMessage);
                commandExecuted = true;
                break;
        
            case userMessage.startsWith('.alwaysonline'):
                await alwaysonlineCommand(sock, chatId, message, isOwnerOrSudoCheck, userMessage);
                commandExecuted = true;
                break;
            case userMessage === '.groupvcf' || userMessage === '.savecontacts' || userMessage === '.extract':
                await groupVcfCommand(sock, chatId, message, isGroup, isSenderAdmin, isOwnerOrSudoCheck);
                commandExecuted = true;
                break;

            case userMessage === '.tostatus':
                await toStatusCommand(sock, chatId, message, isOwnerOrSudoCheck);
                commandExecuted = true;
                break;
                
            case userMessage === '.togstatus':
                await togStatusCommand(sock, chatId, message, isOwnerOrSudoCheck, isGroup);
                commandExecuted = true;
                break;

            case userMessage === '.backup':
                await backupCommand(sock, chatId, message, isOwnerOrSudoCheck);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.antibot'):
                await antibotCommand(sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage);
                commandExecuted = true;
                break;

            case userMessage.startsWith('.antifake'):
                await antifakeCommand(sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.eval'):
                await evalCommand(sock, chatId, message, isOwnerOrSudoCheck, rawText);
                commandExecuted = true;
                break;

            case userMessage.startsWith('.autodl'):
                await autodlCommand(sock, chatId, message, isGroup, isSenderAdmin, isOwnerOrSudoCheck, userMessage);
                commandExecuted = true;
                break;

            case userMessage.startsWith('.antispam'):
                await antispamCommand(sock, chatId, message, isGroup, isSenderAdmin, isOwnerOrSudoCheck, userMessage);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.broadcast') || userMessage.startsWith('.bc'):
                await broadcastCommand(sock, chatId, message, isOwnerOrSudoCheck, userMessage);
                commandExecuted = true;
                break;
                
            case userMessage.startsWith('.kick'):
                const mentionedJidListKick = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await kickCommand(sock, chatId, senderId, mentionedJidListKick, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.antisticker'):
                await antistickerCommand(sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage);
                commandExecuted = true;
                break;

            case userMessage.startsWith('.antiphoto'):
                await antiphotoCommand(sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage);
                commandExecuted = true;
                break;
             case userMessage === '.link' || userMessage === '.grouplink':
                await linkCommand(sock, chatId, message, isGroup, isBotAdmin);
                commandExecuted = true;
                break;

            case userMessage.startsWith('.autobio'):
                await autobioCommand(sock, chatId, message, isOwnerOrSudoCheck, userMessage);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.mute'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const muteArg = parts[1];
                    const muteDuration = muteArg !== undefined ? parseInt(muteArg, 10) : undefined;
                    if (muteArg !== undefined && (isNaN(muteDuration) || muteDuration <= 0)) {
                        await sock.sendMessage(chatId, { text: 'Please provide a valid number of minutes or use .mute with no number to mute immediately.', ...channelInfo }, { quoted: message });
                    } else {
                        await muteCommand(sock, chatId, senderId, message, muteDuration);
                    }
                }
                commandExecuted = true;
                break;
            case userMessage === '.unmute':
                await unmuteCommand(sock, chatId, senderId);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.ban'):
                await banCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.unban'):
                await unbanCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.help' || userMessage === '.menu' || userMessage === '.bot' || userMessage === '.list':
                await helpCommand(sock, chatId, message, global.channelLink);
                commandExecuted = true;
                break;
            case userMessage === '.setmenuimage' || userMessage === '.setmenu':
                await setMenuImageCommand(sock, chatId, message, isOwnerOrSudoCheck);
                commandExecuted = true;
                break;
            case userMessage === '.sticker' || userMessage === '.s':
                await stickerCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.warnings'):
                const mentionedJidListWarnings = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warningsCommand(sock, chatId, mentionedJidListWarnings);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.warn'):
                const mentionedJidListWarn = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warnCommand(sock, chatId, senderId, mentionedJidListWarn, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.tts'):
                const text = userMessage.slice(4).trim();
                await ttsCommand(sock, chatId, text, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.delete') || userMessage.startsWith('.del'):
                await deleteCommand(sock, chatId, message, senderId);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.attp'):
                await attpCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '.settings':
                await settingsCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.mode'):
                let data;
                try {
                    data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
                } catch (error) {
                    await sock.sendMessage(chatId, { text: 'Failed to read bot mode status', ...channelInfo });
                    break;
                }

                const action = userMessage.split(' ')[1]?.toLowerCase();
                if (!action || (action !== 'public' && action !== 'private')) {
                    const currentMode = data.isPublic ? 'public' : 'private';
                    await sock.sendMessage(chatId, {
                        text: `Current bot mode: *${currentMode}*\n\nUsage: .mode public/private\n\nExample:\n.mode public - Allow everyone to use bot\n.mode private - Restrict to owner only`,
                        ...channelInfo
                    }, { quoted: message });
                    break;
                }

                try {
                    data.isPublic = action === 'public';
                    fs.writeFileSync('./data/messageCount.json', JSON.stringify(data, null, 2));
                    await sock.sendMessage(chatId, { text: `Bot is now in *${action}* mode`, ...channelInfo });
                } catch (error) {
                    await sock.sendMessage(chatId, { text: 'Failed to update bot access mode', ...channelInfo });
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.anticall'):
                {
                    const args = userMessage.split(' ').slice(1).join(' ');
                    await anticallCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.pmblocker'):
                {
                    const args = userMessage.split(' ').slice(1).join(' ');
                    await pmblockerCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage === '.owner':
                await ownerCommand(sock, chatId);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.add'):
                await addCommand(sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, rawText);
                commandExecuted = true;
                break;
            case userMessage === '.tagall':
                await tagAllCommand(sock, chatId, senderId, message);
                commandExecuted = true;
                break;
            case userMessage === '.tagnotadmin':
                await tagNotAdminCommand(sock, chatId, senderId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.hidetag'):
                {
                    const messageText = rawText.slice(8).trim();
                    const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                    await hideTagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.tag'):
                {
                    const messageText = rawText.slice(4).trim();  // use rawText here, not userMessage
                    const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                    await tagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.antilink'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    break;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, { text: 'Please make the bot an admin first.', ...channelInfo }, { quoted: message });
                    break;
                }
                await handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.antitag'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    break;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, { text: 'Please make the bot an admin first.', ...channelInfo }, { quoted: message });
                    break;
                }
                await handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                commandExecuted = true;
                break;
            case userMessage === '.meme':
                await memeCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.joke':
                await jokeCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.quote':
                await quoteCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.fact':
                await factCommand(sock, chatId, message, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.weather'):
                const city = userMessage.slice(9).trim();
                if (city) {
                    await weatherCommand(sock, chatId, message, city);
                } else {
                    await sock.sendMessage(chatId, { text: 'Please specify a city, e.g., .weather London', ...channelInfo }, { quoted: message });
                }
                commandExecuted = true;
                break;
            case userMessage === '.news':
                await newsCommand(sock, chatId);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.ttt') || userMessage.startsWith('.tictactoe'):
                const tttText = userMessage.split(' ').slice(1).join(' ');
                await tictactoeCommand(sock, chatId, senderId, tttText);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.move'):
                const position = parseInt(userMessage.split(' ')[1]);
                if (isNaN(position)) {
                    await sock.sendMessage(chatId, { text: 'Please provide a valid position number for Tic-Tac-Toe move.', ...channelInfo }, { quoted: message });
                } else {
                    tictactoeMove(sock, chatId, senderId, position);
                }
                commandExecuted = true;
                break;
            case userMessage === '.topmembers':
                topMembers(sock, chatId, isGroup);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.hangman'):
                startHangman(sock, chatId);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.guess'):
                const guessedLetter = userMessage.split(' ')[1];
                if (guessedLetter) {
                    guessLetter(sock, chatId, guessedLetter);
                } else {
                    sock.sendMessage(chatId, { text: 'Please guess a letter using .guess <letter>', ...channelInfo }, { quoted: message });
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.trivia'):
                startTrivia(sock, chatId);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.answer'):
                const answer = userMessage.split(' ').slice(1).join(' ');
                if (answer) {
                    answerTrivia(sock, chatId, answer);
                } else {
                    sock.sendMessage(chatId, { text: 'Please provide an answer using .answer <answer>', ...channelInfo }, { quoted: message });
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.compliment'):
                await complimentCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.insult'):
                await insultCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.8ball'):
                const question = userMessage.split(' ').slice(1).join(' ');
                await eightBallCommand(sock, chatId, question);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.lyrics'):
                const songTitle = userMessage.split(' ').slice(1).join(' ');
                await lyricsCommand(sock, chatId, songTitle, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.simp'):
                const quotedMsgSimp = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const mentionedJidSimp = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await simpCommand(sock, chatId, quotedMsgSimp, mentionedJidSimp, senderId);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.stupid') || userMessage.startsWith('.itssostupid') || userMessage.startsWith('.iss'):
                const stupidQuotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const stupidMentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                const stupidArgs = userMessage.split(' ').slice(1);
                await stupidCommand(sock, chatId, stupidQuotedMsg, stupidMentionedJid, senderId, stupidArgs);
                commandExecuted = true;
                break;
            case userMessage === '.dare':
                await dareCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.truth':
                await truthCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.clear':
                if (isGroup) await clearCommand(sock, chatId);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.promote'):
                const mentionedJidListPromote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await promoteCommand(sock, chatId, mentionedJidListPromote, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.demote'):
                const mentionedJidListDemote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await demoteCommand(sock, chatId, mentionedJidListDemote, message);
                commandExecuted = true;
                break;
            case userMessage === '.ping':
                await pingCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.alive':
                await aliveCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.mention '):
                {
                    const args = userMessage.split(' ').slice(1).join(' ');
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await mentionToggleCommand(sock, chatId, message, args, isOwner);
                }
                commandExecuted = true;
                break;
            case userMessage === '.setmention':
                {
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await setMentionCommand(sock, chatId, message, isOwner);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.blur'):
                const quotedMessageBlur = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                await blurCommand(sock, chatId, message, quotedMessageBlur);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.welcome'):
                if (isGroup) {
                    if (!isSenderAdmin) {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo }, { quoted: message });
                    } else {
                        await welcomeCommand(sock, chatId, message);
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.goodbye'):
                if (isGroup) {
                    if (!isSenderAdmin) {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo }, { quoted: message });
                    } else {
                        await goodbyeCommand(sock, chatId, message);
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                }
                commandExecuted = true;
                break;
            case userMessage === '.git' || userMessage === '.github' || userMessage === '.sc' || userMessage === '.script' || userMessage === '.repo':
                await githubCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.antibadword'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    break;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, { text: '*Bot must be admin to use this feature*', ...channelInfo }, { quoted: message });
                    break;
                }
                await antibadwordCommand(sock, chatId, message, senderId, isSenderAdmin);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.chatbot'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    break;
                }
                
                // --- ANTI-SPAM LOGIC ---
                if (global.antispamState === 'on' && !isSenderAdmin && !message.key.fromMe) {
                    global.spamMap = global.spamMap || {};
                    global.spamMap[senderId] = (global.spamMap[senderId] || 0) + 1;

                    if (global.spamMap[senderId] > 5) {
                        if (isBotAdmin) await sock.sendMessage(chatId, { delete: message.key }).catch(()=>null); 
                        if (global.spamMap[senderId] === 6) {
                            await sock.sendMessage(chatId, { 
                                text: `⚠️ @${senderId.split('@')[0]}, please stop spamming! Further messages will be deleted.`, 
                                mentions: [senderId] 
                            }).catch(()=>null);
                        }
                        return; 
                    }
                    setTimeout(() => { if (global.spamMap[senderId]) global.spamMap[senderId]--; }, 5000); 
                }

                if (!isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, { text: '*Only admins or bot owner can use this command*', ...channelInfo }, { quoted: message });
                    break;
                }

                const match = userMessage.slice(8).trim();
                await handleChatbotCommand(sock, chatId, message, match);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.take') || userMessage.startsWith('.steal'):
                {
                    const isSteal = userMessage.startsWith('.steal');
                    const sliceLen = isSteal ? 6 : 5; 
                    const takeArgs = rawText.slice(sliceLen).trim().split(' ');
                    await takeCommand(sock, chatId, message, takeArgs);
                }
                commandExecuted = true;
                break;
            case userMessage === '.flirt':
                await flirtCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.character'):
                await characterCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.waste'):
                await wastedCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.ship':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    break;
                }
                await shipCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.groupinfo' || userMessage === '.infogp' || userMessage === '.infogrupo':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    break;
                }
                await groupInfoCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.resetlink' || userMessage === '.revoke' || userMessage === '.anularlink':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    break;
                }
                await resetlinkCommand(sock, chatId, senderId);
                commandExecuted = true;
                break;
            case userMessage === '.staff' || userMessage === '.admins' || userMessage === '.listadmin':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    break;
                }
                await staffCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.tourl') || userMessage.startsWith('.url'):
                await urlCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.emojimix') || userMessage.startsWith('.emix'):
                await emojimixCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.tg') || userMessage.startsWith('.stickertelegram') || userMessage.startsWith('.tgsticker') || userMessage.startsWith('.telesticker'):
                await stickerTelegramCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.vv':
                await viewOnceCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.clearsession' || userMessage === '.clearsesi':
                await clearSessionCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.autostatus'):
                const autoStatusArgs = userMessage.split(' ').slice(1);
                await autoStatusCommand(sock, chatId, message, autoStatusArgs);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.metallic'):
                await textmakerCommand(sock, chatId, message, userMessage, 'metallic');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.ice'):
                await textmakerCommand(sock, chatId, message, userMessage, 'ice');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.snow'):
                await textmakerCommand(sock, chatId, message, userMessage, 'snow');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.impressive'):
                await textmakerCommand(sock, chatId, message, userMessage, 'impressive');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.matrix'):
                await textmakerCommand(sock, chatId, message, userMessage, 'matrix');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.light'):
                await textmakerCommand(sock, chatId, message, userMessage, 'light');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.neon'):
                await textmakerCommand(sock, chatId, message, userMessage, 'neon');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.devil'):
                await textmakerCommand(sock, chatId, message, userMessage, 'devil');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.purple'):
                await textmakerCommand(sock, chatId, message, userMessage, 'purple');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.thunder'):
                await textmakerCommand(sock, chatId, message, userMessage, 'thunder');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.leaves'):
                await textmakerCommand(sock, chatId, message, userMessage, 'leaves');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.1917'):
                await textmakerCommand(sock, chatId, message, userMessage, '1917');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.arena'):
                await textmakerCommand(sock, chatId, message, userMessage, 'arena');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.hacker'):
                await textmakerCommand(sock, chatId, message, userMessage, 'hacker');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.sand'):
                await textmakerCommand(sock, chatId, message, userMessage, 'sand');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.blackpink'):
                await textmakerCommand(sock, chatId, message, userMessage, 'blackpink');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.glitch'):
                await textmakerCommand(sock, chatId, message, userMessage, 'glitch');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.fire'):
                await textmakerCommand(sock, chatId, message, userMessage, 'fire');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.antidelete'):
                const antideleteMatch = userMessage.slice(11).trim();
                await handleAntideleteCommand(sock, chatId, message, antideleteMatch);
                commandExecuted = true;
                break;
            case userMessage === '.surrender':
                await handleTicTacToeMove(sock, chatId, senderId, 'surrender');
                commandExecuted = true;
                break;
            case userMessage === '.cleartmp':
                await clearTmpCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.setpp':
                await setProfilePicture(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.setgdesc'):
                {
                    const text = rawText.slice(9).trim();
                    await setGroupDescription(sock, chatId, senderId, text, message);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.setgname'):
                {
                    const text = rawText.slice(9).trim();
                    await setGroupName(sock, chatId, senderId, text, message);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.setgpp'):
                await setGroupPhoto(sock, chatId, senderId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.instagram') || userMessage.startsWith('.insta') || userMessage.startsWith('.ig'):
                await instagramCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.igsc'):
                await igsCommand(sock, chatId, message, true);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.igs'):
                await igsCommand(sock, chatId, message, false);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.fb') || userMessage.startsWith('.facebook'):
                await facebookCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.music'):
                await playCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.spotify'):
                await spotifyCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.play') || userMessage.startsWith('.mp3') || userMessage.startsWith('.ytmp3') || userMessage.startsWith('.song'):
                await songCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.video') || userMessage.startsWith('.ytmp4'):
                await videoCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.tiktok') || userMessage.startsWith('.tt'):
                await tiktokCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.gpt') || userMessage.startsWith('.gemini'):
                await aiCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.translate') || userMessage.startsWith('.trt'):
                const commandLength = userMessage.startsWith('.translate') ? 10 : 4;
                await handleTranslateCommand(sock, chatId, message, userMessage.slice(commandLength));
                return;
            case userMessage.startsWith('.ss') || userMessage.startsWith('.ssweb') || userMessage.startsWith('.screenshot'):
                const ssCommandLength = userMessage.startsWith('.screenshot') ? 11 : (userMessage.startsWith('.ssweb') ? 6 : 3);
                await handleSsCommand(sock, chatId, message, userMessage.slice(ssCommandLength).trim());
                commandExecuted = true;
                break;
            case userMessage.startsWith('.areact') || userMessage.startsWith('.autoreact') || userMessage.startsWith('.autoreaction'):
                await handleAreactCommand(sock, chatId, message, isOwnerOrSudoCheck);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.sudo'):
                await sudoCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.goodnight' || userMessage === '.lovenight' || userMessage === '.gn':
                await goodnightCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.shayari' || userMessage === '.shayri':
                await shayariCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.roseday':
                await rosedayCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.imagine') || userMessage.startsWith('.flux') || userMessage.startsWith('.dalle'): 
                await imagineCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.jid':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: "❌ This command can only be used in a group." });
                } else {
                    await sock.sendMessage(chatId, { text: `✅ Group JID: ${chatId}` }, { quoted: message });
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.autotyping'):
                await autotypingCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.autoread'):
                await autoreadCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.heart'):
                await handleHeart(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.horny'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['horny', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.circle'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['circle', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.lgbt'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['lgbt', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.lolice'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['lolice', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.simpcard'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['simpcard', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.tonikawa'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['tonikawa', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.its-so-stupid'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['its-so-stupid', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.namecard'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['namecard', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.oogway2') || userMessage.startsWith('.oogway'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const sub = userMessage.startsWith('.oogway2') ? 'oogway2' : 'oogway';
                    const args = [sub, ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.tweet'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['tweet', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.ytcomment'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['youtube-comment', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.comrade') || userMessage.startsWith('.gay') || userMessage.startsWith('.glass') || userMessage.startsWith('.jail') || userMessage.startsWith('.passed') || userMessage.startsWith('.triggered'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const sub = userMessage.slice(1).split(/\s+/)[0];
                    const args = [sub, ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.animu'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = parts.slice(1);
                    await animeCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.nom') || userMessage.startsWith('.poke') || userMessage.startsWith('.cry') || userMessage.startsWith('.kiss') || userMessage.startsWith('.pat') || userMessage.startsWith('.hug') || userMessage.startsWith('.wink') || userMessage.startsWith('.facepalm') || userMessage.startsWith('.face-palm') || userMessage.startsWith('.animuquote') || userMessage.startsWith('.quote') || userMessage.startsWith('.loli'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    let sub = parts[0].slice(1);
                    if (sub === 'facepalm') sub = 'face-palm';
                    if (sub === 'quote' || sub === 'animuquote') sub = 'quote';
                    await animeCommand(sock, chatId, message, [sub]);
                }
                commandExecuted = true;
                break;
            case userMessage === '.crop':
                await stickercropCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.pies'):
                {
                    const parts = rawText.trim().split(/\s+/);
                    const args = parts.slice(1);
                    await piesCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage === '.china':
                await piesAlias(sock, chatId, message, 'china');
                commandExecuted = true;
                break;
            case userMessage === '.indonesia':
                await piesAlias(sock, chatId, message, 'indonesia');
                commandExecuted = true;
                break;
            case userMessage === '.japan':
                await piesAlias(sock, chatId, message, 'japan');
                commandExecuted = true;
                break;
            case userMessage === '.korea':
                await piesAlias(sock, chatId, message, 'korea');
                commandExecuted = true;
                break;
            case userMessage === '.india':
                await piesAlias(sock, chatId, message, 'india');
                commandExecuted = true;
                break;
            case userMessage === '.malaysia':
                await piesAlias(sock, chatId, message, 'malaysia');
                commandExecuted = true;
                break;
            case userMessage === '.thailand':
                await piesAlias(sock, chatId, message, 'thailand');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.update'):
                {
                    const parts = rawText.trim().split(/\s+/);
                    const zipArg = parts[1] && parts[1].startsWith('http') ? parts[1] : '';
                    await updateCommand(sock, chatId, message, zipArg);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.removebg') || userMessage.startsWith('.rmbg') || userMessage.startsWith('.nobg'):
                await removebgCommand.exec(sock, message, userMessage.split(' ').slice(1));
                commandExecuted = true;
                break;
            case userMessage.startsWith('.remini') || userMessage.startsWith('.enhance') || userMessage.startsWith('.upscale'):
                await reminiCommand(sock, chatId, message, userMessage.split(' ').slice(1));
                commandExecuted = true;
                break;
            case userMessage.startsWith('.sora'):
                await soraCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            default:
                if (isGroup) {
                    if (userMessage) {  
                        await handleChatbotResponse(sock, chatId, message, userMessage, senderId).catch(()=>null);
                    }
                    await handleTagDetection(sock, chatId, message, senderId).catch(()=>null);
                    await handleMentionDetection(sock, chatId, message).catch(()=>null);
                }
                commandExecuted = false;
                break;
        }

        if (commandExecuted) {
            await showTypingAfterCommand(sock, chatId).catch(()=>null);
        }

        if (userMessage.startsWith('.')) {
            if (typeof addCommandReaction === 'function') {
                await addCommandReaction(sock, message).catch(()=>null);
            }
        }

    } catch (error) {
        console.error('❌ Critical Error in handleMessages:', error.message);
    }
} 
// ==========================================
// END OF handleMessages
// ==========================================

// ==========================================
// 6. GROUP PARTICIPANT HANDLER
// ==========================================
async function handleGroupParticipantUpdate(sock, update) {
    try {
        const { id, participants, action, author } = update;

        if (!id.endsWith('@g.us')) return;

        let isPublic = true;
        try {
            const modeData = JSON.parse(fs.readFileSync('./data/messageCount.json'));
            if (typeof modeData.isPublic === 'boolean') isPublic = modeData.isPublic;
        } catch (e) { }

        if (action === 'promote') {
            if (!isPublic) return;
            if (typeof handlePromotionEvent === 'function') await handlePromotionEvent(sock, id, participants, author).catch(()=>null);
            return;
        }

        if (action === 'demote') {
            if (!isPublic) return;
            if (typeof handleDemotionEvent === 'function') await handleDemotionEvent(sock, id, participants, author).catch(()=>null);
            return;
        }

        if (action === 'add') {
            // --- ANTI-FAKE LOGIC (Group-Specific) ---
            const antifakeState = global.antifakeState || {};
            if (antifakeState[id] === 'on') {
                const bannedPrefixes = ['212', '91', '92', '48']; 
                
                for (let user of participants) {
                    const isFake = bannedPrefixes.some(prefix => user.startsWith(prefix));
                    
                    if (isFake) {
                        try {
                            await sock.sendMessage(id, { 
                                text: `🌍 *Anti-Fake Alert*\n\nAuto-removing number from restricted region: @${user.split('@')[0]}`, 
                                mentions: [user] 
                            });
                            await sock.groupParticipantsUpdate(id, [user], "remove");
                            return; // Stop processing this user so they don't get a welcome message
                        } catch (err) {
                            console.error("Failed to kick fake number:", err);
                        }
                    }
                }
            }

            // Normal welcome event
            if (typeof handleJoinEvent === 'function') await handleJoinEvent(sock, id, participants).catch(()=>null);
        }

        if (action === 'remove') {
            if (typeof handleLeaveEvent === 'function') await handleLeaveEvent(sock, id, participants).catch(()=>null);
        }
    } catch (error) {
        console.error('Error in handleGroupParticipantUpdate:', error);
    }
}

// ==========================================
// 7. EXPORTS
// ==========================================
module.exports = {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus: async (sock, status) => {
        if (typeof handleStatusUpdate === 'function') {
            await handleStatusUpdate(sock, status).catch(()=>null);
        }
    }
};