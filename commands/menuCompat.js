'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');
const aiCommand = require('./ai');
const animeCommand = require('./anime').animeCommand;
const downloadCommand = require('./download');
const { speedCommand, uptimeCommand, idCommand, botInfoCommand, healthCommand } = require('./utility');
const quoteCommand = require('./quote');
const factCommand = require('./fact');
const eightBallCommand = require('./eightball').eightBallCommand;
const stickerTelegramCommand = require('./stickertelegram');
const toStatusCommand = require('./tostatus');
const groupInfoCommand = require('./groupinfo');
const { autoStatusCommand } = require('./autostatus');
const { setGroupDescription, setGroupName, setGroupPhoto } = require('./groupmanage');
const { lyricsCommand } = require('./lyrics');
const yts = require('yt-search');
const { allCommands } = require('../lib/menuCatalog');

const DATA_DIR = path.join(process.cwd(), 'data');
const NOTES_FILE = path.join(DATA_DIR, 'menuNotes.json');
const MAIL_API = 'https://api.mail.tm';

function readNotes() {
    try { return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8')); } catch (_) { return {}; }
}

function saveNotes(notes) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
}

async function publicSearch(query) {
    const response = await axios.get('https://html.duckduckgo.com/html/', {
        params: { q: query }, timeout: 15000, headers: { 'User-Agent': 'LEE-TECH-BOT/1.0' }
    });
    const $ = cheerio.load(response.data);
    return $('.result').slice(0, 5).map((_, item) => ({
        title: $(item).find('.result__title').text().trim(),
        url: $(item).find('.result__a').attr('href'),
        snippet: $(item).find('.result__snippet').text().trim()
    })).get().filter((item) => item.title && item.url);
}

async function mailTmRequest(method, url, data, token) {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return axios({ method, url: `${MAIL_API}${url}`, data, headers, timeout: 15000 });
}

