const fetch = require('node-fetch');
const FALLBACK_TRUTHS = [
    'Small consistent steps usually beat rare bursts of effort.',
    'A clear question is often the fastest path to a useful answer.',
    'Reliable systems are built with good defaults and honest error messages.'
];

async function truthCommand(sock, chatId, message) {
    try {
        const shizokeys = 'shizo';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`https://shizoapi.onrender.com/api/texts/truth?apikey=${shizokeys}`, { signal: controller.signal });
        clearTimeout(timer);
        
        if (!res.ok) {
            throw await res.text();
        }
        
        const json = await res.json();
        const truthMessage = typeof json.result === 'string' && json.result.trim()
            ? json.result.trim()
            : FALLBACK_TRUTHS[Math.floor(Math.random() * FALLBACK_TRUTHS.length)];

        // Send the truth message
        await sock.sendMessage(chatId, { text: truthMessage }, { quoted: message });
    } catch (error) {
        console.error('Error in truth command:', error);
        const fallback = FALLBACK_TRUTHS[Math.floor(Math.random() * FALLBACK_TRUTHS.length)];
        await sock.sendMessage(chatId, { text: `💡 ${fallback}` }, { quoted: message });
    }
}

module.exports = { truthCommand };
