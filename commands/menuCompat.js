'use strict';

const os = require('os');
const axios = require('axios');
const aiCommand = require('./ai');
const animeCommand = require('./anime').animeCommand;
const downloadCommand = require('./download');
const { speedCommand, uptimeCommand, idCommand, botInfoCommand, healthCommand } = require('./utility');
const quoteCommand = require('./quote');
const factCommand = require('./fact');
const eightBallCommand = require('./eightball').eightBallCommand;
const stickerTelegramCommand = require('./stickertelegram');
const toStatusCommand = require('./tostatus');
const { groupInfoCommand } = require('./groupinfo');
const { autoStatusCommand } = require('./autostatus');
const { allCommands } = require('../lib/menuCatalog');

const ANIME_ALIASES = {
    animeavatar: 'nom', animeblush: 'blush', animewave: 'wave', animesmile: 'smile',
    animepoke: 'poke', animewink: 'wink', animebonk: 'bonk', animebully: 'bully',
    neko: 'neko', waifu: 'waifu', loli: 'loli'
};

const DOWNLOAD_ALIASES = new Set([
    'ytmp3', 'ytmp4', 'mediafire', 'wallpaper', 'hdwallpaper', 'pinterest', 'img', 'aio',
    'fdroid', 'imgsearch', 'twitter', 'apk', 'spotifysearch', 'splay', 'knackvideo'
]);

const GROUP_COMMANDS = new Set([
    'addall', 'promoteall', 'demoteall', 'left', 'totag', 'gc', 'unwarn', 'all', 'antistatus',
    'approve', 'reject', 'group', 'gcalert', 'addmetaai', 'removemetaai', 'opentime', 'closetime',
    'setdesc', 'setgrouppicture', 'editinfo', 'invite', 'revoke', 'savecontact', 'sendcontact',
    'contacttag', 'tagadmin', 'getgrouppp', 'group-id', 'poll'
]);

const OWNER_COMMANDS = new Set([
    'addowner', 'delowner', 'listowner', 'block', 'unblock', 'blocklist', 'joingc', 'join', 'restart',
    'mode', 'edit', 'clearall', 'autorecording', 'autorecordtype', 'autoviewstatus', 'autoreact',
    'autolikestatus', 'getsession', 'setfullpp', 'reveal', 'listgroup', 'listonline', 'setpaypoint',
    'reportcommand', 'donate', 'panel', 'eval'
]);

function textOf(message) {
    return message?.message?.conversation || message?.message?.extendedTextMessage?.text || message?.message?.imageMessage?.caption || message?.message?.videoMessage?.caption || '';
}

function quoted(message) {
    return message?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}

async function reply(sock, chatId, message, text) {
    return sock.sendMessage(chatId, { text }, { quoted: message });
}

async function profilePicture(sock, chatId, message, targetJid) {
    try {
        const url = await sock.profilePictureUrl(targetJid, 'image');
        return sock.sendMessage(chatId, { image: { url }, caption: `Profile picture for ${targetJid}` }, { quoted: message });
    } catch (_) {
        return reply(sock, chatId, message, '❌ No profile picture is available for that account.');
    }
}

async function handleSimpleLocal(sock, chatId, message, command, args) {
    if (command === 'test') return reply(sock, chatId, message, '✅ LEE TECH BOT command router is working.');
    if (command === 'runtime') return uptimeCommand(sock, chatId, message);
    if (command === 'jid' || command === 'group-id' || command === 'channel-id') return idCommand(sock, chatId, message);
    if (command === 'botinfo' || command === 'script') return botInfoCommand(sock, chatId, message);
    if (command === 'health') return healthCommand(sock, chatId, message);
    if (command === 'quotes' || command === 'quote') return quoteCommand(sock, chatId, message);
    if (command === 'fact') return factCommand(sock, chatId, message);
    if (command === '8ballpool') return eightBallCommand(sock, chatId, args.join(' ').trim());
    if (command === 'readmore') {
        const value = args.join(' ').trim();
        if (!value) return reply(sock, chatId, message, 'Usage: `.readmore visible text | hidden text`');
        const [visible, hidden = ''] = value.split('|');
        return reply(sock, chatId, message, `${visible.trim()}\n${'‎'.repeat(400)}${hidden.trim()}`);
    }
    if (command === 'copy') {
        const value = args.join(' ').trim() || textOf(quoted(message) || message);
        return value ? reply(sock, chatId, message, value) : reply(sock, chatId, message, 'Reply to a message or provide text to copy.');
    }
    if (command === 'getpp') return profilePicture(sock, chatId, message, message.key?.participant || message.key?.remoteJid);
    if (command === 'getgrouppp') {
        if (!chatId.endsWith('@g.us')) return reply(sock, chatId, message, '❌ Use this command in a group.');
        return profilePicture(sock, chatId, message, chatId);
    }
    if (command === 'poll') {
        const value = args.join(' ').trim();
        const [question, ...options] = value.split('|').map((item) => item.trim()).filter(Boolean);
        if (!question || options.length < 2) return reply(sock, chatId, message, 'Usage: `.poll question | option 1 | option 2`');
        return sock.sendMessage(chatId, { poll: { name: question, values: options.slice(0, 12), selectableCount: 1 } }, { quoted: message });
    }
    if (command === 'system') return reply(sock, chatId, message, `OS: ${os.platform()}\nNode: ${process.version}\nMemory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`);
    return null;
}

