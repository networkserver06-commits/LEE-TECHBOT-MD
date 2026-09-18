'use strict';

const { isJidGroup } = require('@whiskeysockets/baileys');
const { getAntilink, incrementWarningCount, resetWarningCount, isSudo } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
const config = require('../config');

const WARN_COUNT = config.WARN_COUNT || 3;
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>()]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()]*)?/gi;
const SCAM_HOST_TERMS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'claim', 'gift', 'airdrop', 'bonus', 'crypto', 'wallet', 'verify', 'prize', 'giveaway', 'login', 'support'];
const MODE_ALIASES = { any: 'all', links: 'all', scamlinks: 'scam', whatsappgroup: 'whatsapp', whatsapp: 'whatsapp', telegram: 'telegram' };

function normalizeDomain(value) {
    let domain = String(value || '').trim().toLowerCase();
    if (!domain) return '';
    try {
        const parsed = new URL(domain.includes('://') ? domain : `https://${domain}`);
        return parsed.hostname.replace(/^www\./, '').replace(/\.$/, '');
    } catch (_) {
        return domain.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '').replace(/[^a-z0-9.-]/g, '');
    }
}

function extractDomains(text) {
    return [...new Set((String(text || '').match(URL_PATTERN) || []).map(normalizeDomain).filter(Boolean))];
}

function domainMatches(domain, rule) {
    const normalizedDomain = normalizeDomain(domain);
    const normalizedRule = normalizeDomain(rule);
    return Boolean(normalizedDomain && normalizedRule && (normalizedDomain === normalizedRule || normalizedDomain.endsWith(`.${normalizedRule}`)));
}

function containsURL(text) {
    return extractDomains(text).length > 0;
}

function looksLikeScam(domain, text) {
    const haystack = `${domain} ${String(text || '')}`.toLowerCase();
    return SCAM_HOST_TERMS.some(term => haystack.includes(term));
}

function shouldDeleteLink(text, settings = {}) {
    if (!settings?.enabled) return false;
    const domains = extractDomains(text);
    if (!domains.length) return false;
    const allowed = Array.isArray(settings.allowDomains) ? settings.allowDomains : [];
    const denied = Array.isArray(settings.denyDomains) ? settings.denyDomains : [];
    const candidates = domains.filter(domain => !allowed.some(rule => domainMatches(domain, rule)));
    if (!candidates.length) return false;
    const mode = MODE_ALIASES[String(settings.mode || 'all').toLowerCase()] || String(settings.mode || 'all').toLowerCase();
    return candidates.some(domain => {
        if (denied.some(rule => domainMatches(domain, rule))) return true;
        if (mode === 'all') return true;
        if (mode === 'whatsapp') return domainMatches(domain, 'chat.whatsapp.com') || domainMatches(domain, 'wa.me') || domainMatches(domain, 'whatsapp.com');
        if (mode === 'telegram') return domainMatches(domain, 't.me') || domainMatches(domain, 'telegram.me') || domainMatches(domain, 'telegram.org');
        if (mode === 'scam') return looksLikeScam(domain, text);
        if (mode === 'custom') return false;
        return false;
    });
}

function modeLabel(mode) { return MODE_ALIASES[String(mode || 'all').toLowerCase()] || mode || 'all'; }

async function Antilink(msg, sock) {
    const jid = msg.key.remoteJid;
    if (!isJidGroup(jid)) return;
    const senderMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';
    if (!senderMessage || typeof senderMessage !== 'string') return;
    const sender = msg.key.participant;
    if (!sender) return;
    try {
        const { isSenderAdmin } = await isAdmin(sock, jid, sender);
        if (isSenderAdmin || await isSudo(sender)) return;
    } catch (_) {}
    const settings = await getAntilink(jid, 'on');
    if (!shouldDeleteLink(senderMessage, settings)) return;
    try {
        await sock.sendMessage(jid, { delete: msg.key });
        // Silent mode deliberately ends after deletion: do not send a warning,
        // mention the sender, kick the member, or publish configuration info.
        if (settings.silent) return;
        const action = settings.action || 'delete';
        if (action === 'kick') {
            await sock.groupParticipantsUpdate(jid, [sender], 'remove');
            await sock.sendMessage(jid, { text: `@${sender.split('@')[0]} was removed for sending a blocked link.`, mentions: [sender] });
        } else if (action === 'warn') {
            const warningCount = await incrementWarningCount(jid, sender);
            if (warningCount >= WARN_COUNT) {
                await sock.groupParticipantsUpdate(jid, [sender], 'remove');
                await resetWarningCount(jid, sender);
                await sock.sendMessage(jid, { text: `@${sender.split('@')[0]} was removed after ${WARN_COUNT} blocked-link warnings.`, mentions: [sender] });
            } else {
                await sock.sendMessage(jid, { text: `@${sender.split('@')[0]} warning ${warningCount}/${WARN_COUNT} for sending a blocked link.`, mentions: [sender] });
            }
        } else {
            await sock.sendMessage(jid, { text: `@${sender.split('@')[0]} link deleted because links are restricted here.`, mentions: [sender] });
        }
    } catch (error) { console.error('Error in Antilink:', error); }
}

module.exports = { Antilink, containsURL, extractDomains, normalizeDomain, shouldDeleteLink, domainMatches, modeLabel };
