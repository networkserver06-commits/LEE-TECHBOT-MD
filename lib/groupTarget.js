'use strict';

function normalizeGroupJid(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^\d+[-\d]*@g\.us$/i.test(raw)) return raw;
    if (/^\d+[-\d]*$/.test(raw)) return `${raw}@g.us`;
    return '';
}

function targetHelp(prefix = '.settings') {
    return `Use ${prefix} to view this chat, or ${prefix} <number|group JID> from owner DM.\nRun .listgroup to see numbered groups.`;
}

async function fetchParticipatingGroups(sock) {
    if (typeof sock.groupFetchAllParticipating !== 'function') {
        throw new Error('group metadata API unavailable');
    }
    const groups = await sock.groupFetchAllParticipating();
    return Object.entries(groups || {}).map(([jid, group], index) => ({
        index: index + 1,
        jid,
        subject: group?.subject || 'Unnamed group',
        participants: group?.participants || [],
        metadata: group
    }));
}

async function resolveGroupTarget(sock, currentChatId, target) {
    const value = String(target || '').trim();
    if (!value) {
        if (String(currentChatId || '').endsWith('@g.us')) return { jid: currentChatId, source: 'current' };
        return { error: targetHelp() };
    }

    if (/^\d+$/.test(value)) {
        const groups = await fetchParticipatingGroups(sock);
        const match = groups[Number(value) - 1];
        return match ? { ...match, source: 'number' } : { error: `❌ No group matches number ${value}. Run .listgroup again.` };
    }

    const directJid = normalizeGroupJid(value);
    if (directJid) {
        const groups = await fetchParticipatingGroups(sock);
        const match = groups.find((group) => group.jid === directJid);
        return match ? { ...match, source: 'jid' } : { error: `❌ The bot is not participating in ${directJid}.` };
    }

    return { error: `❌ Invalid group target. Use a list number or JID such as 120363...@g.us.\n${targetHelp()}` };
}

module.exports = { normalizeGroupJid, fetchParticipatingGroups, resolveGroupTarget, targetHelp };
