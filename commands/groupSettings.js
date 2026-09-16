'use strict';

const fs = require('fs');
const path = require('path');
const { resolveGroupTarget } = require('../lib/groupTarget');
const { setAntilink, setAntitag, setAntiBadword, removeAntiBadword, setChatbot, addWelcome, delWelcome, addGoodbye, delGoodBye } = require('../lib');

const DATA_DIR = path.join(process.cwd(), 'data');
const FEATURE_ALIASES = {
    antilink: 'antilink', link: 'antilink',
    antibadword: 'antibadword', badword: 'antibadword',
    antitag: 'antitag', tag: 'antitag',
    welcome: 'welcome', goodbye: 'goodbye', chatbot: 'chatbot',
    antisticker: 'antisticker', sticker: 'antisticker',
    antiphoto: 'antiphoto', photo: 'antiphoto',
    antiviewonce: 'antiviewonce', viewonce: 'antiviewonce',
    antifake: 'antifake', fake: 'antifake',
    antibot: 'antibot', bot: 'antibot'
};

function readJson(file, fallback = {}) {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); } catch (_) { return fallback; }
}

function writeJson(file, data) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

function statusFor(feature, jid) {
    if (feature === 'antilink') return Boolean(readJson('userGroupData.json').antilink?.[jid]?.enabled);
    if (feature === 'antibadword') return Boolean(readJson('userGroupData.json').antibadword?.[jid]?.enabled);
    if (feature === 'antitag') return Boolean(readJson('userGroupData.json').antitag?.[jid]?.enabled);
    if (feature === 'welcome') return Boolean(readJson('userGroupData.json').welcome?.[jid]?.enabled);
    if (feature === 'goodbye') return Boolean(readJson('userGroupData.json').goodbye?.[jid]?.enabled);
    if (feature === 'chatbot') return Boolean(readJson('userGroupData.json').chatbot?.[jid]?.enabled);
    if (feature === 'antibot') return global.antibotState?.[jid]?.status === 'on';
    if (feature === 'antisticker') return global.antistickerState?.[jid] === 'on';
    if (feature === 'antiphoto') return global.antiphotoState?.[jid] === 'on';
    if (feature === 'antiviewonce') return global.antiviewonceState?.[jid] === 'on';
    if (feature === 'antifake') return global.antifakeState?.[jid] === 'on';
    return false;
}

function ensureGlobalState() {
    global.antibotState = global.antibotState || {};
    global.antistickerState = global.antistickerState || {};
    global.antiphotoState = global.antiphotoState || {};
    global.antiviewonceState = global.antiviewonceState || {};
    global.antifakeState = global.antifakeState || {};
}

async function setFeature(feature, jid, enabled) {
    const action = enabled ? 'on' : 'off';
    if (feature === 'antilink') return setAntilink(jid, action, 'delete');
    if (feature === 'antitag') return setAntitag(jid, action, 'delete');
    if (feature === 'antibadword') return enabled ? setAntiBadword(jid, 'on', 'delete') : removeAntiBadword(jid);
    if (feature === 'welcome') return enabled ? addWelcome(jid, true) : delWelcome(jid);
    if (feature === 'goodbye') return enabled ? addGoodbye(jid, true) : delGoodBye(jid);
    if (feature === 'chatbot') return setChatbot(jid, enabled);

    ensureGlobalState();
    if (feature === 'antibot') global.antibotState[jid] = { status: action, action: global.antibotState[jid]?.action || 'kick' };
    if (feature === 'antisticker') { global.antistickerState[jid] = action; writeJson('antisticker.json', global.antistickerState); }
    if (feature === 'antiphoto') { global.antiphotoState[jid] = action; writeJson('antiphoto.json', global.antiphotoState); }
    if (feature === 'antiviewonce') { global.antiviewonceState[jid] = action; writeJson('antiviewonce.json', global.antiviewonceState); }
    if (feature === 'antifake') global.antifakeState[jid] = action;
    return true;
}

async function groupSettingsCommand(sock, chatId, message, args = []) {
    const targetArg = args[0];
    const featureArg = String(args[1] || '').toLowerCase();
    const valueArg = String(args[2] || '').toLowerCase();
    const target = await resolveGroupTarget(sock, chatId, targetArg);
    if (target.error) return sock.sendMessage(chatId, { text: target.error }, { quoted: message });

    const feature = FEATURE_ALIASES[featureArg];
    if (!featureArg || featureArg === 'status' || featureArg === 'show') {
        const features = Object.keys(FEATURE_ALIASES).filter((key) => FEATURE_ALIASES[key] === key);
        const lines = features.map((name) => `${statusFor(name, target.jid) ? '✅' : '❌'} ${name}`);
        return sock.sendMessage(chatId, { text: `⚙️ *GROUP SETTINGS*\n*${target.subject || target.jid}*\n${target.jid}\n\n${lines.join('\n')}\n\nUsage: .gsettings <number|jid> <feature> <on|off>` }, { quoted: message });
    }
    if (!feature || !['on', 'off'].includes(valueArg)) {
        return sock.sendMessage(chatId, { text: 'Usage: .gsettings <number|jid> <feature> <on|off>\nFeatures: antilink, antibadword, antitag, welcome, goodbye, chatbot, antisticker, antiphoto, antiviewonce, antifake, antibot' }, { quoted: message });
    }

    const enabled = valueArg === 'on';
    try {
        await setFeature(feature, target.jid, enabled);
        return sock.sendMessage(chatId, { text: `✅ *${feature}* turned *${valueArg.toUpperCase()}* for *${target.subject || target.jid}*.\nTarget: ${target.jid}` }, { quoted: message });
    } catch (error) {
        console.error('[gsettings]', error.message || error);
        return sock.sendMessage(chatId, { text: `❌ Could not update ${feature} for ${target.jid}.` }, { quoted: message });
    }
}

module.exports = { groupSettingsCommand, statusFor, setFeature };
