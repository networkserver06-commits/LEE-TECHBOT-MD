'use strict';

const Groq = require('groq-sdk');

const DEFAULT_FREE_MODEL = 'llama-3.1-8b-instant';

function configured() {
    return Boolean(String(process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '').trim());
}

function getClient() {
    if (!configured()) return null;
    return new Groq({ apiKey: process.env.GROQ_API_KEY || process.env.GROK_API_KEY });
}

function modelCandidates() {
    return [...new Set([
        process.env.GROQ_MODEL || DEFAULT_FREE_MODEL,
        process.env.GROQ_FALLBACK_MODEL || DEFAULT_FREE_MODEL
    ])];
}

function providerError(error) {
    const status = error?.status || error?.statusCode || error?.response?.status;
    if (status === 401 || status === 403) return '❌ Groq API key was rejected. Check GROQ_API_KEY, then restart the bot.';
    if (status === 429) return '❌ Groq free-tier quota or rate limit reached. Please wait and try again later.';
    if (status === 400 || status === 404) return '❌ The selected Groq model is unavailable. The bot tried the free fallback model; check GROQ_MODEL if this continues.';
    return '❌ Groq could not answer right now. Check the API key, free-tier quota, model, and network connection.';
}

async function groqCommand(sock, chatId, message, args = []) {
    const rawText = message?.message?.conversation
        || message?.message?.extendedTextMessage?.text
        || message?.conversation
        || message?.extendedTextMessage?.text
        || '';
    const parts = String(rawText).trim().split(/\s+/);
    const query = parts.slice(1).join(' ').trim() || args.join(' ').trim();

    if (!query) {
        return sock.sendMessage(chatId, {
            text: 'Please provide a question after .groq or .grok\n\nExample: .groq Write a 2-sentence welcome message for a tech community chat.'
        }, { quoted: message });
    }
    if (!configured()) {
        return sock.sendMessage(chatId, {
            text: '❌ Groq is not configured. Add GROQ_API_KEY (or GROK_API_KEY) to the bot environment, then restart the bot.'
        }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { react: { text: '🤖', key: message.key } });
        const client = getClient();
        let completion;
        let lastError;
        for (const model of modelCandidates()) {
            try {
                completion = await client.chat.completions.create({
                    messages: [
                        { role: 'system', content: process.env.GROQ_SYSTEM_PROMPT || 'You are a helpful WhatsApp bot.' },
                        { role: 'user', content: query }
                    ],
                    model,
                    temperature: Number(process.env.GROQ_TEMPERATURE || 0.7),
                    max_tokens: Number(process.env.GROQ_MAX_TOKENS || 700)
                });
                break;
            } catch (error) {
                lastError = error;
                const status = error?.status || error?.statusCode || error?.response?.status;
                if (![400, 404].includes(status)) throw error;
            }
        }
        if (!completion) throw lastError || new Error('Groq returned no completion');
        const answer = completion.choices?.[0]?.message?.content?.trim();
        if (!answer) throw new Error('Groq returned no response text');
        return sock.sendMessage(chatId, { text: answer }, { quoted: message });
    } catch (error) {
        console.error('[groq]', error.message || error);
        return sock.sendMessage(chatId, { text: providerError(error) }, { quoted: message });
    }
}

module.exports = { groqCommand, configured, modelCandidates, providerError, DEFAULT_FREE_MODEL };
