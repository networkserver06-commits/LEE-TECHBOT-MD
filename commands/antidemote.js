'use strict';

const path = require('path');
const { readJson, atomicWriteJson } = require('../lib/runtime');
const { isAdmin } = require('../lib/isAdmin');
const isOwnerOrSudo = require('../lib/isOwner');

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'userGroupData.json');

function readData() {
    return readJson(SETTINGS_PATH, {});
}

function isAntiDemoteEnabled(groupId) {
    const data = readData();
    const overrides = data.antidemote || {};
    if (Object.prototype.hasOwnProperty.call(overrides, groupId)) return overrides[groupId] === true;
    return data.antidemoteDefault === true;
}

function setAntiDemote(groupId, enabled) {
    const data = readData();
    data.antidemote = data.antidemote || {};
    data.antidemote[groupId] = Boolean(enabled);
    atomicWriteJson(SETTINGS_PATH, data);
    return Boolean(enabled);
}

function setAntiDemoteDefault(enabled) {
    const data = readData();
    data.antidemoteDefault = Boolean(enabled);
    atomicWriteJson(SETTINGS_PATH, data);
    return Boolean(enabled);
}

function normalizeParticipants(participants) {
    return (Array.isArray(participants) ? participants : [])
        .map(item => typeof item === 'string' ? item : item?.id)
        .filter(jid => typeof jid === 'string' && jid.includes('@'));
}

async function antiDemoteCommand(sock, chatId, message, action = '') {
    const value = String(action || '').trim().toLowerCase();
    const on = ['on', 'enable', 'enabled', 'true'].includes(value);
    const off = ['off', 'disable', 'disabled', 'false'].includes(value);

    if (!chatId.endsWith('@g.us')) {
        const owner = await isOwnerOrSudo(message.key.participant || message.key.remoteJid, sock, chatId).catch(() => false);
        if (!message.key.fromMe && !owner) {
            return sock.sendMessage(chatId, { text: '❌ Only the owner or sudo can configure .antidemote from DM.' }, { quoted: message });
        }
        if (on) {
            setAntiDemoteDefault(true);
            return sock.sendMessage(chatId, { text: '✅ *Anti-demote is now ON by default* for all groups without a specific setting.' }, { quoted: message });
        }
        if (off) {
            setAntiDemoteDefault(false);
            return sock.sendMessage(chatId, { text: '✅ *Anti-demote is now OFF by default* for all groups without a specific setting.' }, { quoted: message });
        }
        const state = readData().antidemoteDefault === true ? 'ON' : 'OFF';
        return sock.sendMessage(chatId, { text: `🛡️ *Anti-demote default:* ${state}\n\nUse *.antidemote on* or *.antidemote off* in DM.` }, { quoted: message });
    }

    let admin = false;
    try {
        admin = (await isAdmin(sock, chatId, message.key.participant || message.key.remoteJid)).isSenderAdmin;
    } catch {}
    if (!message.key.fromMe && !admin) {
        return sock.sendMessage(chatId, { text: '❌ Only group admins can configure anti-demote.' }, { quoted: message });
    }
    if (on) {
        setAntiDemote(chatId, true);
        return sock.sendMessage(chatId, { text: '✅ *Anti-demote is now ON* for this group.' }, { quoted: message });
    }
    if (off) {
        setAntiDemote(chatId, false);
        return sock.sendMessage(chatId, { text: '✅ *Anti-demote is now OFF* for this group.' }, { quoted: message });
    }
    const state = isAntiDemoteEnabled(chatId) ? 'ON' : 'OFF';
    return sock.sendMessage(chatId, { text: `🛡️ *Anti-demote:* ${state}\n\nUse *.antidemote on* or *.antidemote off*.` }, { quoted: message });
}

async function handleAntiDemote(sock, groupId, participants, author) {
    if (!isAntiDemoteEnabled(groupId)) return { enabled: false, restored: [] };
    const users = normalizeParticipants(participants);
    if (users.length === 0) return { enabled: true, restored: [] };
    // The owner may freely demote anyone. Only protect the configured owner
    // account when a different actor performs the demotion.
    const authorizedActor = author
        ? await isOwnerOrSudo(typeof author === 'string' ? author : author?.id, sock, groupId).catch(() => false)
        : false;
    if (authorizedActor) return { enabled: true, restored: [] };

    const ownerParticipants = [];
    for (const user of users) {
        if (await isOwnerOrSudo(user, sock, groupId).catch(() => false)) ownerParticipants.push(user);
    }
    if (ownerParticipants.length === 0) return { enabled: true, restored: [] };
    try {
        await sock.groupParticipantsUpdate(groupId, ownerParticipants, 'promote');
        await sock.sendMessage(groupId, {
            text: `🛡️ *ANTI-DEMOTE*\n\n${ownerParticipants.map(jid => `✅ @${jid.split('@')[0]} was restored as admin.`).join('\n')}\n\nOnly the bot owner is protected.`,
            mentions: ownerParticipants
        });
        return { enabled: true, restored: ownerParticipants };
    } catch (error) {
        console.error('[antidemote] Failed to restore admins:', error.message || error);
        try {
            await sock.sendMessage(groupId, {
                text: '⚠️ Anti-demote detected a demotion but could not restore the admin. Make sure the bot is an admin and the demoted account is eligible for promotion.'
            });
        } catch {}
        return { enabled: true, restored: [], error };
    }
}

module.exports = {
    SETTINGS_PATH,
    antiDemoteCommand,
    handleAntiDemote,
    isAntiDemoteEnabled,
    setAntiDemote,
    setAntiDemoteDefault
};
