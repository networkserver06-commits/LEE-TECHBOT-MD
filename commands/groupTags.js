'use strict';
const { getGroupMetadata } = require('../lib/groupMetadata');
const isAdmin = require('../lib/isAdmin');

function participantId(participant) {
    return participant?.id || participant?.jid || participant?.phoneNumber || null;
}

function uniqueParticipants(metadata) {
    const seen = new Set();
    return (metadata?.participants || []).filter((participant) => {
        const id = participantId(participant);
        if (!id || seen.has(id) || id.startsWith('status@')) return false;
        seen.add(id);
        return true;
    });
}

function formatTag(id) {
    return `@${String(id).split('@')[0].split(':')[0]}`;
}
const tagCooldowns = new Map();
function rateLimited(chatId, senderId, label) {
    const key = `${chatId}:${senderId}:${label}`;
    const now = Date.now();
    const last = tagCooldowns.get(key) || 0;
    if (now - last < 15000) return true;
    tagCooldowns.set(key, now);
    return false;
}
async function sendRateLimit(sock, chatId, message) {
    await sock.sendMessage(chatId, { text: '⏳ Rate-limited: please wait 15 seconds before using another group-tag command.' }, { quoted: message });
}

async function sendGroupUnavailable(sock, chatId, message) {
    await sock.sendMessage(chatId, {
        text: '⏳ WhatsApp group details are temporarily unavailable or rate-limited. Please wait a few seconds and try again.',
    }, { quoted: message }).catch(() => {});
}

async function getAuthorizedParticipants(sock, chatId, senderId, message, label) {
    const status = await isAdmin(sock, chatId, senderId);
    if (!status.metadataAvailable) {
        await sendGroupUnavailable(sock, chatId, message);
        return null;
    }
    if (!status.isBotAdmin) {
        await sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' }, { quoted: message });
        return null;
    }
    if (!status.isSenderAdmin) {
        await sock.sendMessage(chatId, { text: `Only group admins can use the .${label} command.` }, { quoted: message });
        return null;
    }
    const metadata = status.metadata || await getGroupMetadata(sock, chatId);
    if (!metadata) {
        await sendGroupUnavailable(sock, chatId, message);
        return null;
    }
    return uniqueParticipants(metadata);
}

async function tagParticipants(sock, chatId, message, participants, text) {
    if (!participants.length) {
        await sock.sendMessage(chatId, { text: 'No matching participants found.' }, { quoted: message });
        return;
    }
    const mentions = participants.map(participantId);
    const body = `${text}\n\n${participants.map((participant) => formatTag(participantId(participant))).join('\n')}`;
    await sock.sendMessage(chatId, { text: body, mentions }, { quoted: message });
}

async function tagAllCommand(sock, chatId, senderId, message) {
    try {
        const participants = await getAuthorizedParticipants(sock, chatId, senderId, message, 'tagall');
        if (participants && rateLimited(chatId, senderId, 'tagall')) return sendRateLimit(sock, chatId, message);
        if (participants) await tagParticipants(sock, chatId, message, participants, '🔊 *Hello Everyone:*');
    } catch (error) {
        console.error('Error in tagall command:', error?.message || error);
        await sendGroupUnavailable(sock, chatId, message);
    }
}

async function tagNotAdminCommand(sock, chatId, senderId, message) {
    try {
        const participants = await getAuthorizedParticipants(sock, chatId, senderId, message, 'tagnotadmin');
        if (participants && rateLimited(chatId, senderId, 'tagnotadmin')) return sendRateLimit(sock, chatId, message);
        if (!participants) return;
        const nonAdmins = participants.filter((participant) => !participant.admin);
        await tagParticipants(sock, chatId, message, nonAdmins, '🔊 *Hello Members:*');
    } catch (error) {
        console.error('Error in tagnotadmin command:', error?.message || error);
        await sendGroupUnavailable(sock, chatId, message);
    }
}

async function tagAdminsCommand(sock, chatId, senderId, message) {
    try {
        const participants = await getAuthorizedParticipants(sock, chatId, senderId, message, 'tagadmin');
        if (participants && rateLimited(chatId, senderId, 'tagadmin')) return sendRateLimit(sock, chatId, message);
        if (participants) await tagParticipants(sock, chatId, message, participants.filter((participant) => participant.admin), '📢 *Group Admins:*');
    } catch (error) {
        console.error('Error in tagadmin command:', error?.message || error);
        await sendGroupUnavailable(sock, chatId, message);
    }
}

async function contactTagCommand(sock, chatId, senderId, message) {
    try {
        const participants = await getAuthorizedParticipants(sock, chatId, senderId, message, 'contacttag');
        if (participants && rateLimited(chatId, senderId, 'contacttag')) return sendRateLimit(sock, chatId, message);
        if (!participants) return;
        const contacts = participants.map((participant) => {
            const id = participantId(participant);
            const number = String(id).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            return number ? {
                displayName: participant.notify || participant.name || `WhatsApp ${number}`,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${participant.notify || participant.name || number}\nTEL;waid=${number}:+${number}\nEND:VCARD\n`,
            } : null;
        }).filter(Boolean);
        if (!contacts.length) {
            await sock.sendMessage(chatId, { text: 'No valid contacts found in this group.' }, { quoted: message });
            return;
        }
        await sock.sendMessage(chatId, {
            contacts: { displayName: `Group contacts (${contacts.length})`, contacts },
        }, { quoted: message });
    } catch (error) {
        console.error('Error in contacttag command:', error?.message || error);
        await sendGroupUnavailable(sock, chatId, message);
    }
}

module.exports = { tagAllCommand, tagNotAdminCommand, tagAdminsCommand, contactTagCommand };
