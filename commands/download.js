'use strict';

const instagramCommand = require('./instagram');
const facebookCommand = require('./facebook');
const tiktokCommand = require('./tiktok');
const videoCommand = require('./video');
const socialCommand = require('./social');

const TRAILING_PUNCTUATION = /[\s\]})>,.!?;:'"]+$/g;

function messageText(message = {}) {
    return [
        message.message?.conversation,
        message.message?.extendedTextMessage?.text,
        message.message?.imageMessage?.caption,
        message.message?.videoMessage?.caption
    ].find(value => typeof value === 'string' && value.trim()) || '';
}

function cleanUrl(value = '') {
    let candidate = String(value).trim().replace(TRAILING_PUNCTUATION, '');
    // WhatsApp and copied webpages sometimes escape URLs.
    candidate = candidate.replace(/\\\//g, '/').replace(/&amp;/gi, '&');
    try {
        const parsed = new URL(candidate);
        if (!['http:', 'https:'].includes(parsed.protocol)) return '';
        parsed.hash = '';
        return parsed.href;
    } catch {
        return '';
    }
}

function extractUrl(text = '') {
    const matches = String(text).match(/https?:\/\/[^\s<>]+/gi) || [];
    for (const match of matches) {
        const url = cleanUrl(match);
        if (url) return url;
    }
    return '';
}

function hostIs(hostname, domain) {
    return hostname === domain || hostname.endsWith(`.${domain}`);
}

function routeFor(value) {
    const url = cleanUrl(value);
    if (!url) return null;
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (hostIs(host, 'instagram.com') || host === 'instagr.am') return instagramCommand;
    if (hostIs(host, 'facebook.com') || host === 'fb.watch') return facebookCommand;
    if (hostIs(host, 'tiktok.com')) return tiktokCommand;
    if (hostIs(host, 'youtube.com') || host === 'youtu.be') return videoCommand;
    if (['x.com', 'twitter.com', 't.co', 'reddit.com', 'redd.it', 'pinterest.com', 'pin.it', 'threads.net', 'snapchat.com'].some(domain => host === domain || host.endsWith(`.${domain}`))) return socialCommand;
    return null;
}

function commandFor(handler) {
    if (handler === instagramCommand) return '.instagram';
    if (handler === facebookCommand) return '.facebook';
    if (handler === tiktokCommand) return '.tiktok';
    if (handler === socialCommand) return '.social';
    return '.ytmp4';
}

async function downloadCommand(sock, chatId, message) {
    const text = messageText(message);
    const url = extractUrl(text);
    if (!url) {
        return sock.sendMessage(chatId, {
            text: '╭─〔 📥 UNIVERSAL DOWNLOAD 〕\n│ Send a public YouTube, TikTok, Instagram, Facebook, X/Twitter, Reddit, Pinterest, Threads, or Snapchat link.\n│ Example: `.download https://youtu.be/...`\n╰──────────────'
        }, { quoted: message });
    }

    const handler = routeFor(url);
    if (!handler) {
        return sock.sendMessage(chatId, {
            text: '❌ Supported platforms: YouTube, TikTok, Instagram, Facebook, X/Twitter, Reddit, Pinterest, Threads, and Snapchat. Only public links are supported.'
        }, { quoted: message });
    }

    try {
        const routed = {
            ...message,
            message: { conversation: `${commandFor(handler)} ${url}` }
        };
        await handler(sock, chatId, routed);
    } catch (error) {
        console.error('[download] handler failed:', error.message || error);
        await sock.sendMessage(chatId, {
            text: '❌ Download failed. The link may be private, expired, region-restricted, or temporarily unavailable.'
        }, { quoted: message });
    }
}

module.exports = downloadCommand;
module.exports.routeFor = routeFor;
module.exports.extractUrl = extractUrl;
module.exports.cleanUrl = cleanUrl;
module.exports.messageText = messageText;
