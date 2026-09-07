'use strict';

const path = require('path');
const { readJson, atomicWriteJson } = require('../lib/runtime');
const { isAdmin } = require('../lib/isAdmin');
const isOwnerOrSudo = require('../lib/isOwner');

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'userGroupData.json');

function readGroupData() {
    return readJson(SETTINGS_PATH, {});
}

function isPromotionNotificationsEnabled(groupId) {
    const data = readGroupData();
    const groupSettings = data.promotionNotifications || {};
    if (Object.prototype.hasOwnProperty.call(groupSettings, groupId)) {
        return groupSettings[groupId] === true;
    }
    return data.promotionNotificationsDefault === true;
}

function setPromotionNotifications(groupId, enabled) {
    const data = readGroupData();
    data.promotionNotifications = data.promotionNotifications || {};
    data.promotionNotifications[groupId] = Boolean(enabled);
    atomicWriteJson(SETTINGS_PATH, data);
    return Boolean(enabled);
}

function setPromotionNotificationsDefault(enabled) {
    const data = readGroupData();
    data.promotionNotificationsDefault = Boolean(enabled);
    atomicWriteJson(SETTINGS_PATH, data);
    return Boolean(enabled);
}

async function promotionCommand(sock, chatId, message, action = '') {
    const value = String(action || '').trim().toLowerCase();

    // In DM, only the owner/sudo can change the default for groups that do
    // not have their own explicit setting.
    if (!chatId.endsWith('@g.us')) {
        const owner = await isOwnerOrSudo(message.key.participant || message.key.remoteJid, sock, chatId).catch(() => false);
        if (!message.key.fromMe && !owner) {
            return sock.sendMessage(chatId, { text: '❌ Only the owner or sudo can change the default promotion setting from DM.' }, { quoted: message });
        }
        if (['on', 'enable', 'enabled', 'true'].includes(value)) {
            setPromotionNotificationsDefault(true);
            return sock.sendMessage(chatId, { text: '✅ Promotion and demotion notifications are now *ON by default* for groups without their own setting.' }, { quoted: message });
        }
        if (['off', 'disable', 'disabled', 'false'].includes(value)) {
            setPromotionNotificationsDefault(false);
            return sock.sendMessage(chatId, { text: '✅ Promotion and demotion notifications are now *OFF by default* for groups without their own setting.' }, { quoted: message });
        }
        const state = readGroupData().promotionNotificationsDefault === true ? 'ON' : 'OFF';
        return sock.sendMessage(chatId, { text: `⚙️ *Default promotion notifications:* ${state}\n\nUse *.promotions on* or *.promotions off* in DM.` }, { quoted: message });
    }

    let admin = false;
    try {
        admin = (await isAdmin(sock, chatId, message.key.participant || message.key.remoteJid)).isSenderAdmin;
    } catch {}
    if (!message.key.fromMe && !admin) {
        return sock.sendMessage(chatId, { text: '❌ Only group admins can change promotion notification settings.' }, { quoted: message });
    }

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

module.exports = {
    promotionCommand,
    isPromotionNotificationsEnabled,
    setPromotionNotifications,
    setPromotionNotificationsDefault,
    SETTINGS_PATH
};
