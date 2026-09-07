'use strict';

const fs = require('fs');
const path = require('path');
const settings = require('../settings');

const menuImagePath = path.join(process.cwd(), 'menu.jpg');
const menuSettingsPath = path.join(process.cwd(), 'data', 'menuSettings.json');

const FONT_MAPS = {
    clean: null,
    bold: { upper: 0x1d400, lower: 0x1d41a },
    double: { upper: 0x1d538, lower: 0x1d552 },
    mono: { upper: 0x1d670, lower: 0x1d68a }
};

const STYLE_MAP = {
    premium: { open: '╭─〔', close: '〕', bullet: '│', footer: '╰────────────────────' },
    neon: { open: '┏━【', close: '】', bullet: '┃', footer: '┗━━━━━━━━━━━━━━━━━━━━' },
    cyberpunk: { open: '⟦⟦', close: '⟧⟧', bullet: '▰', footer: '╞════════════════════╡' },
    minimal: { open: '┌─', close: '─┐', bullet: '│', footer: '└────────────────┘' },
    terminal: { open: '[', close: ']', bullet: '>', footer: '====================' },
    royal: { open: '╔══〔', close: '〕', bullet: '║', footer: '╚════════════════════' }
};

function menuConfig() {
    try {
        const value = JSON.parse(fs.readFileSync(menuSettingsPath, 'utf8'));
        return { enabled: value.enabled === true, style: value.style || 'premium', font: value.font || 'clean' };
    } catch (_) {
        return { enabled: false, style: 'premium', font: 'clean' };
    }
}

function stylizeHeading(value, font) {
    const map = FONT_MAPS[font];
    if (!map) return value;
    return String(value).replace(/[A-Za-z]/g, (char) => {
        const code = char.charCodeAt(0);
        const lower = code >= 97;
        const base = lower ? map.lower : map.upper;
        return String.fromCodePoint(base + (code - (lower ? 97 : 65)));
    });
}

function menuImageEnabled() {
    try {
        const state = JSON.parse(fs.readFileSync(menuSettingsPath, 'utf8'));
        return state.enabled === true && fs.existsSync(menuImagePath);
    } catch (_) {
        return false;
    }
}

function menuImage() {
    if (!menuImageEnabled()) return null;
    try { return fs.readFileSync(menuImagePath); } catch (_) { return null; }
}

function prefix() {
    return global.prefix === 'none' ? '.' : (global.prefix || '.');
}

function section(title, lines) {
    const config = menuConfig();
    const style = STYLE_MAP[config.style] || STYLE_MAP.premium;
    return [
        `${style.open} *${stylizeHeading(title, config.font)}* ${style.close}`,
        ...lines.map((line) => `${style.bullet} ${line}`),
        style.footer
    ].join('\n');
}

