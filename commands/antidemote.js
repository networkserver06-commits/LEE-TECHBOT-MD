'use strict';

const fs = require('fs');
const path = require('path');
const { readJson, atomicWriteJson } = require('../lib/runtime');
const { isAdmin } = require('../lib/isAdmin');
const isOwnerOrSudo = require('../lib/isOwner');
const settings = require('../settings');
const { getSudoList } = require('../lib/index');

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'userGroupData.json');
const BANNED_PATH = path.join(process.cwd(), 'data', 'banned.json');

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

function getAntiDemoteAction(groupId) {
    const data = readData();
    const overrides = data.antidemoteAction || {};
    return overrides[groupId] || data.antidemoteActionDefault || 'warn';
}

function setAntiDemoteAction(groupId, action) {
    const data = readData();
    data.antidemoteAction = data.antidemoteAction || {};
    data.antidemoteAction[groupId] = action;
    atomicWriteJson(SETTINGS_PATH, data);
    return action;
}

function setAntiDemoteActionDefault(action) {
    const data = readData();
    data.antidemoteActionDefault = action;
    atomicWriteJson(SETTINGS_PATH, data);
    return action;
}

function addToBanList(jid) {
    let users = [];
    try { users = JSON.parse(fs.readFileSync(BANNED_PATH, 'utf8')); } catch {}
    if (!Array.isArray(users)) users = [];
    if (!users.includes(jid)) users.push(jid);
    fs.mkdirSync(path.dirname(BANNED_PATH), { recursive: true });
    fs.writeFileSync(BANNED_PATH, `${JSON.stringify(users, null, 2)}\n`, { mode: 0o600 });
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

async function isProtectedIdentity(sock, groupId, jid) {
    if (await isLinkedBotIdentity(sock, groupId, jid).catch(() => false)) return true;
    const configured = [settings.ownerNumber, settings.superOwnerNumber, ...(await getSudoList().catch(() => []))]
        .flatMap(value => [...identityParts(value)]);
    const candidate = identityParts(jid);
    if ([...candidate].some(value => configured.includes(value))) return true;
    try {
        const metadata = await sock.groupMetadata(groupId);
        const participant = (metadata.participants || []).find(item => {
            const ids = [...identityParts(item?.id), ...identityParts(item?.lid)];
            return ids.some(value => candidate.has(value));
        });
        if (!participant) return false;
        const ids = [...identityParts(participant.id), ...identityParts(participant.lid)];
        return ids.some(value => configured.includes(value));
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
                return ids.some(id => candidateParts.includes(id));
            })
            .map(participant => participant.id || participant.lid)
            .filter(Boolean);
    } catch {
        return candidates;
    }
}

async function enforceDemoter(sock, groupId, author, action) {
    const demoter = typeof author === 'string' ? author : author?.id;
    if (!demoter || !demoter.includes('@') || action === 'warn') return false;
    const canonical = await resolveCanonicalParticipants(sock, groupId, [demoter]);
    const target = canonical[0] || demoter;
    if (await isLinkedBotIdentity(sock, groupId, target).catch(() => false)) return false;
    if (await isProtectedIdentity(sock, groupId, target)) return false;
    if (action === 'ban') addToBanList(target);
    await sock.groupParticipantsUpdate(groupId, [target], 'remove');
    return true;
}