async function menuCompatCommand(sock, chatId, message, input, context = {}) {
    const parts = String(input || '').trim().split(/\s+/).filter(Boolean);
    const command = (parts.shift() || '').replace(/^\./, '').toLowerCase();
    const args = parts;
    if (!command) return false;

    if (OWNER_COMMANDS.has(command) && !context.isOwnerOrSudoCheck) {
        await reply(sock, chatId, message, '❌ This command is restricted to the bot owner or sudo.');
        return true;
    }
    if (GROUP_COMMANDS.has(command) && !context.isGroup) {
        await reply(sock, chatId, message, '❌ This command can only be used in a group.');
        return true;
    }
    if (GROUP_COMMANDS.has(command) && !context.isSenderAdmin && !context.isOwnerOrSudoCheck) {
        await reply(sock, chatId, message, '❌ Only group admins can use this command.');
        return true;
    }

    const local = await handleSimpleLocal(sock, chatId, message, command, args);
    if (local) return true;

    if (command === 'autoviewstatus') {
        await autoStatusCommand(sock, chatId, message, args);
        return true;
    }
    if (command === 'autoreact' || command === 'autolikestatus') {
        await autoStatusCommand(sock, chatId, message, ['react', args[0] || 'status']);
        return true;
    }
    if (ANIME_ALIASES[command]) {
        await animeCommand(sock, chatId, message, [ANIME_ALIASES[command], ...args]);
        return true;
    }
    if (['ai', 'aivoice', 'chatgpt', 'analyze', 'search', 'gemini', 'elevenlab'].includes(command)) {
        await aiCommand(sock, chatId, message, args);
        return true;
    }
    if (DOWNLOAD_ALIASES.has(command)) {
        await downloadCommand(sock, chatId, { ...message, message: { conversation: `.${command} ${args.join(' ')}` } });
        return true;
    }
    if (command === 'telegramsticker') {
        await stickerTelegramCommand(sock, chatId, message);
        return true;
    }
    if (command === 'toviewonce' || command === 'statusd') {
        await toStatusCommand(sock, chatId, message, context.isOwnerOrSudoCheck);
        return true;
    }
    if (command === 'group') {
        await groupInfoCommand(sock, chatId, message);
        return true;
    }
    if (command === 'npm') {
        const packageName = args[0];
        if (!packageName) { await reply(sock, chatId, message, 'Usage: `.npm <package-name>`'); return true; }
        try {
            const { data } = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, { timeout: 10000 });
            await reply(sock, chatId, message, `📦 ${data.name}@${data['dist-tags']?.latest || 'unknown'}\n${data.description || 'No description'}\n${data.homepage || `https://www.npmjs.com/package/${data.name}`}`);
        } catch (_) { await reply(sock, chatId, message, '❌ NPM package not found or registry unavailable.'); }
        return true;
    }
    if (['bible', 'quran', 'define', 'country', 'google', 'lyrics', 'yts', 'shazam', 'tempmail', 'tempinbox', 'vocalremover', 'colorize', 'deepfake'].includes(command)) {
        await reply(sock, chatId, message, `⚠️ .${command} is recognized, but requires a configured provider/API in this deployment. Add the provider credentials, then retry.`);
        return true;
    }
    if (command === 'nsfw') {
        await reply(sock, chatId, message, '❌ NSFW features are disabled by default for group safety.');
        return true;
    }
    if (allCommands().includes(command)) {
        await reply(sock, chatId, message, `⚠️ *.${command}* is recognized by the menu and routed safely, but this feature needs a provider or handler configuration that is not present in the current deployment.`);
        return true;
    }
    return false;
}

module.exports = { menuCompatCommand, ANIME_ALIASES, DOWNLOAD_ALIASES };