function buildMenu() {
    const p = prefix();
    const name = settings.botName || 'LEE TECH BOT';
    const version = settings.version || '3.0.7';
    const channel = global.ytch || '@ServerNetwork-yt';
    const privacy = global.ownerControls?.hideChannel ? 'PRIVATE MODE' : 'PUBLIC MODE';

    return [
        `╭━━━〔 *${name}* 〕━━━╮`,
        `┃  ✦ *PREMIUM COMMAND CENTER*`,
        `┃  ⚡ v${version}  •  ${privacy}`,
        `┃  Prefix: *${p}*  •  EAT / Africa-Nairobi`,
        `╰━━━━━━━━━━━━━━━━━━━━╯`,
        '',
        section('⚡ START HERE', [
            `*${p}ping*  •  *${p}speed*  •  *${p}uptime*`,
            `*${p}health*  •  *${p}runtime*  •  *${p}botinfo*`,
            `*${p}id*  •  *${p}jid*  •  *${p}time*  •  *${p}owner*`,
            `*${p}menu*  •  *${p}commands*  •  *${p}help <command>*`
        ]),
        '',
        section('✦ AI & SMART TOOLS', [
            `*${p}gpt <question>*  •  *${p}gemini <question>*`,
            `*${p}chatbot on/off*  •  *${p}imagine <prompt>*`,
            `*${p}translate <text> <language>*  •  *${p}tts <text>*`,
            `*${p}weather <city>*  •  *${p}news*  •  *${p}lyrics <song>*`
        ]),
        '',
        section('▣ MEDIA WORKSHOP', [
            `*${p}sticker*  •  *${p}take <pack|author>*  •  *${p}emojimix*`,
            `*${p}removebg*  •  *${p}remini*  •  *${p}blur*`,
            `*${p}meme*  •  *${p}attp <text>*  •  *${p}textmaker*`,
            `Reply to media: *${p}url*  •  *${p}tourl*  •  *${p}vv*  •  *${p}delete*`
        ]),
        '',
        section('⇩ DOWNLOAD CENTER', [
            `*${p}download <public link>*  — YouTube, TikTok, Instagram, Facebook`,
            `*${p}ytmp4 <url|search>*  •  *${p}video <url|search>*`,
            `*${p}tiktok <url>*  •  *${p}instagram <url>*  •  *${p}facebook <url>*`,
            `*${p}play <song>*  •  *${p}song <song>*  •  *${p}spotify <query>*`,
            `Use public links; private or expired media cannot be fetched.`
        ]),
        '',
        section('◈ GROUP SHIELD', [
            `*${p}groupinfo*  •  *${p}groupstats*  •  *${p}adminstatus*`,
            `*${p}tagall*  •  *${p}hidetag*  •  *${p}tagnotadmin*`,
            `*${p}antilink*  •  *${p}antispam*  •  *${p}antibadword*`,
            `*${p}antiphoto*  •  *${p}antiviewonce*  •  *${p}antisticker*`,
            `*${p}antibot*  •  *${p}antifake*  •  *${p}antitag*  •  *${p}antiall*`,
            `*${p}open [minutes]*  •  *${p}close [minutes]*  •  *${p}announce*`,
            `*${p}welcome on/off*  •  *${p}goodbye on/off*  •  *${p}promotion on/off*`,
            `Moderation requires the bot to be a group admin.`
        ]),
        '',
        section('◉ STATUS & FUN', [
            `Reply to media/text: *${p}tostatus*  •  *${p}togstatus*`,
            `Reply to a WhatsApp Status: *${p}savestatus*  •  *${p}statusdl*`,
            `*${p}tictactoe*  •  *${p}trivia*  •  *${p}hangman*  •  *${p}8ball*`,
            `*${p}truth*  •  *${p}dare*  •  *${p}joke*  •  *${p}quote*  •  *${p}fact*`,
            `*${p}compliment*  •  *${p}flirt*  •  *${p}ship*  •  *${p}shayari*`
        ]),
        '',
        section('⚙ OWNER CONTROL', [
            `*${p}settings*  •  *${p}ownerstatus*  •  *${p}setprefix <one symbol>*`,
            `In DM: *${p}promotions on/off* sets the default for groups`,
            `*${p}mode public/private*  •  *${p}hidechannel on/off*`,
            `*${p}maintenance on/off*  •  *${p}autotyping*  •  *${p}autoread*`,
            `*${p}anticall*  •  *${p}backup*  •  *${p}cleartmp*  •  *${p}update*`,
            `Reply to an image: *${p}setmenuimage*  •  *${p}menumode image/text*`,
            `*${p}menustyle cyberpunk*  •  *${p}menufont double*`,
            `*${p}devmenu*  — protected developer toolkit`
        ]),
        '',
        `╭─〔 *SUPPORT* 〕`,
        `│ ${channel}`,
        '│ Fast • Secure • Organized • Premium',
        '╰────────────────────'
    ].join('\n');
}

function buildDeveloperMenu() {
    const p = prefix();
    const version = settings.version || '3.0.7';
    return [
        `╭━━━〔 *DEVELOPER TOOLKIT* 〕━━━╮`,
        `┃ LEE TECH BOT v${version}`,
        `╰━━━━━━━━━━━━━━━━━━━━━━╯`,
        '',
        section('MONITORING', [
            `*${p}health*  •  *${p}system*  •  *${p}stats*`,
            `*${p}ping*  •  *${p}speed*  •  *${p}uptime*  •  *${p}runtime*`,
            `*${p}botinfo*  •  *${p}jid*  •  *${p}ownerstatus*`
        ]),
        '',
        section('OPERATIONS', [
            `*${p}settings*  •  *${p}backup*  •  *${p}cleartmp*`,
            `*${p}clearsession*  •  *${p}update*`,
            `*${p}maintenance on/off*  •  *${p}mode public/private*`,
            `*${p}alwaysonline*  •  *${p}pmblocker*  •  *${p}autobio*`
        ]),
        '',
        section('CONFIGURATION', [
            `*${p}setprefix <symbol|none>*`,
            `*${p}hidechannel on/off*`,
            `*${p}setmenuimage*  — replace and enable the menu image`,
            `*${p}menumode image|text|status*  — switch display mode`,
            `*${p}menustyle premium|neon|cyberpunk|minimal|terminal|royal*`,
            `*${p}menufont clean|bold|double|mono*`
        ]),
        '',
        `Owner authorization is required for sensitive operations.`,
        `Use *${p}help <command>* for a focused guide.`
    ].join('\n');
}

