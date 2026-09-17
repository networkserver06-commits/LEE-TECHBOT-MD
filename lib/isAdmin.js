'use strict';
const { getGroupMetadata } = require('./groupMetadata');

function variants(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return [];
    const withoutServer = text.split('@')[0];
    const withoutDevice = withoutServer.split(':')[0];
    return [...new Set([text, withoutServer, withoutDevice])];
}

function sameIdentity(...values) {
    const left = new Set(variants(values[0]));
    return values.slice(1).some((value) => variants(value).some((candidate) => left.has(candidate)));
}

function isAdminRole(participant) {
    return participant?.admin === 'admin' || participant?.admin === 'superadmin';
}

async function isAdmin(sock, chatId, senderId) {
    try {
        const metadata = await getGroupMetadata(sock, chatId);
        if (!metadata) return { isSenderAdmin: false, isBotAdmin: false, metadataAvailable: false };
        const participants = metadata.participants || [];
        const botIdentities = [sock.user?.id, sock.user?.lid].filter(Boolean);
        const senderIdentities = [senderId].filter(Boolean);

        const isBotAdmin = participants.some((participant) => {
            if (!isAdminRole(participant)) return false;
            return [participant.id, participant.lid, participant.phoneNumber]
                .filter(Boolean)
                .some((identity) => botIdentities.some((bot) => sameIdentity(bot, identity)));
        });

        const isSenderAdmin = participants.some((participant) => {
            if (!isAdminRole(participant)) return false;
            return [participant.id, participant.lid, participant.phoneNumber]
                .filter(Boolean)
                .some((identity) => senderIdentities.some((sender) => sameIdentity(sender, identity)));
        });

        return { isSenderAdmin, isBotAdmin, metadataAvailable: true, metadata };
    } catch (err) {
        console.error('❌ Error in isAdmin:', err.message || err);
        return { isSenderAdmin: false, isBotAdmin: false, metadataAvailable: false };
    }
}

module.exports = isAdmin;
