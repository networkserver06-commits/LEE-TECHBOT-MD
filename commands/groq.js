'use strict';

const Groq = require('groq-sdk');

function configured() {
    return Boolean(String(process.env.GROQ_API_KEY || '').trim());
}

function getClient() {
    if (!configured()) return null;
    return new Groq({ apiKey: process.env.GROQ_API_KEY });
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
            text: '❌ Groq is not configured. Add GROQ_API_KEY to the bot environment, then restart the bot.'
        }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { react: { text: '🤖', key: message.key } });
        const client = getClient();
        const completion = await client.chat.completions.create({
            messages: [
                { role: 'system', content: process.env.GROQ_SYSTEM_PROMPT || 'You are a helpful WhatsApp bot.' },
                { role: 'user', content: query }
            ],
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
            temperature: Number(process.env.GROQ_TEMPERATURE || 0.7),
            max_tokens: Number(process.env.GROQ_MAX_TOKENS || 700)
        });
        const answer = completion.choices?.[0]?.message?.content?.trim();
        if (!answer) throw new Error('Groq returned no response text');
        return sock.sendMessage(chatId, { text: answer }, { quoted: message });
    } catch (error) {
        console.error('[groq]', error.message || error);
        return sock.sendMessage(chatId, {
            text: '❌ Groq could not answer right now. Check the API key, model name, quota, and network connection.'
        }, { quoted: message });
    }
}

module.exports = { groqCommand, configured };
