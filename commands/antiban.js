'use strict';

const path = require('path');
const { readJson, atomicWriteJson } = require('../lib/runtime');

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'userGroupData.json');

function readData() { return readJson(SETTINGS_PATH, {}); }

function isAntiBanEnabled() {
    return readData().antibanDefault === true;
}

function setAntiBanDefault(enabled) {
    const data = readData();
    data.antibanDefault = Boolean(enabled);
    atomicWriteJson(SETTINGS_PATH, data);
    return Boolean(enabled);
}

function identityParts(value) {
    const text = String(value || '');
    return new Set([text, text.split(':')[0], text.split('@')[0].split(':')[0]].filter(Boolean));
}

function isLinkedOwner(sock, message) {
    if (message?.key?.fromMe) return true;
    const sender = identityParts(message?.key?.participant || message?.key?.remoteJid);
    const linked = [sock?.user?.id, sock?.user?.lid, sock?.user?.jid]
        .flatMap(value => [...identityParts(value)]);
    return [...sender].some(value => linked.includes(value));
}

async function antiBanCommand(sock, chatId, message, action = '') {
    if (!isLinkedOwner(sock, message)) {
        return sock.sendMessage(chatId, { text: '❌ Only the owner account linked to this bot can use .antiban.' }, { quoted: message });
    }
    const value = String(action || '').trim().toLowerCase();
    if (['on', 'enable', 'enabled', 'true'].includes(value)) {
        setAntiBanDefault(true);
        return sock.sendMessage(chatId, { text: '✅ *Anti-ban safety is ON globally.* Conservative throttling and duplicate suppression are enabled.' }, { quoted: message });
    }
    if (['off', 'disable', 'disabled', 'false'].includes(value)) {
        setAntiBanDefault(false);
        return sock.sendMessage(chatId, { text: '⚠️ *Anti-ban safety is OFF globally.* This cannot bypass WhatsApp bans or enforcement.' }, { quoted: message });
    }
    return sock.sendMessage(chatId, {
        text: `🛡️ *Anti-ban safety:* ${isAntiBanEnabled() ? 'ON' : 'OFF'}\n\nOwner-only global setting. It reduces spam and rate-limit risk but cannot guarantee immunity from WhatsApp bans.\nUse *.antiban on* or *.antiban off*.`
    }, { quoted: message });
}

module.exports = { SETTINGS_PATH, antiBanCommand, isAntiBanEnabled, setAntiBanDefault, isLinkedOwner };
