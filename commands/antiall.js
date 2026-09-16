'use strict';

const { setAntilink, getAntilink, setAntitag, getAntitag, setAntiBadword, getAntiBadword, removeAntiBadword } = require('../lib');
const fs = require('fs');
const path = require('path');
const { persistRuntimeSettings } = require('../lib/runtimeSettings');

function setJsonState(file, key, value) {
    const filePath = path.join(__dirname, '../data', file);
    let data = {};
    try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch {}
    data[key] = value;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function protectionStatus(chatId) {
    const [link, tag, badword] = await Promise.all([
        getAntilink(chatId, 'on'),
        getAntitag(chatId, 'on'),
        getAntiBadword(chatId, 'on')
    ]);
    return {
        antilink: Boolean(link?.enabled),
        antitag: Boolean(tag?.enabled),
        antibadword: Boolean(badword?.enabled),
        antiphoto: global.antiphotoState?.[chatId] === 'on',
        antisticker: global.antistickerState?.[chatId] === 'on',
        antiviewonce: global.antiviewonceState?.[chatId] === 'on',
        antifake: global.antifakeState?.[chatId] === 'on',
        antibot: global.antibotState?.[chatId]?.status === 'on',
        antispam: global.antispamState === 'on'
    };
}

function formatStatus(status) {
    return Object.entries(status).map(([name, enabled]) => `${enabled ? '✅' : '❌'} ${name}`).join('\n');
}

async function antiallCommand(sock, chatId, message, isGroup, isSenderAdmin, isBotAdmin, isOwnerOrSudoCheck, userMessage) {
    if (!isGroup) return sock.sendMessage(chatId, { text: '❌ .antiall can only be used in groups.' }, { quoted: message });
    if (!isSenderAdmin && !isOwnerOrSudoCheck) return sock.sendMessage(chatId, { text: '❌ Only group admins can change anti-protection settings.' }, { quoted: message });

    const action = userMessage.trim().split(/\s+/)[1]?.toLowerCase() || 'status';
    if (action === 'status') {
        const status = await protectionStatus(chatId);
        return sock.sendMessage(chatId, { text: `🛡️ *ANTI-PROTECTION STATUS*\n\n${formatStatus(status)}\n\nUse .antiall on/off to change all group protections.` }, { quoted: message });
    }
    if (action !== 'on' && action !== 'off') {
        return sock.sendMessage(chatId, { text: 'Usage: .antiall on | off | status' }, { quoted: message });
    }
    if (action === 'on' && !isBotAdmin) return sock.sendMessage(chatId, { text: '❌ Promote the bot to admin before enabling all protections.' }, { quoted: message });

    const enabled = action === 'on';
    await setAntilink(chatId, action, 'delete');
    await setAntitag(chatId, action, 'delete');
    if (enabled) await setAntiBadword(chatId, 'on', 'delete');
    else await removeAntiBadword(chatId);

    setJsonState('antiphoto.json', chatId, action);
    setJsonState('antisticker.json', chatId, action);
    global.antiphotoState[chatId] = action;
    global.antistickerState[chatId] = action;
    global.antiviewonceState[chatId] = action;
    global.antifakeState[chatId] = action;
    global.antibotState[chatId] = { status: action, action: 'delete' };
    global.antispamState = action;
    persistRuntimeSettings();

    const status = await protectionStatus(chatId);
    return sock.sendMessage(chatId, { text: `✅ All group anti-protections turned *${action.toUpperCase()}*.\n\n${formatStatus(status)}` }, { quoted: message });
}

module.exports = antiallCommand;
module.exports.protectionStatus = protectionStatus;
