'use strict';

/**
 * User-facing command catalog. Keep this list focused on discoverability;
 * individual command modules remain the source of execution behavior.
 */
const MENU_CATEGORIES = Object.freeze([
    { key: 'settings', title: 'SETTINGS', commands: ['addowner', 'delowner', 'listowner', 'block', 'unblock', 'blocklist', 'anticall', 'joingc', 'join', 'restart', 'mode', 'edit', 'clearall', 'autobio', 'setpp', 'autoread', 'autotyping', 'autorecording', 'autorecordtype', 'autoviewstatus', 'autoreact', 'autolikestatus', 'getsession', 'backup', 'update', 'setmenuimage', 'antidelete', 'setprefix', 'setfullpp', 'reveal', 'listgroup', 'listonline', 'settings', 'gsettings', 'groupsettings', 'setpaypoint', 'setpayment', 'paylink', 'reportcommand'] },
    { key: 'class-rep', title: 'CLASS REP', commands: ['broadcast', 'schedule', 'feedback'] },
    { key: 'student', title: 'STUDENT', commands: ['todo', 'remind', 'summary'] },
    { key: 'developer', title: 'DEVELOPER', commands: ['status', 'deploy', 'logs'] },
    { key: 'groups', title: 'GROUPS', commands: ['add', 'addall', 'promote', 'promoteall', 'demote', 'demoteall', 'kick', 'kickall', 'left', 'tagall', 'hidetag', 'totag', 'gc', 'warn', 'unwarn', 'all', 'antistatus', 'approve', 'reject', 'group', 'gcalert', 'addmetaai', 'removemetaai', 'opentime', 'closetime', 'setdesc', 'setgrouppicture', 'editinfo', 'invite', 'revoke', 'savecontact', 'sendcontact', 'contacttag', 'welcome', 'antilink', 'tagadmin'] },
    { key: 'ai', title: 'AI', commands: ['aivoice', 'ai', 'search', 'chatgpt', 'analyze', 'groq', 'grok'] },
    { key: 'anime', title: 'ANIME', commands: ['animeavatar', 'animeblush', 'animewave', 'animesmile', 'animepoke', 'animewink', 'animebonk', 'animebully', 'neko', 'waifu', 'loli'] },
    { key: 'img-maker', title: 'IMG MAKER', commands: ['create', 'ephoto', 'brat', 'toanime', 'ephotolist', 'imagine', 'deepfake', 'firelogo', 'fakeigstory', 'carbon'] },
    { key: 'convert', title: 'CONVERT', commands: ['sticker', 'take', 'toimage', 'tovideo', 'toaudio', 'tovideonote', 'tomp3', 'tovn', 'togif', 'toqr', 'addpdf', 'img2pdf', 'clearpdf', 'url', 'catbox', 'img2txt', 'get', 'fliptext', 'emojimix', 'tiny', 'ssweb', 'imgbb', 'tts', 'ocr', 'qrscan', 'vocalremover', 'colorize', 'remini', 'translate', 'removebg', 'toviewonce'] },
    { key: 'fun', title: 'FUN', commands: ['readmore', 'define', 'flux', 'tictactoe', 'quotes', 'fact', 'truth', 'google', 'pickupline', 'flirt', 'story', 'stickkill', 'note', 'roast', 'predict', 'listnote', 'deletenote', 'insult', 'wasted', 'fakechannel', 'fakedana', 'country', 'telegramsticker', 'rate'] },
    { key: 'downloads', title: 'DOWNLOADS', commands: ['play', 'ytmp3', 'ytmp4', 'mediafire', 'wallpaper', 'hdwallpaper', 'pinterest', 'tiktok', 'instagram', 'facebook', 'img', 'aio', 'fdroid', 'imgsearch', 'song', 'twitter', 'apk', 'spotify', 'spotifysearch', 'gitclone', 'splay', 'nsfw', 'npm', 'knackvideo', 'tiktokstalk'] },
    { key: 'general', title: 'GENERAL', commands: ['owner', 'menu', 'test', 'alive', 'runtime', 'script', 'donate', 'clearchat', 'delete', 'getpp', 'gemini', 'elevenlab', 'lyrics', 'yts', 'vv', 'getgrouppp', 'panel', 'copy', 'vvdm', '8ballpool', 'bible', 'quran', 'shazam', 'statusd', 'audiospeed', 'eval', 'jid', 'lid', 'tempmail', 'tempinbox', 'poll', 'channel-id', 'group-id', 'pair'] }
]);

const CATEGORY_ALIASES = Object.freeze({
    setting: 'settings', group: 'groups', groups: 'groups', image: 'img-maker', images: 'img-maker', convert: 'convert', download: 'downloads', downloads: 'downloads', fun: 'fun', general: 'general', ai: 'ai', anime: 'anime', classrep: 'class-rep', class: 'class-rep', students: 'student', dev: 'developer', developers: 'developer'
});

function getCategory(key) {
    const normalized = String(key || '').trim().toLowerCase();
    const resolved = CATEGORY_ALIASES[normalized] || normalized;
    return MENU_CATEGORIES.find((category) => category.key === resolved) || null;
}

function allCommands() {
    return MENU_CATEGORIES.flatMap((category) => category.commands);
}

module.exports = { MENU_CATEGORIES, CATEGORY_ALIASES, getCategory, allCommands };
