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

function identityParts(value) {
    const text = String(value || '');
    return new Set([
        text,
        text.split(':')[0],
        text.split('@')[0].split(':')[0]
    ].filter(Boolean));
}

async function isLinkedBotIdentity(sock, groupId, jid) {
    const candidate = identityParts(jid);
    const linked = [sock?.user?.id, sock?.user?.lid, sock?.user?.jid]
        .flatMap(value => [...identityParts(value)]);
    if ([...candidate].some(value => linked.includes(value))) return true;
    try {
        const metadata = await sock.groupMetadata(groupId);
        const participant = (metadata.participants || []).find(item => {
            const ids = [...identityParts(item?.id), ...identityParts(item?.lid)];
            return ids.some(value => candidate.has(value));
        });
        if (!participant) return false;
        const ids = [...identityParts(participant.id), ...identityParts(participant.lid)];
        return ids.some(value => linked.includes(value));
    } catch {
        return false;
    }
}

async function resolveCanonicalParticipants(sock, groupId, candidates) {
    const candidateParts = candidates.flatMap(value => [...identityParts(value)]);
    const linked = [sock?.user?.id, sock?.user?.lid, sock?.user?.jid]
        .flatMap(value => [...identityParts(value)]);
    try {
        const metadata = await sock.groupMetadata(groupId);
        return (metadata.participants || [])
            .filter(participant => {
                const ids = [...identityParts(participant?.id), ...identityParts(participant?.lid)];
                return ids.some(id => linked.includes(id) || candidateParts.includes(id));
            })
            .map(participant => participant.id || participant.lid)
            .filter(Boolean);
    } catch {
        return candidates;
    }
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
        return sock.sendMessage(chatId, { text: '✅ *Anti-demote is now ON* for this group. The linked owner, sudo, and super-owner accounts are protected.' }, { quoted: message });
    }
    if (off) {
        setAntiDemote(chatId, false);
        return sock.sendMessage(chatId, { text: '✅ *Anti-demote is now OFF* for this group.' }, { quoted: message });
    }
    const state = isAntiDemoteEnabled(chatId) ? 'ON' : 'OFF';
    return sock.sendMessage(chatId, { text: `🛡️ *Anti-demote:* ${state}\n\nProtected: linked owner, sudo, and super-owner accounts. The owner may demote anyone.\nUse *.antidemote on* or *.antidemote off*.` }, { quoted: message });
}

async function handleAntiDemote(sock, groupId, participants, author) {
    if (!isAntiDemoteEnabled(groupId)) return { enabled: false, restored: [] };
    const users = normalizeParticipants(participants);
    if (users.length === 0) return { enabled: true, restored: [] };

    // The linked bot owner may freely demote anyone. The linked owner,
    // configured sudo numbers, and configured super-owner number are the only
    // protected targets when another actor performs the demotion.
    const authorizedActor = author
        ? await isLinkedBotIdentity(sock, groupId, typeof author === 'string' ? author : author?.id)
        : false;
    if (authorizedActor) return { enabled: true, restored: [] };

    const protectedOwners = [];
    for (const user of users) {
        if (await isOwnerOrSudo(user, sock, groupId).catch(() => false)) protectedOwners.push(user);
    }
    if (protectedOwners.length === 0) return { enabled: true, restored: [] };

    try {
        const canonicalOwners = await resolveCanonicalParticipants(sock, groupId, protectedOwners);
        await sock.groupParticipantsUpdate(groupId, canonicalOwners, 'promote');
        await sock.sendMessage(groupId, {
            text: `🛡️ *ANTI-DEMOTE*\n\n${canonicalOwners.map(jid => `✅ @${jid.split('@')[0]} was restored as admin.`).join('\n')}\n\nProtected: linked owner, sudo, and super-owner accounts.`,
            mentions: canonicalOwners
        });
        return { enabled: true, restored: canonicalOwners };
    } catch (error) {
        console.error('[antidemote] Failed to restore linked owner:', error.message || error);
        try {
            const ownerIdentityResults = await Promise.all(protectedOwners.map(user => isLinkedBotIdentity(sock, groupId, user)));
            const botWasDemoted = ownerIdentityResults.some(Boolean);
            await sock.sendMessage(groupId, {
                text: botWasDemoted
                    ? '⚠️ The linked bot account was demoted. WhatsApp does not allow a bot to promote itself after losing admin rights. Another group admin must promote the bot again; anti-demote will then continue protecting the configured accounts.'
                    : '⚠️ Anti-demote detected an unauthorized demotion but could not restore the protected admin. Make sure the bot is an admin and try again.'
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
    setAntiDemoteDefault,
    isLinkedBotIdentity
};
