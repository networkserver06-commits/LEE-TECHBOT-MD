const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * ULTRA-STABILIZED FACEBOOK DOWNLOADER
 * Uses 4 different API sources to ensure the video is found.
 */
async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        let url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { text: "⚠️ *Usage:* .fb <facebook-link>" }, { quoted: message });
        }

        // 1. Loading States
        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        let videoUrl = null;
        let title = "Facebook Video";

        // --- API SOURCE 1: Widipe (Highly Stable) ---
        if (!videoUrl) {
            try {
                const res = await axios.get(`https://widipe.com/facebook?url=${encodeURIComponent(url)}`);
                if (res.data?.status && res.data.result?.video) {
                    videoUrl = res.data.result.video;
                    title = res.data.result.title || title;
                }
            } catch (e) { console.log("Widipe API Failed"); }
        }

        // --- API SOURCE 2: Botcahx V1 ---
        if (!videoUrl) {
            try {
                const res = await axios.get(`https://api.botcahx.eu.org/api/dowloader/fbdown?url=${encodeURIComponent(url)}&apikey=btch-beta`);
                if (res.data?.status) {
                    videoUrl = res.data.result?.media?.video_hd || res.data.result?.url;
                }
            } catch (e) { console.log("Botcahx V1 Failed"); }
        }

        // --- API SOURCE 3: Botcahx V2 (Alternate Route) ---
        if (!videoUrl) {
            try {
                const res = await axios.get(`https://api.botcahx.eu.org/api/dowloader/fbdown2?url=${encodeURIComponent(url)}&apikey=btch-beta`);
                if (res.data?.status) {
                    videoUrl = res.data.result?.link || res.data.result?.url;
                }
            } catch (e) { console.log("Botcahx V2 Failed"); }
        }

        // --- API SOURCE 4: Global Rest API Fallback ---
        if (!videoUrl) {
            try {
                const res = await axios.get(`https://api.alyarchive.eu.org/api/fbdown?url=${encodeURIComponent(url)}`);
                if (res.data?.status) {
                    videoUrl = res.data.result?.url || res.data.result?.data?.[0]?.url;
                }
            } catch (e) { console.log("Global API Failed"); }
        }

        // 2. Final Check
        if (!videoUrl) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return await sock.sendMessage(chatId, { 
                text: "❌ *Could not resolve video link.*\n\nPossible reasons:\n1. The video is **Private** (Bot cannot see it).\n2. The link is a **Story** (Stories expire quickly).\n3. All API servers are currently being blocked by Facebook." 
            }, { quoted: message });
        }

        // 3. Download Process
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const tempPath = path.join(tmpDir, `fb_${Date.now()}.mp4`);

        const writer = fs.createWriteStream(tempPath);
        const videoStream = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://www.facebook.com/'
            },
            timeout: 90000 
        });

        videoStream.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // 4. Verification and Sending
        const fileStats = fs.statSync(tempPath);
        if (fileStats.size > 100) { // Check if file is not empty/error page
            await sock.sendMessage(chatId, {
                video: fs.readFileSync(tempPath),
                mimetype: "video/mp4",
                caption: `✅ *LEE TECH BOT Download*\n\n📝 *Title:* ${title}\n⚖️ *Size:* ${(fileStats.size / (1024 * 1024)).toFixed(2)} MB`,
            }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        } else {
            throw new Error("Downloaded file is empty (Possible 403 block).");
        }

        // 5. Cleanup
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    } catch (error) {
        console.error('FB ULTIMATE ERROR:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ *Error:* ${error.message.includes('403') ? 'Facebook blocked the stream. Try again later.' : 'Failed to process video.'}` 
        }, { quoted: message });
    }
}

module.exports = facebookCommand;