function cryptoRandom() {
    return crypto.randomBytes(6).toString('hex');
}

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
    if (command === 'setdesc') {
        await setGroupDescription(sock, chatId, context.senderId || message.key?.participant || message.key?.remoteJid, args.join(' '), message);
        return true;
    }
    if (command === 'setgrouppicture') {
        await setGroupPhoto(sock, chatId, context.senderId || message.key?.participant || message.key?.remoteJid, message);
        return true;
    }
    if (command === 'editinfo') {
        await setGroupName(sock, chatId, context.senderId || message.key?.participant || message.key?.remoteJid, args.join(' '), message);
        return true;
    }
    if (command === 'lyrics') {
        await lyricsCommand(sock, chatId, args.join(' '), message);
        return true;
    }
    if (command === 'yts') {
        const query = args.join(' ').trim();
        if (!query) { await reply(sock, chatId, message, 'Usage: `.yts <song or video>`'); return true; }
        try {
            const results = await yts(query);
            const top = (results.videos || []).slice(0, 5);
            await reply(sock, chatId, message, top.length ? top.map((v, i) => `${i + 1}. ${v.title}\n${v.url}\n${v.timestamp || ''}`).join('\n\n') : '❌ No YouTube results found.');
        } catch (_) { await reply(sock, chatId, message, '❌ YouTube search failed.'); }
        return true;
    }
    if (command === 'define') {
        const word = args.join(' ').trim();
        if (!word) { await reply(sock, chatId, message, 'Usage: `.define <word>`'); return true; }
        try {
            const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout: 12000 });
            const entry = data[0];
            const meaning = entry.meanings?.[0];
            const definition = meaning?.definitions?.[0];
            await reply(sock, chatId, message, `📖 *${entry.word}*\n${meaning?.partOfSpeech || ''}\n${definition?.definition || 'No definition found.'}${definition?.example ? `\n\nExample: ${definition.example}` : ''}`);
        } catch (_) { await reply(sock, chatId, message, '❌ Word definition not found.'); }
        return true;
    }
    if (command === 'country') {
        const country = args.join(' ').trim();
        if (!country) { await reply(sock, chatId, message, 'Usage: `.country <country>`'); return true; }
        try {
            const { data } = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(country)}`, { timeout: 12000 });
            const c = data[0];
            await reply(sock, chatId, message, `🌍 *${c.name?.common}*\nCapital: ${c.capital?.[0] || 'Unknown'}\nRegion: ${c.region || 'Unknown'}\nPopulation: ${(c.population || 0).toLocaleString()}\nCurrency: ${Object.values(c.currencies || {})[0]?.name || 'Unknown'}`);
        } catch (_) { await reply(sock, chatId, message, '❌ Country not found.'); }
        return true;
    }
    if (command === 'google' || command === 'search') {
        const query = args.join(' ').trim();
        if (!query) { await reply(sock, chatId, message, `Usage: .${command} <search terms>`); return true; }
        try {
            const results = await publicSearch(query);
            await reply(sock, chatId, message, results.length ? results.map((r, i) => `${i + 1}. *${r.title}*\n${r.url}\n${r.snippet}`).join('\n\n') : '❌ No public search results found.');
        } catch (_) { await reply(sock, chatId, message, '❌ Public search is temporarily unavailable.'); }
        return true;
    }
    if (command === 'note' || command === 'listnote' || command === 'deletenote') {
        const notes = readNotes();
        const ownerKey = context.senderId || message.key?.participant || message.key?.remoteJid || chatId;
        notes[ownerKey] ||= [];
        if (command === 'note') {
            const value = args.join(' ').trim();
            if (!value) { await reply(sock, chatId, message, 'Usage: `.note <text>`'); return true; }
            notes[ownerKey].push({ text: value, createdAt: new Date().toISOString() });
            saveNotes(notes);
            await reply(sock, chatId, message, `✅ Note saved (#${notes[ownerKey].length}).`);
        } else if (command === 'listnote') {
            await reply(sock, chatId, message, notes[ownerKey].length ? notes[ownerKey].map((n, i) => `${i + 1}. ${n.text}`).join('\n') : '📝 No saved notes.');
        } else {
            const index = Number(args[0]) - 1;
            if (!Number.isInteger(index) || !notes[ownerKey][index]) { await reply(sock, chatId, message, 'Usage: `.deletenote <note number>`'); return true; }
            notes[ownerKey].splice(index, 1); saveNotes(notes); await reply(sock, chatId, message, '✅ Note deleted.');
        }
        return true;
    }
    if (command === 'rate') {
        const value = args.join(' ').trim() || 'this';
        await reply(sock, chatId, message, `⭐ I rate *${value}* ${Math.floor(Math.random() * 101)}/100.`);
        return true;
    }
    if (command === 'tempmail' || command === 'tempinbox') {
        const sessions = global.tempMailSessions ||= {};
        const ownerKey = context.senderId || message.key?.participant || message.key?.remoteJid || chatId;
        try {
            if (command === 'tempmail' || !sessions[ownerKey]) {
                const domains = (await mailTmRequest('get', '/domains?page=1')).data['hydra:member'] || [];
                const domain = domains[0]?.domain;
                if (!domain) throw new Error('No mail domain');
                const address = `${cryptoRandom()}@${domain}`;
                const password = `${cryptoRandom()}Lee!9`;
                await mailTmRequest('post', '/accounts', { address, password });
                const token = (await mailTmRequest('post', '/token', { address, password })).data.token;
                sessions[ownerKey] = { address, token };
                await reply(sock, chatId, message, `📧 Temporary email created:\n*${address}*\n\nUse .tempinbox to check messages.`);
                if (command === 'tempmail') return true;
            }
            const inbox = await mailTmRequest('get', '/messages', undefined, sessions[ownerKey].token);
            const messages = inbox.data['hydra:member'] || [];
            await reply(sock, chatId, message, messages.length ? messages.slice(0, 5).map((m, i) => `${i + 1}. *${m.subject || '(no subject)'}*\nFrom: ${m.from?.address || 'unknown'}\nID: ${m.id}`).join('\n\n') : `📭 Inbox empty for ${sessions[ownerKey].address}.`);
        } catch (_) { await reply(sock, chatId, message, '❌ Temporary mail service unavailable.'); }
        return true;
    }
    if (command === 'bible') {
        const reference = args.join(' ').trim() || 'John 3:16';
        try {
            const { data } = await axios.get(`https://bible-api.com/${encodeURIComponent(reference)}`, { timeout: 12000 });
            await reply(sock, chatId, message, `📖 *${data.reference || reference}*\n\n${data.text || 'No verse found.'}`);
        } catch (_) { await reply(sock, chatId, message, '❌ Bible reference not found. Try `.bible John 3:16`.'); }
        return true;
    }
    if (command === 'quran') {
        const reference = args[0] || '1:1';
        try {
            const { data } = await axios.get(`https://api.alquran.cloud/v1/ayah/${encodeURIComponent(reference)}/en.asad`, { timeout: 12000 });
            const ayah = data.data;
            await reply(sock, chatId, message, `☪️ *${ayah?.surah?.englishName || 'Quran'} ${ayah?.numberInSurah || reference}*\n\n${ayah?.text || 'No ayah found.'}`);
        } catch (_) { await reply(sock, chatId, message, '❌ Quran reference not found. Try `.quran 1:1`.'); }
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
    if (['shazam', 'vocalremover', 'colorize', 'deepfake'].includes(command)) {
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
