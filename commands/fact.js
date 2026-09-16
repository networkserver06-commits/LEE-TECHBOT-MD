const axios = require('axios');

const FACT_API_TIMEOUT_MS = 2500;

module.exports = async function (sock, chatId, message) {
    try {
        const response = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en', {
            timeout: FACT_API_TIMEOUT_MS,
            headers: { 'User-Agent': 'LEE-TECH-BOT/2.0' }
        });
        const fact = response.data?.text;
        if (!fact) throw new Error('Fact provider returned an empty response');
        await sock.sendMessage(chatId, { text: fact },{ quoted: message });
    } catch (error) {
        console.warn('[fact] provider unavailable:', error.code || error.message || error);
        await sock.sendMessage(chatId, { text: 'Sorry, I could not fetch a fact right now. Please try again shortly.' },{ quoted: message });
    }
};
