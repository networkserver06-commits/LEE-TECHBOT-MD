const axios = require('axios');

// Fallback sleep function
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Reusable Channel Info branding block
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

const designCommand = async (sock, chatId, message, args) => {
    try {
        // Combine arguments to create the prompt
        let prompt = args.join(' ');

        if (!prompt) {
            const usageMsg = `🎨 *LEE TECH AI DESIGNER* 🎨
──────────────────
Please provide a description of the image, logo, or photo you want me to create.

*Usage:* .design <your description>

*Examples:*
➤ *.design* a modern minimalist logo for a tech company named 'LEE TECH', vector style, blue and silver colors.
➤ *.design* a photorealistic portrait of a lion wearing a business suit in a futuristic city, 8k resolution.
➤ *.design* a sleek application icon for a music streaming app, neumorphic design.`;

            return await sock.sendMessage(chatId, { 
                text: usageMsg, 
                ...channelInfo 
            }, { quoted: message });
        }

        // 1. Send "Generating" status message
        const loadingMsg = await sock.sendMessage(chatId, { 
            text: `⏳ *LEE TECH AI is designing your request...*
            
📌 *Prompt:* "${prompt}"
_This usually takes 10-20 seconds. Please wait._`,
            ...channelInfo
        }, { quoted: message });

        try {
            // 2. Call the AI Image Generation API (Pollinations.ai)
            // We enhance the user prompt slightly behind the scenes for better quality results
            const enhancedPrompt = `${prompt}, high quality, professional design, masterpiece, highly detailed`;
            const apiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}`;

            // Fetch the image data as a buffer
            const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
            
            if (!response.data) throw new Error("No image data received from API.");

            const imageBuffer = Buffer.from(response.data, 'binary');

            // Optional small delay to ensure message delivery order
            await sleep(1000);

            // 3. Send the generated image back to WhatsApp
            await sock.sendMessage(chatId, { 
                image: imageBuffer, 
                caption: `🎨 *Design Generated Successfully!* 🎨\n\n📝 *Prompt:* ${prompt}\n\n🤖 *Created by LEE TECHBOT MD AI*`,
                ...channelInfo
            }, { quoted: message });

        } catch (apiError) {
            console.error('AI Generation Error:', apiError.message);
            await sock.sendMessage(chatId, { 
                text: `❌ Error generating image. The AI engine might be busy or down. Please try again later.\n\n*Details:* ${apiError.message}`,
                ...channelInfo
            }, { quoted: message });
        }

    } catch (error) {
        console.error('Critical Design Command Error:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ An unexpected error occurred within the design command.",
            ...channelInfo
        }, { quoted: message });
    }
};

module.exports = { designCommand };