async function antiDemoteCommand(sock, chatId, message, action = '') {
    const value = String(action || '').trim().toLowerCase();
    const on = ['on', 'enable', 'enabled', 'true'].includes(value);
    const off = ['off', 'disable', 'disabled', 'false'].includes(value);
    const selectedAction = ['warn', 'kick', 'ban'].includes(value) ? value : null;

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
        if (selectedAction) {
            setAntiDemoteActionDefault(selectedAction);
            return sock.sendMessage(chatId, { text: `✅ Anti-demote action default is now *${selectedAction.toUpperCase()}*.` }, { quoted: message });
        }
        const state = readData().antidemoteDefault === true ? 'ON' : 'OFF';
        return sock.sendMessage(chatId, { text: `🛡️ *Anti-demote default:* ${state}\n⚔️ *Action:* ${getAntiDemoteAction()}\n\nUse *.antidemote on/off* or *.antidemote warn/kick/ban* in DM.` }, { quoted: message });
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
    if (selectedAction) {
        setAntiDemoteAction(chatId, selectedAction);
        return sock.sendMessage(chatId, { text: `✅ Anti-demote action for this group is now *${selectedAction.toUpperCase()}*.` }, { quoted: message });
    }
    const state = isAntiDemoteEnabled(chatId) ? 'ON' : 'OFF';
    return sock.sendMessage(chatId, { text: `🛡️ *Anti-demote:* ${state}\n⚔️ *Action:* ${getAntiDemoteAction(chatId)}\n\nProtected: linked owner, sudo, and super-owner accounts.\nUse *.antidemote on/off* or *.antidemote warn/kick/ban*.` }, { quoted: message });
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
        if (await isProtectedIdentity(sock, groupId, user)) protectedOwners.push(user);
    }
    if (protectedOwners.length === 0) return { enabled: true, restored: [] };

    const botWasDemoted = (await Promise.all(
        protectedOwners.map(user => isLinkedBotIdentity(sock, groupId, user))
    )).some(Boolean);
    if (botWasDemoted) {
        const demoter = typeof author === 'string' ? author : author?.id;
        const canonicalBot = await resolveCanonicalParticipants(sock, groupId, protectedOwners);
        const ownerJid = canonicalBot[0] || protectedOwners[0];
        const ownerNumber = ownerJid?.split('@')[0]?.split(':')[0] || 'unknown number';
        const ownerName = String(sock?.user?.name || sock?.user?.verifiedName || '').trim();
        const ownerLabel = ownerName ? `${ownerName} (@${ownerNumber})` : `@${ownerNumber}`;
        const mentions = [...new Set([...(canonicalBot.length ? canonicalBot : protectedOwners), ...(demoter?.includes('@') ? [demoter] : [])])];
        await sock.sendMessage(groupId, {
            text: `🚨 *OWNER DEMOTION DETECTED*\n\n👤 Linked owner: ${ownerLabel}\n⚠️ Demoted by: ${demoter?.includes('@') ? `@${demoter.split('@')[0]}` : 'an unknown participant'}\n\nWhatsApp removed the owner's admin rights, so automatic restoration and removal of the demoter are unavailable. A current group admin must promote ${ownerLabel} again. Anti-demote protection will resume automatically after that.`,
            mentions
        }).catch(error => console.error('[antidemote] Could not send bot demotion alert:', error.message || error));
        return { enabled: true, restored: [], botDemoted: true };
    }

    try {
        const canonicalOwners = await resolveCanonicalParticipants(sock, groupId, protectedOwners);
        const demoter = typeof author === 'string' ? author : author?.id;
        const demoterMention = demoter && demoter.includes('@') ? `@${demoter.split('@')[0]}` : 'Unknown participant';
        const alertMentions = demoter && demoter.includes('@')
            ? [...new Set([...canonicalOwners, demoter])]
            : canonicalOwners;
        await sock.sendMessage(groupId, {
            text: `🚨 *UNAUTHORIZED DEMOTION DETECTED*\n\n👤 *Protected owner:* ${canonicalOwners.map(jid => `@${jid.split('@')[0]}`).join(', ')}\n⚠️ *Demoted by:* ${demoterMention}\n\n🛡️ Anti-demote is attempting to restore the protected account immediately.`,
            mentions: alertMentions
        });
        const action = getAntiDemoteAction(groupId);
        let enforcementApplied = false;
        try {
            enforcementApplied = await enforceDemoter(sock, groupId, author, action);
        } catch (enforcementError) {
            console.error(`[antidemote] ${action} enforcement failed:`, enforcementError.message || enforcementError);
        }
        await sock.groupParticipantsUpdate(groupId, canonicalOwners, 'promote');
        await sock.sendMessage(groupId, {
            text: `🛡️ *ANTI-DEMOTE*\n\n${canonicalOwners.map(jid => `✅ @${jid.split('@')[0]} was restored as admin.`).join('\n')}\n\nAction: *${action.toUpperCase()}*${enforcementApplied ? ' — demoter removed.' : ''}\nProtected: linked owner, sudo, and super-owner accounts.`,
            mentions: canonicalOwners
        });
        return { enabled: true, restored: canonicalOwners };
    } catch (error) {
        console.error('[antidemote] Failed to restore linked owner:', error.message || error);
        try {
            await sock.sendMessage(groupId, {
                text: '⚠️ Anti-demote detected an unauthorized demotion but could not restore the protected admin. Make sure the bot is an admin and try again.'
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
    getAntiDemoteAction,
    setAntiDemoteAction,
    setAntiDemoteActionDefault,
    isLinkedBotIdentity,
    isProtectedIdentity
};
