'use strict';

const axios = require('axios');
const songCommand = require('./song');

const REQUEST_TIMEOUT = 15000;
const MEDIA_TIMEOUT = 60000;
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const HEADERS = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json, */*' };

async function retryRequest(request, attempts = 2) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try { return await request(); } catch (error) {
            lastError = error;
            if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 750));
        }
    }
    throw lastError;
}

function mediaUrl(value) {
    try {
        const url = new URL(String(value || '').trim());
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
}

async function fetchSpotifyResult(query) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/search/spotify?q=${encodeURIComponent(query)}`;
    const { data } = await retryRequest(() => axios.get(apiUrl, { timeout: REQUEST_TIMEOUT, headers: HEADERS }));
    if (!data?.status || !data?.result) throw new Error('Spotify provider returned no result');
    const result = data.result;
    const audio = mediaUrl(result.audio);
    if (!audio) throw new Error('Spotify provider returned no valid audio URL');
    return { result, audio };
}

async function verifyAudioUrl(audio) {
    const response = await retryRequest(() => axios.get(audio, {
        responseType: 'arraybuffer',
        timeout: MEDIA_TIMEOUT,
        maxContentLength: MAX_AUDIO_BYTES,
        maxBodyLength: MAX_AUDIO_BYTES,
        validateStatus: status => status >= 200 && status < 400,
        headers: { ...HEADERS, Accept: 'audio/*,application/octet-stream,*/*' }
    }), 2);
    const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
    if (contentType.includes('text/html') || !response.data?.length) throw new Error('Spotify provider returned invalid media');
    return { buffer: Buffer.from(response.data), contentType };
}

async function spotifyCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() || '';
        const used = rawText.split(/\s+/)[0] || '.spotify';
        const query = rawText.slice(used.length).trim();
        if (!query) {
            await sock.sendMessage(chatId, { text: 'Usage: .spotify <song/artist/keywords>\nExample: .spotify con calma' }, { quoted: message });
            return;
        }

        let result;
        let audio;
        let media;
        try {
            ({ result, audio } = await fetchSpotifyResult(query));
            media = await verifyAudioUrl(audio);
        } catch (providerError) {
            console.error('[SPOTIFY] primary provider failed:', providerError.message || providerError);
            // Spotify search metadata often maps cleanly to YouTube. Reuse the
            // resilient song provider chain rather than returning a dead URL.
            const fallbackMessage = { ...message, message: { conversation: `.song ${query}` } };
            await songCommand(sock, chatId, fallbackMessage);
            return;
        }

        const title = result.title || result.name || query;
        const caption = `🎵 ${title}\n👤 ${result.artist || ''}\n⏱ ${result.duration || ''}\n🔗 ${result.url || ''}`.trim();
        if (result.thumbnails) await sock.sendMessage(chatId, { image: { url: result.thumbnails }, caption }, { quoted: message });
        else await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        await sock.sendMessage(chatId, {
            audio: media.buffer,
            mimetype: media.contentType.includes('ogg') ? 'audio/ogg' : 'audio/mpeg',
            fileName: `${title.replace(/[\\/:*?"<>|]/g, '')}.mp3`
        }, { quoted: message });
    } catch (error) {
        console.error('[SPOTIFY] error:', error?.message || error);
        await sock.sendMessage(chatId, { text: '❌ Spotify audio is temporarily unavailable. Try `.song <title>` or retry shortly.' }, { quoted: message });
    }
}

module.exports = spotifyCommand;
module.exports.mediaUrl = mediaUrl;
module.exports.retryRequest = retryRequest;
