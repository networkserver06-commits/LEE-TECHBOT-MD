const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function facebookCommand(sock, chatId, message) {
    let tempPath = null; // Declare up here for safe cleanup

    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        let url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { text: "📝 *Usage:* .fb <link>" }, { quoted: message });
        }

        // 1. Initial Reaction
        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        // 2. Fetching from the API
        const apiUrl = `https://api.vreden.my.id/api/facebook?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl, { timeout: 15000 });
        
        if (!response.data || !response.data.status) {
            throw new Error("API could not resolve this link. The video might be private.");
        }

        const resData = response.data.result;
        let videoUrl = '';
        let title = resData.title || "Facebook Video";

        // 3. Smart URL Extraction (Prioritize HD)
        if (typeof resData === 'object') {
            // Try to grab HD first, then fallback to SD or generic URL
            videoUrl = resData.hd || resData.HD || resData.High_Resolution || resData.sd || resData.SD || resData.video || resData.url;
            
            // If the API returns an array of qualities
            if (!videoUrl && Array.isArray(resData)) {
                const hd = resData.find(v => v.quality?.toLowerCase().includes('hd') || v.resolution?.includes('720'));
                const sd = resData.find(v => v.quality?.toLowerCase().includes('sd'));
                videoUrl = hd?.url || sd?.url || resData[0]?.url;
            }
        } else if (typeof resData === 'string') {
            videoUrl = resData;
        }

        if (!videoUrl) throw new Error("No playable video stream found in the API response.");

        // 4. Prepare Temp File
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        tempPath = path.join(tmpDir, `fb_${Date.now()}.mp4`);

        // 5. Download with "Human-Like" Headers
        const writer = fs.createWriteStream(tempPath);
        const videoFetch = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
                'Referer': 'https://www.facebook.com/',
                'Connection': 'keep-alive'
            }
        });

        videoFetch.data.pipe(writer);

        // Wait for the file to COMPLETELY finish writing to disk
        await new Promise((resolve, reject) => {
            writer.on('close', resolve); // 'close' is safer than 'finish'
            writer.on('error', reject);
        });

        // 6. Final Send Check
        const stats = fs.statSync(tempPath);
        if (stats.size > 2000) { 
            await sock.sendMessage(chatId, {
                // BIG CHANGE: Streaming from disk instead of reading into RAM. 
                // This prevents the bot from crashing on large "full" videos.
                video: { url: tempPath }, 
                mimetype: "video/mp4",
                caption: `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 ${BOT_NAME}\n\n📝 *Title:* ${title}\n⚖️ *Size:* ${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
            }, { quoted: message });
            
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        } else {
            throw new Error("403 Forbidden: Server IP is blocked by Facebook, or file is corrupt.");
        }

    } catch (error) {
        console.error('FINAL ATTEMPT ERROR:', error.message);
        
        let errorMsg = "❌ *Download Failed*";
        if (error.message.includes('403')) {
            errorMsg = "❌ *IP BLOCKED:* Facebook is blocking your bot server's IP address. Please restart your VPS or use a Proxy.";
        } else if (error.message.includes('timeout')) {
            errorMsg = "❌ *Timeout:* The API server is slow. Try again.";
        } else if (error.message.includes('status code 404')) {
            errorMsg = "❌ *Not Found:* The video may be private, restricted, or deleted.";
        }

        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    } finally {
        // 7. Cleanup: ALWAYS delete the file, even if an error occurred to prevent VPS storage from getting full
        if (tempPath && fs.existsSync(tempPath)) {
            try {
                fs.unlinkSync(tempPath);
            } catch (cleanupErr) {
                console.error("Failed to delete temp file:", cleanupErr);
            }
        }
    }
}

module.exports = facebookCommand;