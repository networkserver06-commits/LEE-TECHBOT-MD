const axios = require('axios');
const yts = require('yt-search');
// @distube/ytdl-core is the maintained extractor; the older ytdl-core
// package frequently times out when YouTube changes its player responses.
const ytdl = require('@distube/ytdl-core');

const CONFIGURED_VIDEO_API = String(process.env.YOUTUBE_DOWNLOAD_API_URL || '').trim();

const AXIOS_DEFAULTS = {
    timeout: 9000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 1) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

function normalizeYouTubeUrl(value) {
    const candidate = String(value || '').trim();
    if (!/^https?:\/\//i.test(candidate)) return '';
    try {
        const url = new URL(candidate);
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) return url.href;
    } catch (_) { /* invalid URL */ }
    return '';
}

async function getDirectYouTubeVideoByUrl(youtubeUrl) {
    const info = await Promise.race([
        ytdl.getInfo(youtubeUrl, { requestOptions: { timeout: 8000 } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Direct YouTube lookup timed out')), 9000))
    ]);
    const format = ytdl.chooseFormat(info.formats, { quality: '18', filter: 'audioandvideo' });
    if (!format?.url) throw new Error('No compatible public YouTube format');
    return { download: format.url, title: info.videoDetails?.title };
}

async function getConfiguredVideoByUrl(youtubeUrl) {
    if (!CONFIGURED_VIDEO_API) throw new Error('No configured public-video API');
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (process.env.YOUTUBE_DOWNLOAD_API_KEY) headers.Authorization = `Bearer ${process.env.YOUTUBE_DOWNLOAD_API_KEY}`;
    const response = await axios.post(CONFIGURED_VIDEO_API, {
        url: youtubeUrl,
        downloadMode: 'auto',
        videoQuality: process.env.YOUTUBE_VIDEO_QUALITY || '720'
    }, { timeout: 9000, headers });
    const data = response.data || {};
    const candidate = data.url || data.downloadURL || data.download_url || data.download || data.data?.url || data.data?.download_url;
    if (!/^https?:\/\//i.test(candidate || '')) throw new Error(data.error?.code || 'Configured provider returned no public media URL');
    return { download: candidate, title: data.filename || data.title || data.data?.title };
}

// EliteProTech API - Primary
async function getEliteProTechVideoByUrl(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp4`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.downloadURL) {
        return {
            download: res.data.downloadURL,
            title: res.data.title
        };
    }
    throw new Error('EliteProTech ytdown returned no download');
}

async function getYupraVideoByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title,
            thumbnail: res.data.data.thumbnail
        };
    }
    throw new Error('Yupra returned no download');
}

async function getOkatsuVideoByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    // shape: { status, creator, url, result: { status, title, mp4 } }
    if (res?.data?.result?.mp4) {
        return { download: res.data.result.mp4, title: res.data.result.title };
    }
    throw new Error('Okatsu ytmp4 returned no mp4');
}

async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();
        
        
        if (!searchQuery) {
            await sock.sendMessage(chatId, { text: 'What video do you want to download?' }, { quoted: message });
            return;
        }

        // Determine if input is a YouTube link
        let videoUrl = '';
        let videoTitle = '';
        let videoThumbnail = '';
        if (searchQuery.startsWith('http://') || searchQuery.startsWith('https://')) {
            videoUrl = normalizeYouTubeUrl(searchQuery);
        } else {
            // Search YouTube for the video
            const { videos } = await Promise.race([
                yts(searchQuery),
                new Promise((_, reject) => setTimeout(() => reject(new Error('YouTube search timed out')), 9000))
            ]);
            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { text: 'No videos found!' }, { quoted: message });
                return;
            }
            videoUrl = videos[0].url;
            videoTitle = videos[0].title;
            videoThumbnail = videos[0].thumbnail;
        }

        // Send thumbnail immediately
        try {
            const ytId = (videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
            const thumb = videoThumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : undefined);
            const captionTitle = videoTitle || searchQuery;
            if (thumb) {
                await sock.sendMessage(chatId, {
                    image: { url: thumb },
                    caption: `*${captionTitle}*\nDownloading...`
                }, { quoted: message });
            }
        } catch (e) { console.error('[VIDEO] thumb error:', e?.message || e); }
        

        // Validate YouTube URL
        let urls = videoUrl.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.|music\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?|(?:www\.)?youtube-nocookie\.com\/(?:embed\/|v\/)?)([a-zA-Z0-9_-]{11})/gi);
        if (!urls) {
            await sock.sendMessage(chatId, { text: 'This is not a valid YouTube link!' }, { quoted: message });
            return;
        }

        // Try multiple public providers, then local/direct fallbacks.
        let videoData;
        let downloadSuccess = false;
        
        // List of API methods to try
        const apiMethods = [
            { name: 'EliteProTech', method: () => getEliteProTechVideoByUrl(videoUrl) },
            { name: 'Yupra', method: () => getYupraVideoByUrl(videoUrl) },
            { name: 'Okatsu', method: () => getOkatsuVideoByUrl(videoUrl) },
            { name: 'Configured public-video API', method: () => getConfiguredVideoByUrl(videoUrl) },
            { name: 'Direct YouTube', method: () => getDirectYouTubeVideoByUrl(videoUrl) }
        ];
        
        // Try each API until we successfully get video data
        for (const apiMethod of apiMethods) {
            try {
                videoData = await apiMethod.method();
                const videoUrl_check = videoData.download || videoData.dl || videoData.url;
                
                if (!videoUrl_check) {
                    console.log(`${apiMethod.name} returned no download URL, trying next API...`);
                    continue; // Try next API
                }
                
                downloadSuccess = true;
                break; // Success! Exit the loop
            } catch (apiErr) {
                // API call failed, try next API
                console.log(`${apiMethod.name} API failed:`, apiErr.message);
                continue;
            }
        }
        
        // If all APIs failed, throw error
        if (!downloadSuccess || !videoData) {
            throw new Error('All public download sources failed');
        }

        // Send video directly using the download URL
        await sock.sendMessage(chatId, {
            video: { url: videoData.download || videoData.dl || videoData.url },
            mimetype: 'video/mp4',
            fileName: `${(videoData.title || videoTitle || 'video').replace(/[^\w\s-]/g, '')}.mp4`,
            caption: `*${videoData.title || videoTitle || 'Video'}*\n\n> *_Downloaded by LEE TECH BOT MD_*`
        }, { quoted: message });


    } catch (error) {
        console.error('[VIDEO] Command Error:', error?.message || error);
        
        // Provide more specific error messages
        let errorMessage = '❌ Failed to download video.';
        if (error.response?.status === 451 || error.status === 451) {
            errorMessage = '❌ Content unavailable (451). This may be due to legal restrictions or regional blocking.';
        } else if (error.message && error.message.includes('blocked')) {
            errorMessage = '❌ Download blocked. The content may be unavailable in your region or due to legal restrictions.';
        } else if (error.message && error.message.includes('All public download sources failed')) {
            errorMessage = '❌ Download providers are temporarily unavailable, or this public video cannot be fetched right now. Please try again later.';
        } else if (error.message) {
            errorMessage = '❌ Download failed: ' + error.message;
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: message });
    }
}

module.exports = videoCommand; 
