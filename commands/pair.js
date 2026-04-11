const axios = require('axios');

// Fallback sleep function to guarantee it works without throwing import errors
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Reusable Channel Info block to keep the code clean
const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363404186001130@newsletter',
            newsletterName: 'LEE TECHBOT MD',
            serverMessageId: -1
        }
    }
};

const pairCommand = async (sock, chatId, message, args) => {
    try {
        // Join args into a single string in case the user spaced the number out
        const q = args.join('');

        if (!q) {
            return await sock.sendMessage(chatId, {
                text: "❌ Please provide a valid WhatsApp number.\n*Example:* .pair 254712345678",
                ...channelInfo
            }, { quoted: message });
        }

        // Clean the number - remove +, spaces, dashes, etc.
        const number = q.replace(/[^0-9]/g, '');

        if (number.length < 10 || number.length > 15) {
            return await sock.sendMessage(chatId, {
                text: "❌ Invalid number! Please use the correct international format without '+' or spaces.",
                ...channelInfo
            }, { quoted: message });
        }

        // Verify if the number is actually registered on WhatsApp!
        const whatsappID = number + '@s.whatsapp.net';
        const result = await sock.onWhatsApp(whatsappID);

        if (!result || !result[0]?.exists) {
            return await sock.sendMessage(chatId, {
                text: `❌ That number is not registered on WhatsApp!`,
                ...channelInfo
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: "⏳ *Wait a moment, generating your pairing code...*",
            ...channelInfo
        }, { quoted: message });

        try {
            // Using your new Render URL!
            const response = await axios.get(`https://lee-techbot-pair.onrender.com/pair?number=${number}`);
            
            if (response.data && response.data.code) {
                const code = response.data.code;
                
                if (code === "Service Unavailable") {
                    throw new Error('Service Unavailable');
                }
                
                await sleep(2000); // Short delay for dramatic effect
                
                // Simple, clear step-by-step instructions
                const successMsg = `✅ *Pairing Code Generated!*\n\n` +
                                 `📱 *Number:* ${number}\n` +
                                 `🔑 *Code:* ${code}\n\n` +
                                 `*📌 How to link your bot:*\n` +
                                 `1️⃣ Open WhatsApp on your phone.\n` +
                                 `2️⃣ Tap the 3 dots (⋮) or Settings (⚙️).\n` +
                                 `3️⃣ Tap *Linked Devices* -> *Link a Device*.\n` +
                                 `4️⃣ Tap *Link with phone number instead*.\n` +
                                 `5️⃣ Enter the code above!`;

                await sock.sendMessage(chatId, {
                    text: successMsg,
                    ...channelInfo
                }, { quoted: message });
                
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (apiError) {
            console.error('API Error:', apiError.message);
            const errorMessage = apiError.message === 'Service Unavailable' 
                ? "❌ Service is currently unavailable. Please try again later."
                : "❌ Failed to generate pairing code. Make sure your Render server is online!";
            
            await sock.sendMessage(chatId, {
                text: errorMessage,
                ...channelInfo
            }, { quoted: message });
        }
    } catch (error) {
        console.error('Pair command critical error:', error);
        await sock.sendMessage(chatId, {
            text: "❌ An unexpected error occurred. Please try again later.",
            ...channelInfo
        }, { quoted: message });
    }
};

module.exports = pairCommand;