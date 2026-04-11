const os = require('os');

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(uptime) {
    let seconds = Math.floor(uptime);
    let d = Math.floor(seconds / (3600 * 24));
    let h = Math.floor((seconds % (3600 * 24)) / 3600);
    let m = Math.floor((seconds % 3600) / 60);
    let s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}

const systemCommand = async (sock, chatId, message) => {
    const totalRAM = formatBytes(os.totalmem());
    const freeRAM = formatBytes(os.freemem());
    const usedRAM = formatBytes(os.totalmem() - os.freemem());
    const cpuModel = os.cpus()[0].model;
    const uptime = formatUptime(process.uptime());
    const osType = os.type() + ' ' + os.release();

    const stats = `📊 *LEE TECH SYSTEM MONITOR* 📊
──────────────────
🖥️ *OS:* ${osType}
🧠 *CPU:* ${cpuModel}
💾 *RAM Used:* ${usedRAM} / ${totalRAM}
🔋 *RAM Free:* ${freeRAM}
⏱️ *Bot Uptime:* ${uptime}
⚡ *NodeJS:* ${process.version}
──────────────────
_Running smoothly! 🚀_`;

    await sock.sendMessage(chatId, { text: stats }, { quoted: message });
};

module.exports = systemCommand;