function messageText(message) {
    return message?.message?.conversation || message?.message?.extendedTextMessage?.text || '';
}

function developerButtons() {
    return [
        { buttonId: 'tools_health', buttonText: { displayText: 'Health' }, type: 1 },
        { buttonId: 'tools_settings', buttonText: { displayText: 'Settings' }, type: 1 },
        { buttonId: 'tools_update', buttonText: { displayText: 'Update' }, type: 1 }
    ];
}

function buildDetails(topic) {
    const p = prefix();
    const topics = {
        admin: `*ADMIN GUIDE*\n\n${p}adminstatus\n${p}groupstats\n${p}tagall\n${p}hidetag\n${p}kick @user\n${p}promote @user\n${p}demote @user\n${p}promotion on/off/status\n${p}mute @user\n${p}antiall on/off/status\n${p}open [minutes]\n${p}close [minutes]\n\nThe sender and bot must have the required group permissions.`,
        owner: `*OWNER GUIDE*\n\n${p}owner\n${p}mode public/private\n${p}setprefix <symbol|none>\n${p}hidechannel on/off\n${p}maintenance on/off\n${p}backup\n${p}update\n${p}tostatus (reply to media/text)\n${p}togstatus (inside a group)\n${p}savestatus (reply to a Status)\n\nOwner tools are protected by owner or sudo authorization.`,
        download: `*DOWNLOAD GUIDE*\n\n${p}download <public social link>\n${p}tiktok <url>\n${p}instagram <url>\n${p}facebook <url>\n${p}play <song>\n${p}song <song>\n${p}spotify <query>\n${p}ytmp4 <url|search>\n${p}url (reply to image/video)\n\nPrivate, expired, or region-blocked links may fail.`,
        ai: `*AI GUIDE*\n\n${p}gpt <question>\n${p}gemini <question>\n${p}chatbot on/off\n${p}imagine <prompt>\n${p}translate <text> <language>\n${p}tts <text>`,
        dev: buildDeveloperMenu(),
        developer: buildDeveloperMenu(),
        tools: buildDeveloperMenu()
    };
    return topics[topic] || `Use ${p}menu for the full command center. Guides: admin, owner, download, ai.`;
}

async function helpCommand(sock, chatId, message) {
    const words = messageText(message).trim().split(/\s+/);
    const first = words[0]?.toLowerCase();
    const requestedTopic = words[1]?.toLowerCase()
        || (['.devmenu', '.developermenu', '.devtools', '.tools'].includes(first) ? 'dev' : first === '.groupmenu' ? 'admin' : undefined);
    const helpMessage = requestedTopic ? buildDetails(requestedTopic) : buildMenu();
    const image = requestedTopic ? null : menuImage();

    try {
        if (['dev', 'developer', 'tools'].includes(requestedTopic)) {
            try {
                return await sock.sendMessage(chatId, {
                    text: helpMessage,
                    footer: 'LEE TECH Developer Toolkit',
                    buttons: developerButtons(),
                    headerType: 1
                }, { quoted: message });
            } catch (buttonError) {
                console.warn('[menu] Buttons unavailable; using text-only fallback:', buttonError.message || buttonError);
            }
        }
        if (image) return await sock.sendMessage(chatId, { image, caption: helpMessage }, { quoted: message });
        return await sock.sendMessage(chatId, { text: helpMessage }, { quoted: message });
    } catch (error) {
        console.error('[menu] send error:', error.message || error);
        return sock.sendMessage(chatId, { text: helpMessage }, { quoted: message });
    }
}

module.exports = helpCommand;
module.exports.buildMenu = buildMenu;
module.exports.buildDeveloperMenu = buildDeveloperMenu;
module.exports.developerButtons = developerButtons;
