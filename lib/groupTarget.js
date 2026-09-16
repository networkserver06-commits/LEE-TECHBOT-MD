'use strict';

function normalizeGroupJid(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^\d+[-\d]*@g\.us$/i.test(raw)) return raw;
    if (/^\d+[-\d]*$/.test(raw)) return `${raw}@g.us`;
    return '';
}

function groupNumber(jid) {
    return String(jid || '').replace(/@g\.us$/i, '');
}

function targetHelp(prefix = '.settings') {
    return `Use ${prefix} to view this chat, or ${prefix} <list number|full group number|group JID> from owner DM.\nRun .listgroup to see numbered groups.`;
}

async function fetchParticipatingGroups(sock) {
    if (typeof sock.groupFetchAllParticipating !== 'function') {
        throw new Error('group metadata API unavailable');
    }
    const groups = await sock.groupFetchAllParticipating();
    return Object.entries(groups || {}).map(([jid, group], index) => ({
        index: index + 1,
        jid,
        number: groupNumber(jid),
        subject: group?.subject || 'Unnamed group',
        participants: group?.participants || [],
        metadata: group
    }));
}

async function resolveGroupTarget(sock, currentChatId, target) {
    const value = String(target || '').trim();
    if (!value) {
        if (String(currentChatId || '').endsWith('@g.us')) return { jid: currentChatId, number: groupNumber(currentChatId), source: 'current' };
        return { error: targetHelp() };
    }

    // Short numbers are list indexes; long numeric values are full group IDs.
    if (/^\d+$/.test(value) && value.length <= 3) {
        const groups = await fetchParticipatingGroups(sock);
        const match = groups[Number(value) - 1];
        return match ? { ...match, source: 'number' } : { error: `❌ No group matches number ${value}. Run .listgroup again.` };
    }

    const directJid = normalizeGroupJid(value);
    if (directJid) {
        const groups = await fetchParticipatingGroups(sock);
        const match = groups.find((group) => group.jid === directJid);
        return match ? { ...match, source: 'group-number' } : { error: `❌ The bot is not participating in group ${groupNumber(directJid)}.` };
    }

    return { error: `❌ Invalid group target. Use a list number or full group number such as 120363... (JID is optional).\n${targetHelp()}` };
}

module.exports = { normalizeGroupJid, groupNumber, fetchParticipatingGroups, resolveGroupTarget, targetHelp };
