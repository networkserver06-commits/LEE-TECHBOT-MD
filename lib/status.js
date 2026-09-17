'use strict';

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

function unwrap(message) {
    let current = message || {};
    for (let i = 0; i < 5; i += 1) {
        if (current.ephemeralMessage?.message) current = current.ephemeralMessage.message;
        else if (current.viewOnceMessage?.message) current = current.viewOnceMessage.message;
        else if (current.viewOnceMessageV2?.message) current = current.viewOnceMessageV2.message;
        else break;
    }
    return current;
}

function getQuotedMessage(message) {
    const current = unwrap(message?.message || message);
    const context = current.extendedTextMessage?.contextInfo
        || current.imageMessage?.contextInfo
        || current.videoMessage?.contextInfo
        || current.documentMessage?.contextInfo
        || current.audioMessage?.contextInfo;
    return unwrap(context?.quotedMessage);
}

function getDirectMediaMessage(message) {
    const value = unwrap(message?.message || message);
    for (const type of ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage']) {
        if (value[type]) return value;
    }
    return null;
}

function getCommandContent(message) {
    return getContent(getQuotedMessage(message)) || getContent(getDirectMediaMessage(message));
}

function getContent(quoted) {
    const value = unwrap(quoted);
    if (value.conversation) return { type: 'text', value: value.conversation };
    if (value.extendedTextMessage?.text) return { type: 'text', value: value.extendedTextMessage.text };
    for (const type of ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage']) {
        if (value[type]) return { type: type.replace('Message', ''), value: value[type] };
    }
    return null;
}

async function downloadMedia(media, type) {
    const stream = await downloadContentFromMessage(media, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

function normalizeJid(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const [user, server] = text.split('@');
    if (!user || !server) return '';
    if (server === 'lid') return /^\d+$/.test(user) ? `${user}@lid` : '';
    const number = user.split(':')[0].replace(/[^0-9]/g, '');
    return number ? `${number}@s.whatsapp.net` : '';
}

function participantJids(participant) {
    return [...new Set([
        normalizeJid(participant?.phoneNumber),
        normalizeJid(participant?.id),
        normalizeJid(participant?.jid)
    ].filter(Boolean))];
}

async function groupAudience(sock, chatId) {
    const metadata = await sock.groupMetadata(chatId);
    if (!metadata?.participants?.length) throw new Error('The group has no participants');
    const recipients = (metadata.participants || [])
        .flatMap(participantJids);
    return { subject: metadata.subject || 'selected group', recipients: [...new Set(recipients)] };
}

async function personalAudience(sock) {
    const recipients = new Set();
    try {
        const groups = await sock.groupFetchAllParticipating();
        for (const group of Object.values(groups || {})) {
            for (const participant of group.participants || []) {
                for (const jid of participantJids(participant)) recipients.add(jid);
            }
        }
    } catch (error) {
        console.warn('[status] Could not build full personal audience:', error.message || error);
    }
    for (const jid of participantJids({ id: sock.user?.id })) recipients.add(jid);
    return [...recipients];
}

async function publishStatus(sock, content, recipients) {
    const payload = content.type === 'text'
        ? { text: content.value, backgroundColor: '#000000', font: 1 }
        : {
            [content.type]: await downloadMedia(content.value, content.type),
            ...(content.value.caption ? { caption: content.value.caption } : {}),
            ...(content.value.mimetype ? { mimetype: content.value.mimetype } : {}),
            ...(content.value.fileName ? { fileName: content.value.fileName } : {})
        };
    const options = { broadcast: true };
    if (recipients?.length) options.statusJidList = [...new Set(recipients)];
    await sock.sendMessage('status@broadcast', payload, options);
}

module.exports = {
    getQuotedMessage,
    getDirectMediaMessage,
    getCommandContent,
    getContent,
    groupAudience,
    personalAudience,
    publishStatus,
    normalizeJid,
    participantJids
};
