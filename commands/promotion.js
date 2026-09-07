'use strict';

const path = require('path');
const { readJson, atomicWriteJson } = require('../lib/runtime');
const { isAdmin } = require('../lib/isAdmin');

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'userGroupData.json');

function readGroupData() {
    return readJson(SETTINGS_PATH, {});
}

function isPromotionNotificationsEnabled(groupId) {
    const data = readGroupData();
    return data.promotionNotifications?.[groupId] === true;
}

function setPromotionNotifications(groupId, enabled) {
    const data = readGroupData();
    data.promotionNotifications = data.promotionNotifications || {};
    data.promotionNotifications[groupId] = Boolean(enabled);
    atomicWriteJson(SETTINGS_PATH, data);
    return Boolean(enabled);
}

async function promotionCommand(sock, chatId, message, action = '') {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ This command can only be used in a group.' }, { quoted: message });
    }

    let admin = false;
    try {
        admin = (await isAdmin(sock, chatId, message.key.participant || message.key.remoteJid)).isSenderAdmin;
    } catch {}
    if (!message.key.fromMe && !admin) {
        return sock.sendMessage(chatId, { text: '❌ Only group admins can change promotion notification settings.' }, { quoted: message });
    }

    const value = String(action || '').trim().toLowerCase();
    if (['on', 'enable', 'enabled', 'true'].includes(value)) {
        setPromotionNotifications(chatId, true);
        return sock.sendMessage(chatId, { text: '✅ Automatic promotion and demotion notifications are now *ON* in this group.' }, { quoted: message });
    }
    if (['off', 'disable', 'disabled', 'false'].includes(value)) {
        setPromotionNotifications(chatId, false);
        return sock.sendMessage(chatId, { text: '✅ Automatic promotion and demotion notifications are now *OFF* in this group.' }, { quoted: message });
    }
    const state = isPromotionNotificationsEnabled(chatId) ? 'ON' : 'OFF';
    return sock.sendMessage(chatId, {
        text: `⚙️ *Promotion notifications:* ${state}\n\nUse *.promotion on* or *.promotion off* to change this setting.`
    }, { quoted: message });
}

module.exports = { promotionCommand, isPromotionNotificationsEnabled, setPromotionNotifications, SETTINGS_PATH };
